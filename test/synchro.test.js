/* Synchronisation de bout en bout : deux appareils (téléphone, PC) et le serveur Apps Script simulé. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function serveur() {
  const props = {}, feuilles = {};
  const feuille = () => { const lignes = []; return { lignes, getRange: (l) => ({ setValues: v => { lignes[l - 1] = v[0].slice(); } }), setFrozenRows() {}, appendRow: r => lignes.push(r.slice()), getDataRange: () => ({ getValues: () => lignes.map(r => r.slice()) }), getLastColumn: () => Math.max(0, ...lignes.map(r => r.length)) }; };
  const cl = { getId: () => 'ID', getUrl: () => '', getSheetByName: n => feuilles[n] || null, insertSheet: n => (feuilles[n] = feuille()), getSheets: () => Object.values(feuilles), deleteSheet() {} };
  const ctx = { journal: [],
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    SpreadsheetApp: { create: () => cl, openById: () => cl },
    Utilities: { DigestAlgorithm: {}, Charset: {}, sleep() {}, getUuid: () => crypto.randomUUID(), computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s, 'utf8').digest()) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '' }) },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create() {} }) }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: {}, createTextOutput: t => ({ setMimeType: () => t }) }, Logger: { log: m => ctx.journal.push(m) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../serveur/Code.gs'), 'utf8'), ctx);
  ctx.installer(); ctx.definirMotDePasse('direction', 'motdepasse-test');
  return ctx;
}

function appareil(srv, reseau) {
  const stock = {};
  const g = { console, setTimeout: (f) => 0, clearTimeout() {}, setInterval() {}, document: { hidden: false, addEventListener() {} }, addEventListener() {},
    localStorage: { getItem: k => (k in stock ? stock[k] : null), setItem: (k, v) => { stock[k] = String(v); }, removeItem: k => { delete stock[k]; } },
    fetch: async (url, o) => { if (!reseau.ok) throw new Error('hors ligne'); return { json: async () => JSON.parse(srv.doPost({ postData: { contents: o.body } })) }; } };
  g.window = g; g.globalThis = g;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/donnees.js'), 'utf8'), g);
  return g.Donnees;
}

test('téléphone et PC restent synchronisés, y compris hors connexion', async () => {
  const srv = serveur(), net = { ok: true };
  const tel = appareil(srv, net), pc = appareil(srv, net);
  await tel.connexion('https://exemple/exec', 'direction', 'motdepasse-test');
  await pc.connexion('https://exemple/exec', 'direction', 'motdepasse-test');

  const b = tel.enregistrer('biens', { etape: 'repere', sim: { adresse: 'Rue A' } });
  await tel.synchroniser(); await pc.synchroniser();
  assert.equal(pc.obtenir('biens', b.id).sim.adresse, 'Rue A', 'fiche créée sur le téléphone, visible sur le PC');

  // Hors connexion sur le téléphone : la modification attend
  net.ok = false;
  const bt = tel.obtenir('biens', b.id); bt.etape = 'visite'; tel.enregistrer('biens', bt);
  await tel.synchroniser();
  assert.equal(tel.enAttente(), 1);
  assert.equal(tel.etat().statut, 'erreur');
  net.ok = true;
  await new Promise(r => setTimeout(r, 5));
  // Pendant ce temps, le PC modifie une autre fiche
  const c = pc.enregistrer('contacts', { nom: 'Notaire' });
  await pc.synchroniser();
  await tel.synchroniser();
  assert.equal(tel.enAttente(), 0, 'file vidée au retour du réseau');
  assert.equal(tel.obtenir('contacts', c.id).nom, 'Notaire');
  await pc.synchroniser();
  assert.equal(pc.obtenir('biens', b.id).etape, 'visite');

  // Même fiche modifiée des deux côtés : la plus récente gagne partout
  const v1 = pc.obtenir('biens', b.id); v1.etape = 'etude'; pc.enregistrer('biens', v1);
  await new Promise(r => setTimeout(r, 5));
  const v2 = tel.obtenir('biens', b.id); v2.etape = 'offre'; tel.enregistrer('biens', v2);
  await tel.synchroniser(); await pc.synchroniser(); await tel.synchroniser();
  assert.equal(pc.obtenir('biens', b.id).etape, 'offre');
  assert.equal(tel.obtenir('biens', b.id).etape, 'offre');

  // Suppression propagée
  pc.supprimer('contacts', c.id); await pc.synchroniser(); await tel.synchroniser();
  assert.equal(tel.obtenir('contacts', c.id), null);
});
