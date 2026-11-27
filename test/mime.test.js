/* Lecture des e-mails bruts (serveur-cloudflare/src/mime.js) : même texte que getPlainBody() de Gmail. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { eml } = require('./aides/eml.js');
const lire = f => fs.readFileSync(path.join(__dirname, 'alertes', f), 'utf8').replace(/\r\n/g, '\n');
const charger = () => import('../serveur-cloudflare/src/mime.js');

test('texte brut en quoted-printable : identique au texte d\'origine', async () => {
  const { lireEmail } = await charger();
  const t = lire('bienici.txt');
  const m = lireEmail(Buffer.from(eml({ de: 'Bien’ici <no_reply@bienici.com>', a: 'k7f2q9@alertes.exemple.fr', objet: '2 nouvelles annonces', texte: t })));
  assert.equal(m.texte, t.replace(/\n$/, '') + (t.endsWith('\n') ? '\n' : ''));
  assert.equal(m.de, 'Bien’ici <no_reply@bienici.com>', 'en-tête encodé (RFC 2047) décodé');
  assert.equal(m.objet, '2 nouvelles annonces');
  assert.equal(m.date, '2026-11-27T12:00:00.000Z');
});

test('texte brut en base64, accents conservés', async () => {
  const { lireEmail } = await charger();
  const t = lire('seloger.txt');
  const m = lireEmail(Buffer.from(eml({ de: 'SeLoger <annonces@alertes.seloger.com>', a: 'x@alertes.exemple.fr', objet: '1 nouvelle annonce : 93100', texte: t, encodage: 'base64' })));
  assert.equal(m.texte.trim(), t.trim());
  assert.match(m.texte, /839 000 €/);
});

test('HTML seul : blocs sur des lignes, lien après son texte', async () => {
  const { lireEmail, adresse } = await charger();
  const m = lireEmail(Buffer.from(eml({ de: 'PAP <users@pap.fr>', a: 'x@alertes.exemple.fr', objet: 'Nouvelles annonces', html: '<html><body><p>Studio 20 m² &ndash; 95 000&nbsp;€</p><a href="https://www.pap.fr/annonces/1">Voir l\'annonce</a><br>Paris 11e</body></html>' })));
  assert.deepEqual(m.texte.split('\n'), ['Studio 20 m² &ndash; 95 000 €', "Voir l'annonce", 'https://www.pap.fr/annonces/1', 'Paris 11e']);
  assert.equal(adresse(m.de), 'users@pap.fr');
});
