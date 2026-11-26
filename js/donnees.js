/* Marchéo · données et synchronisation (mécanisme repris d'Hébéo)
   - Serveur : script Google Apps Script déployé sur le compte Google de l'utilisateur, données dans un Google Sheet.
   - Une ligne par fiche (collection + identifiant + date de mise à jour) : seules les fiches modifiées circulent.
   - Écriture : la fiche la plus récente gagne, fiche par fiche (le téléphone et le PC ne s'écrasent pas en bloc).
   - Hors connexion : les modifications attendent dans une file et partent au retour du réseau.
   - Mode démonstration : aucune adresse de serveur, tout reste dans le navigateur. */
(function (global) {
  'use strict';
  const COLLS = ['biens', 'contacts', 'relances', 'journal', 'reglages', 'annonces'];
  const CLE_CACHE = 'marcheo-cache-v1', CLE_FILE = 'marcheo-file-v1', CLE_CONF = 'marcheo-serveur', CLE_JETON = 'marcheo-jeton';
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage plein ou bloqué */ } };
  const maintenant = () => new Date().toISOString();
  const nouvelId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let cache = lire(CLE_CACHE, null) || { donnees: {}, depuis: '' };
  COLLS.forEach(c => { if (!cache.donnees[c]) cache.donnees[c] = {}; });
  let file = lire(CLE_FILE, []);
  let etat = { mode: 'demo', statut: 'ok', message: '' };
  const abonnes = new Set();
  const signaler = () => abonnes.forEach(f => { try { f(etat); } catch (e) { console.error(e); } });
  const persister = () => { ecrire(CLE_CACHE, cache); ecrire(CLE_FILE, file); };

  const conf = () => lire(CLE_CONF, null);
  const jeton = () => { try { return localStorage.getItem(CLE_JETON) || ''; } catch (e) { return ''; } };

  async function appeler(action, donnees) {
    const c = conf(); if (!c || !c.url) throw Object.assign(new Error('Aucun serveur configuré.'), { code: 'CONF' });
    let rep;
    try {
      rep = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, jeton: jeton(), donnees }) });
    } catch (e) { throw Object.assign(new Error('Serveur injoignable : vérifier la connexion internet.'), { code: 'RESEAU' }); }
    let json; try { json = await rep.json(); } catch (e) { throw Object.assign(new Error('Réponse illisible du serveur.'), { code: 'SERVEUR' }); }
    if (!json.ok) {
      if (json.code === 'SESSION') { try { localStorage.removeItem(CLE_JETON); } catch (e) {} }
      throw Object.assign(new Error(json.message || 'Erreur du serveur.'), { code: json.code || 'SERVEUR' });
    }
    return json.resultat;
  }

  /* ---------- Lecture locale ---------- */
  const liste = coll => Object.values(cache.donnees[coll] || {}).filter(x => !x._supprime);
  const obtenir = (coll, id) => { const x = (cache.donnees[coll] || {})[id]; return x && !x._supprime ? x : null; };

  /* ---------- Écriture locale + file d'attente ---------- */
  function enregistrer(coll, objet) {
    if (!objet.id) objet.id = nouvelId(coll[0]);
    objet._maj = maintenant();
    cache.donnees[coll][objet.id] = objet;
    file = file.filter(x => !(x.coll === coll && x.id === objet.id));
    file.push({ coll, id: objet.id, majLe: objet._maj, supprime: false, data: objet });
    persister(); signaler(); planifier();
    return objet;
  }
  function supprimer(coll, id) {
    const x = cache.donnees[coll][id]; if (!x) return;
    const t = { id, _supprime: true, _maj: maintenant() };
    cache.donnees[coll][id] = t;
    file = file.filter(y => !(y.coll === coll && y.id === id));
    file.push({ coll, id, majLe: t._maj, supprime: true, data: t });
    persister(); signaler(); planifier();
  }

  /* ---------- Synchronisation ---------- */
  let minuteur = null, enCours = false;
  function planifier(delai = 800) {
    if (etat.mode !== 'distant') { file = []; persister(); return; }
    clearTimeout(minuteur); minuteur = setTimeout(synchroniser, delai);
  }
  async function synchroniser() {
    if (etat.mode !== 'distant' || enCours || !jeton()) return;
    enCours = true; etat.statut = 'attente'; signaler();
    try {
      if (file.length) {
        const lot = file.slice(0, 40);
        const res = await appeler('ecrire', { enregistrements: lot });
        const envoyes = new Set(lot.map(x => x.coll + '|' + x.id + '|' + x.majLe));
        file = file.filter(x => !envoyes.has(x.coll + '|' + x.id + '|' + x.majLe));
        (res.refuses || []).forEach(appliquer); // une version plus récente existait sur le serveur
        persister();
      }
      const res = await appeler('lire', { depuis: cache.depuis || '' });
      (res.enregistrements || []).forEach(appliquer);
      if (res.horodatage) cache.depuis = res.horodatage;
      persister();
      etat.statut = file.length ? 'attente' : 'ok'; etat.message = file.length ? file.length + ' modification(s) en attente' : 'À jour';
      if (file.length) planifier(300);
    } catch (e) {
      etat.statut = 'erreur'; etat.message = e.code === 'RESEAU' ? 'Hors connexion · ' + file.length + ' en attente' : e.message;
      if (e.code === 'SESSION') etat.session = false;
    } finally { enCours = false; signaler(); }
  }
  /* Fusion fiche par fiche : la version la plus récente gagne, sauf si une modification locale plus récente attend d'être envoyée. */
  function appliquer(e) {
    if (!cache.donnees[e.coll]) return;
    const local = cache.donnees[e.coll][e.id];
    const attente = file.find(x => x.coll === e.coll && x.id === e.id);
    if (attente && attente.majLe > e.majLe) return;
    if (local && local._maj > e.majLe && !attente) return;
    cache.donnees[e.coll][e.id] = e.supprime ? { id: e.id, _supprime: true, _maj: e.majLe } : Object.assign(e.data || {}, { id: e.id, _maj: e.majLe });
  }

  /* ---------- Démarrage, connexion ---------- */
  function demarrer() {
    const c = conf();
    etat.mode = c && c.url ? 'distant' : 'demo';
    if (etat.mode === 'demo' && !liste('biens').length && !lire('marcheo-demo-vide', false)) global.MarcheoDemo && global.MarcheoDemo.remplir({ enregistrer });
    if (etat.mode === 'distant') {
      etat.session = !!jeton();
      if (etat.session) { synchroniser(); setInterval(() => { if (!document.hidden) synchroniser(); }, 30000); }
      document.addEventListener('visibilitychange', () => { if (!document.hidden) synchroniser(); });
      global.addEventListener('online', () => synchroniser());
    }
    return etat;
  }
  async function connexion(url, identifiant, motDePasse) {
    ecrire(CLE_CONF, { url: url.trim() });
    const res = await appeler('connexion', { identifiant, motDePasse });
    try { localStorage.setItem(CLE_JETON, res.jeton); } catch (e) {}
    /* Changement de compte : on repart d'un cache vide. */
    if (cache.compte !== identifiant) { cache = { donnees: {}, depuis: '', compte: identifiant }; COLLS.forEach(c => cache.donnees[c] = {}); file = []; persister(); }
    etat.mode = 'distant'; etat.session = true; etat.utilisateur = res.utilisateur || identifiant;
    await synchroniser();
    return res;
  }
  async function deconnexion() {
    try { await appeler('deconnexion', {}); } catch (e) { /* hors ligne : le jeton expire seul */ }
    try { localStorage.removeItem(CLE_JETON); } catch (e) {}
    etat.session = false; signaler();
  }
  function quitterDemo() { ecrire('marcheo-demo-vide', true); }
  function reinitialiserDemo() {
    cache = { donnees: {}, depuis: '' }; COLLS.forEach(c => cache.donnees[c] = {}); file = []; persister();
    try { localStorage.removeItem('marcheo-demo-vide'); } catch (e) {}
  }
  function oublierServeur() { try { localStorage.removeItem(CLE_CONF); localStorage.removeItem(CLE_JETON); } catch (e) {} }
  function exporter() { const o = {}; COLLS.forEach(c => o[c] = liste(c)); return { application: 'Marchéo', version: 1, exporteLe: maintenant(), donnees: o }; }
  function importer(sauvegarde) {
    const d = sauvegarde && sauvegarde.donnees; if (!d) throw new Error('Fichier de sauvegarde non reconnu.');
    let n = 0; COLLS.forEach(c => (d[c] || []).forEach(x => { enregistrer(c, Object.assign({}, x)); n++; }));
    return n;
  }

  global.Donnees = {
    action: (nom, donnees) => appeler(nom, donnees),
    COLLS, nouvelId, liste, obtenir, enregistrer, supprimer, synchroniser, demarrer, connexion, deconnexion,
    quitterDemo, reinitialiserDemo, oublierServeur, exporter, importer, conf,
    etat: () => etat, abonner: f => { abonnes.add(f); return () => abonnes.delete(f); }, enAttente: () => file.length
  };
})(typeof window !== 'undefined' ? window : globalThis);
