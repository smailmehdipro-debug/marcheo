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
    Utilities: { DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, sleep() {}, getUuid: () => crypto.randomUUID(),
      computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b) },
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
