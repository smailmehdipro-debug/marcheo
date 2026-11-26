/* Marchéo · photos de visite
   - Compressées sur le téléphone (1 600 px au plus, JPEG), gardées dans le navigateur (IndexedDB) : la visite marche sans réseau.
   - Envoyées ensuite dans Google Drive par le serveur (dossier « Marchéo — photos ») ; la fiche ne garde que leur identifiant.
   - Affichage : copie locale si elle existe, sinon lecture par le serveur puis mise en cache. */
(function (global) {
  'use strict';
  const BASE = 'marcheo-photos', MAGASIN = 'photos';
  let dbP = null;
  function db() {
    if (!dbP) dbP = new Promise((ok, ko) => {
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN, { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
    return dbP;
  }
  const tx = async (mode, f) => { const d = await db(); return new Promise((ok, ko) => { const t = d.transaction(MAGASIN, mode), s = t.objectStore(MAGASIN); const r = f(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => ko(t.error); }); };
  const lireLocal = id => tx('readonly', s => s.get(id));
  const ecrireLocal = p => tx('readwrite', s => s.put(p));
  const toutLocal = () => tx('readonly', s => s.getAll());

  /* Réduction de l'image : 1 600 px au plus sur le grand côté, qualité 0,72 (≈ 150 à 300 Ko) */
  function compresser(fichier, maxi = 1600, qualite = 0.72) {
    return new Promise((ok, ko) => {
      const img = new Image(), url = URL.createObjectURL(fichier);
      img.onload = () => {
        const k = Math.min(1, maxi / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok(b) : ko(new Error('Compression impossible')), 'image/jpeg', qualite);
      };
      img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Image illisible')); };
      img.src = url;
    });
  }
  const versBase64 = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => ko(r.error); r.readAsDataURL(blob); });
  const depuisBase64 = (b64, type) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: type || 'image/jpeg' }); };

  /* Ajoute une photo prise pendant la visite ; rend sa fiche { id, etape, date } */
  async function ajouter(bienId, etape, fichier) {
    const blob = await compresser(fichier);
    const p = { id: 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), bienId, etape, date: new Date().toISOString(), blob, driveId: '' };
    await ecrireLocal(p);
    envoyerPlusTard();
    return { id: p.id, etape, date: p.date };
  }
  /* Document joint (devis, facture) : image compressée, PDF gardé tel quel (8 Mo au plus) */
  async function ajouterFichier(bienId, etape, fichier) {
    const image = /^image\//.test(fichier.type || '');
    if (!image && fichier.size > 8 * 1024 * 1024) throw new Error('Document trop lourd (8 Mo au plus).');
    const blob = image ? await compresser(fichier) : fichier, type = image ? 'image/jpeg' : (fichier.type || 'application/pdf');
    const nom = (fichier.name || 'document').replace(/\.[a-z0-9]+$/i, '') + (image ? '.jpg' : /pdf/.test(type) ? '.pdf' : '');
    const p = { id: 'dc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), bienId, etape, date: new Date().toISOString(), blob, type, nom, driveId: '' };
    await ecrireLocal(p);
    envoyerPlusTard();
    return { id: p.id, etape, date: p.date, type, nom };
  }
  /* L'identifiant Drive est reporté sur la fiche, où qu'elle range la photo ou le document */
  function marquer(o, id, driveId) {
    if (!o || typeof o !== 'object') return false;
    if (Array.isArray(o)) return o.reduce((t, x) => marquer(x, id, driveId) || t, false);
    if (o.id === id && o.etape && !o.driveId) { o.driveId = driveId; return true; }
    return Object.keys(o).reduce((t, k) => (o[k] && typeof o[k] === 'object' ? marquer(o[k], id, driveId) : false) || t, false);
  }
  const urls = new Map();
  async function url(meta) {
    if (urls.has(meta.id)) return urls.get(meta.id);
    let p = await lireLocal(meta.id).catch(() => null);
    if (!p && meta.driveId && global.Donnees && global.Donnees.etat().mode === 'distant') {
      const r = await global.Donnees.action('lirePhoto', { id: meta.driveId });
      p = { id: meta.id, bienId: '', etape: meta.etape, date: meta.date, blob: depuisBase64(r.base64, meta.type), type: meta.type, driveId: meta.driveId };
      await ecrireLocal(p).catch(() => {});
    }
    if (!p) return '';
    const u = URL.createObjectURL(p.blob); urls.set(meta.id, u); return u;
  }
  /* Envoi des photos en attente vers Drive (mode connecté) ; la fiche du bien reçoit l'identifiant Drive */
  let minuteur = null, enCours = false;
  function envoyerPlusTard(delai = 1500) { clearTimeout(minuteur); minuteur = setTimeout(envoyer, delai); }
  async function envoyer() {
    const D = global.Donnees;
    if (enCours || !D || D.etat().mode !== 'distant' || !navigator.onLine) return;
    enCours = true;
    try {
      const attente = (await toutLocal()).filter(p => !p.driveId);
      for (const p of attente) {
        const ext = p.type && !/jpeg/.test(p.type) ? (/pdf/.test(p.type) ? '.pdf' : '') : '.jpg';
        const r = await D.action('deposerPhoto', { bienId: p.bienId, nom: p.etape + '-' + p.date.slice(0, 19).replace(/[:T]/g, '-') + (p.nom ? '-' + p.nom.replace(/\.[a-z0-9]+$/i, '') : '') + ext, base64: await versBase64(p.blob), type: p.type || 'image/jpeg' });
        p.driveId = r.id; await ecrireLocal(p);
        const b = D.obtenir('biens', p.bienId);
        if (b && marquer(b, p.id, r.id)) D.enregistrer('biens', b);
      }
    } catch (e) { envoyerPlusTard(60000); }
    finally { enCours = false; }
  }
  const enAttente = async () => (await toutLocal().catch(() => [])).filter(p => !p.driveId).length;
  if (typeof window !== 'undefined') { window.addEventListener('online', () => envoyerPlusTard(500)); setTimeout(() => envoyerPlusTard(3000), 0); }
  global.MarcheoPhotos = { ajouter, ajouterFichier, url, envoyer, enAttente, compresser, marquer };
})(typeof window !== 'undefined' ? window : globalThis);
