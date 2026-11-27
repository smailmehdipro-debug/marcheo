/* Marchéo · données et synchronisation (mécanisme repris d'Hébéo)
   - Serveur : le serveur Marchéo hébergé (un compte par client, adresse ci-dessous), ou, en option avancée,
     un script Google Apps Script déployé sur le compte Google de l'utilisateur (données dans un Google Sheet).
   - Une ligne par fiche (collection + identifiant + date de mise à jour) : seules les fiches modifiées circulent.
   - Écriture : la fiche la plus récente gagne, fiche par fiche (le téléphone et le PC ne s'écrasent pas en bloc).
   - Hors connexion : les modifications attendent dans une file et partent au retour du réseau.
   - Mode démonstration : aucune adresse de serveur, tout reste dans le navigateur. */
(function (global) {
  'use strict';
  /* Adresse du serveur Marchéo hébergé (Cloudflare Workers). À renseigner à la mise en ligne (DEPLOIEMENT.md).
     Pour essayer un autre serveur sans modifier ce fichier : ouvrir l'application avec ?serveur=https://… une fois. */
  const SERVEUR_MARCHEO = '';
  const COLLS = ['biens', 'contacts', 'relances', 'journal', 'reglages', 'annonces'];
  const CLE_CACHE = 'marcheo-cache-v1', CLE_FILE = 'marcheo-file-v1', CLE_CONF = 'marcheo-serveur', CLE_JETON = 'marcheo-jeton';
  const lire = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage plein ou bloqué */ } };
  const maintenant = () => new Date().toISOString();
  const nouvelId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let cache = lire(CLE_CACHE, null) || { donnees: {}, depuis: '' };
  COLLS.forEach(c => { if (!cache.donnees[c]) cache.donnees[c] = {}; });
  let file = lire(CLE_FILE, []);
  if (!cache.masquees) cache.masquees = {};
  let etat = { mode: 'demo', statut: 'ok', message: '' };
  const abonnes = new Set();
  const signaler = () => abonnes.forEach(f => { try { f(etat); } catch (e) { console.error(e); } });
  const persister = () => { ecrire(CLE_CACHE, cache); ecrire(CLE_FILE, file); };

  const conf = () => lire(CLE_CONF, null);
  try { const q = new URLSearchParams(global.location ? global.location.search : '').get('serveur'); if (q && /^https?:\/\//.test(q)) localStorage.setItem('marcheo-serveur-heberge', q); } catch (e) {}
  const serveurMarcheo = () => { try { return localStorage.getItem('marcheo-serveur-heberge') || SERVEUR_MARCHEO; } catch (e) { return SERVEUR_MARCHEO; } };
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
        (res.bloques || []).forEach(b => { const x = (cache.donnees[b.coll] || {})[b.id]; if (x) x._bloque = b.message; etat.limite = b.message; });
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
    if (e.coll === 'annonces' && e.data && e.data.masquee) { cache.masquees[e.id] = e.data.recueLe || e.majLe; return; }
    if (e.coll === 'annonces') delete cache.masquees[e.id];
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
    nouveauCompte(identifiant);
    etat.mode = 'distant'; etat.session = true; etat.utilisateur = res.utilisateur || identifiant;
    await synchroniser();
    return res;
  }
  /* Serveur Marchéo hébergé : inscription et connexion par adresse e-mail */
  function nouveauCompte(identifiant) {
    if (cache.compte !== identifiant) { cache = { donnees: {}, depuis: '', compte: identifiant, masquees: {} }; COLLS.forEach(c => cache.donnees[c] = {}); file = []; persister(); }
  }
  async function inscription(email, motDePasse) {
    if (!serveurMarcheo()) throw Object.assign(new Error('Le serveur Marchéo n\'est pas encore configuré.'), { code: 'CONF' });
    ecrire(CLE_CONF, { url: serveurMarcheo(), heberge: true });
    const res = await appeler('inscription', { email, motDePasse });
    try { localStorage.setItem(CLE_JETON, res.jeton); } catch (e) {}
    nouveauCompte(res.utilisateur); try { localStorage.removeItem('marcheo-demo-vide'); } catch (e) {}
    etat.mode = 'distant'; etat.session = true; etat.utilisateur = res.utilisateur;
    await synchroniser();
    return res;
  }
  async function connexionMarcheo(email, motDePasse) {
    if (!serveurMarcheo()) throw Object.assign(new Error('Le serveur Marchéo n\'est pas encore configuré.'), { code: 'CONF' });
    const res = await connexion(serveurMarcheo(), email, motDePasse);
    ecrire(CLE_CONF, { url: serveurMarcheo(), heberge: true });
    return res;
  }
  async function motDePasseOublie(email) { ecrire(CLE_CONF, Object.assign({}, conf() || {}, { url: (conf() || {}).url || serveurMarcheo() })); return appeler('motDePasseOublie', { email }); }
  async function reinitialiserMotDePasse(jetonLien, motDePasse) { if (!(conf() || {}).url) ecrire(CLE_CONF, { url: serveurMarcheo(), heberge: true }); return appeler('reinitialiserMotDePasse', { jeton: jetonLien, motDePasse }); }

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
  function exporterCsv(coll) {
    const l = liste(coll), cles = [];
    l.forEach(x => Object.keys(x).forEach(k => { if (!cles.includes(k)) cles.push(k); }));
    const cellule = v => { const t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[";\n\r]/.test(t) || /^[=+\-@]/.test(t) ? '"' + (/^[=+\-@]/.test(t) ? "'" : '') + t.replace(/"/g, '""') + '"' : t; };
    /* Point-virgule et BOM : Excel en français ouvre le fichier directement, accents compris */
    return '\ufeff' + [cles.join(';')].concat(l.map(x => cles.map(k => cellule(x[k])).join(';'))).join('\r\n');
  }
  function importer(sauvegarde) {
    const d = sauvegarde && sauvegarde.donnees; if (!d) throw new Error('Fichier de sauvegarde non reconnu.');
    let n = 0; COLLS.forEach(c => (d[c] || []).forEach(x => { enregistrer(c, Object.assign({}, x)); n++; }));
    return n;
  }

  global.Donnees = {
    action: (nom, donnees) => appeler(nom, donnees),
    COLLS, nouvelId, liste, obtenir, enregistrer, supprimer, synchroniser, demarrer, connexion, deconnexion,
    quitterDemo, reinitialiserDemo, oublierServeur, exporter, exporterCsv, importer, conf,
    inscription, connexionMarcheo, motDePasseOublie, reinitialiserMotDePasse, serveurMarcheo,
    heberge: () => !!(conf() || {}).heberge, masquees: () => Object.keys(cache.masquees || {}).length,
    etat: () => etat, abonner: f => { abonnes.add(f); return () => abonnes.delete(f); }, enAttente: () => file.length
  };
})(typeof window !== 'undefined' ? window : globalThis);
