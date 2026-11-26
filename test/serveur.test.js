/* Test du serveur Apps Script (serveur/Code.gs) avec Google Sheets, Drive et les services simulés. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function environnement() {
  const props = {}, feuilles = {};
  const feuille = nom => {
    const lignes = [];
    return {
      nom, lignes,
      getRange: (l, c, nl, nc) => ({ setValues: v => { while (lignes.length < l) lignes.push([]); lignes[l - 1] = v[0].slice(); } }),
      setFrozenRows() {}, appendRow: r => lignes.push(r.slice()),
      getDataRange: () => ({ getValues: () => lignes.map(r => r.slice()) }),
      getLastColumn: () => Math.max(0, ...lignes.map(r => r.length))
    };
  };
  const classeur = { getId: () => 'ID', getUrl: () => 'url', getSheetByName: n => feuilles[n] || null, insertSheet: n => (feuilles[n] = feuille(n)), getSheets: () => Object.values(feuilles), deleteSheet() {} };
  const ctx = {
    console, feuilles,
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    SpreadsheetApp: { create: () => classeur, openById: () => classeur },
    Utilities: { newBlob: (b, t, n) => ({ bytes: b, getBytes: () => b }), base64Decode: s => Array.from(Buffer.from(s, 'base64')), base64Encode: b => Buffer.from(b).toString('base64'), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, sleep() {}, getUuid: () => crypto.randomUUID(),
      computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '' }) },
    DriveApp: (() => { const fichiers = {}; const dossier = (nom, parent) => { const enfants = {}; const d = { nom, getFoldersByName: n => { const x = enfants[n]; return { hasNext: () => !!x, next: () => x }; }, createFolder: n => (enfants[n] = dossier(n, d)), createFile: blob => { const id = 'f' + (Object.keys(fichiers).length + 1) + 'abcdefghijk'; fichiers[id] = { blob, parent: d }; return { getId: () => id }; }, getParents: () => ({ hasNext: () => !!parent, next: () => parent }) }; return d; }; const racine = dossier('racine', null); return { getRootFolder: () => racine, getFileById: id => { const f = fichiers[id]; if (!f) throw new Error('absent'); return { getBlob: () => f.blob, getParents: () => ({ hasNext: () => true, next: () => f.parent }) }; } }; })(),
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create() {} }) }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 1 }, createTextOutput: t => ({ setMimeType: () => ({ texte: t }) }) },
    Logger: { log: m => { ctx.journal.push(m); } }, journal: []
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../serveur/Code.gs'), 'utf8'), ctx);
  ctx.appel = (action, donnees, jeton) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action, donnees, jeton }) } }).texte);
  return ctx;
}

test('installation, connexion, écriture, lecture, conflit', () => {
  const G = environnement();
  G.installer();
  const mdp = G.journal.join(' ').match(/provisoire : (\S+)/)[1];
  assert.equal(G.appel('lire', {}, '').code, 'SESSION', 'lecture refusée sans jeton');
  assert.equal(G.appel('connexion', { identifiant: 'direction', motDePasse: 'faux' }).code, 'ACCES');
  const c = G.appel('connexion', { identifiant: 'Direction', motDePasse: mdp });
  assert.ok(c.ok && c.resultat.jeton, 'connexion acceptée');
  const j = c.resultat.jeton;

  const gros = 'x'.repeat(120000); // plus de deux cellules Sheets
  const e = G.appel('ecrire', { enregistrements: [
    { coll: 'biens', id: 'b1', majLe: '2026-11-26T10:00:00.000Z', data: { id: 'b1', note: gros } },
    { coll: 'contacts', id: 'c1', majLe: '2026-11-26T10:00:00.000Z', data: { id: 'c1', nom: '=SOMME(A1)' } },
    { coll: 'inconnue', id: 'z', majLe: '2026-11-26T10:00:00.000Z', data: {} }
  ] }, j);
  assert.ok(e.ok);
  let l = G.appel('lire', { depuis: '' }, j).resultat;
  assert.equal(l.enregistrements.length, 2, 'collection inconnue ignorée');
  assert.equal(l.enregistrements.find(x => x.id === 'b1').data.note.length, 120000, 'JSON découpé puis recollé');
  assert.equal(l.enregistrements.find(x => x.id === 'c1').data.nom, '=SOMME(A1)');

  // Le téléphone envoie une version plus ancienne : refusée, la version du serveur revient
  G.appel('ecrire', { enregistrements: [{ coll: 'contacts', id: 'c1', majLe: '2026-11-26T12:00:00.000Z', data: { nom: 'PC' } }] }, j);
  const r = G.appel('ecrire', { enregistrements: [{ coll: 'contacts', id: 'c1', majLe: '2026-11-26T11:00:00.000Z', data: { nom: 'Téléphone' } }] }, j).resultat;
  assert.equal(r.refuses.length, 1); assert.equal(r.refuses[0].data.nom, 'PC');

  // Lecture incrémentale, sur la date de réception du serveur
  const h = G.appel('lire', { depuis: '' }, j).resultat.horodatage;
  assert.equal(G.appel('lire', { depuis: h }, j).resultat.enregistrements.length <= 2, true);
  G.appel('ecrire', { enregistrements: [{ coll: 'contacts', id: 'c2', majLe: '2020-01-01T00:00:00.000Z', data: { nom: 'saisi hors connexion' } }] }, j);
  l = G.appel('lire', { depuis: h }, j).resultat;
  assert.ok(l.enregistrements.some(x => x.id === 'c2'), 'modification ancienne reçue tard : quand même transmise');
  assert.ok(l.horodatage >= h);

  // Suppression logique
  G.appel('ecrire', { enregistrements: [{ coll: 'biens', id: 'b1', majLe: '2026-11-26T13:00:00.000Z', supprime: true, data: { id: 'b1', _supprime: true } }] }, j);
  assert.equal(G.appel('lire', { depuis: '' }, j).resultat.enregistrements.find(x => x.id === 'b1').supprime, true);

  // Déconnexion : le jeton ne vaut plus rien
  G.appel('deconnexion', {}, j);
  assert.equal(G.appel('lire', {}, j).code, 'SESSION');
  // Mot de passe changé
  G.definirMotDePasse('direction', 'nouveau-mot-de-passe');
  assert.equal(G.appel('connexion', { identifiant: 'direction', motDePasse: mdp }).code, 'ACCES');
  assert.ok(G.appel('connexion', { identifiant: 'direction', motDePasse: 'nouveau-mot-de-passe' }).ok);
});

test('photos de visite : dépôt dans Drive et relecture', () => {
  const G = environnement(); G.installer(); G.definirMotDePasse('direction', 'motdepasse-test');
  const j = G.appel('connexion', { identifiant: 'direction', motDePasse: 'motdepasse-test' }).resultat.jeton;
  const image = Buffer.from('image de test').toString('base64');
  const d = G.appel('deposerPhoto', { bienId: 'b1', nom: 'sejour.jpg', base64: image }, j);
  assert.ok(d.ok && d.resultat.id, 'photo déposée');
  const l = G.appel('lirePhoto', { id: d.resultat.id }, j);
  assert.equal(l.resultat.base64, image, 'photo relue à l\'identique');
  assert.equal(G.appel('deposerPhoto', { bienId: 'b1', base64: image }, '').code, 'SESSION', 'dépôt refusé sans connexion');
});

test('ventes DVF : 3 dernières ventes similaires et prix du secteur', () => {
  const G = environnement(); G.installer(); G.definirMotDePasse('direction', 'motdepasse-test');
  const j = G.appel('connexion', { identifiant: 'direction', motDePasse: 'motdepasse-test' }).resultat.jeton;
  const csv = fs.readFileSync(path.join(__dirname, 'alertes/dvf-78362-extrait.csv'), 'utf8');
  const appels = [];
  G.UrlFetchApp.fetch = url => { appels.push(url); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ features: [{ geometry: { coordinates: [1.7108, 48.9747] }, properties: { score: 0.9, type: 'housenumber', citycode: '78362', city: 'Mantes-la-Ville', postcode: '78711', label: '1 rue Test 78711 Mantes-la-Ville' } }] }) }; };
  G.UrlFetchApp.fetchAll = reqs => reqs.map(r => { appels.push(r.url); const ok = /\/2025\//.test(r.url); return { getResponseCode: () => ok ? 200 : 404, getContentText: () => ok ? csv : '' }; });
  const r = G.appel('ventesDVF', { adresse: '1 rue Test', cp: '78711', ville: 'Mantes-la-Ville', type: 'appt', surface: 45 }, j);
  assert.ok(r.ok, r.message);
  const x = r.resultat;
  assert.ok(appels.some(u => u.includes('/communes/78/78362.csv')), 'fichier DVF de la commune');
  assert.equal(x.ventes.length, 3);
  x.ventes.forEach(v => { assert.ok(v.surface >= 45 * 0.4 && v.surface <= 45 * 1.6, 'surface proche ' + v.surface); assert.ok(v.prix > 0 && v.m2 > 0 && v.adresse.includes('Mantes')); });
  assert.ok(x.ventes[0].date >= x.ventes[1].date && x.ventes[1].date >= x.ventes[2].date, 'plus récentes d\'abord');
  assert.ok(x.secteur.mediane > 1000 && x.secteur.mediane < 6000 && x.secteur.n >= 3, 'médiane plausible ' + x.secteur.mediane);
  assert.equal(x.lieu.insee, '78362');
  assert.equal(G.appel('ventesDVF', { type: 'box', ville: 'X' }, j).code, 'DVF', 'box non couvert');
  // une vente de 2 logements (immeuble) n'est pas un comparable
  const deux = G.ventesUniques_(G.lignesCsv_('id_mutation,nature_mutation,valeur_fonciere,type_local,surface_reelle_bati,nombre_pieces_principales,lot1_numero,date_mutation\n1,Vente,300000,Appartement,40,2,1,2025-01-01\n1,Vente,300000,Appartement,50,2,2,2025-01-01\n2,Vente,150000,Appartement,40,2,3,2025-02-01\n2,Vente,150000,Dépendance,,,4,2025-02-01'), 'Appartement');
  assert.equal(JSON.stringify(deux.map(v => v.prix)), '[150000]');
});
