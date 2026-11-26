/* Lecture des e-mails d'alerte (serveur/Code.gs) : formats Bien'ici et SeLoger relevés sur de vraies alertes, données anonymisées. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../serveur/Code.gs'), 'utf8'), ctx);
const lire = f => fs.readFileSync(path.join(__dirname, 'alertes', f), 'utf8');

test("alerte Bien'ici : une annonce par identifiant, sans doublon", () => {
  const l = ctx.extraireAnnonces_('Bien’ici <no_reply@bienici.com>', '2 nouvelles annonces', lire('bienici.txt'), '2026-11-18T19:09:51Z');
  assert.equal(l.length, 2);
  const [a, b] = l;
  assert.equal(a.prix, 742000); assert.equal(a.cp, '93500'); assert.equal(a.ville, 'Pantin'); assert.equal(a.titre, 'Bâtiment/immeuble');
  assert.equal(a.lien, 'https://www.bienici.com/annonce/agence-exemple-1111');
  assert.equal(a.surface, undefined, 'Bien\'ici ne donne pas la surface');
  assert.equal(b.prix, 615000); assert.equal(b.surface, 210); assert.equal(b.lots, 5); assert.equal(b.ville, 'Saint-Denis');
  assert.notEqual(a.id, b.id);
});

test('alerte SeLoger : surface déduite du prix au m²', () => {
  const l = ctx.extraireAnnonces_('annonces@alertes.seloger.com', '1 nouvelle annonce : 93100', lire('seloger.txt'), '2026-09-22T10:41:01Z');
  assert.equal(l.length, 1);
  const a = l[0];
  assert.equal(a.prix, 839000); assert.equal(a.prixM2Annonce, 6992); assert.equal(a.surface, 120);
  assert.equal(a.cp, '93260'); assert.equal(a.ville, 'Les Lilas'); assert.equal(a.lots, 4);
  assert.equal(a.lien, 'https://click.by.seloger.com/?qs=LIEN-ANNONCE');
  assert.match(a.titre, /^Immeuble de 4 appartements/);
});

test('même annonce reçue deux fois : même identifiant, baisse de prix notée, tri conservé', () => {
  const t = lire('seloger.txt');
  const a1 = ctx.extraireAnnonces_('alertes.seloger.com', '', t, '2026-09-22T10:00:00Z')[0];
  const a2 = ctx.extraireAnnonces_('alertes.seloger.com', '', t.replace('839 000 €', '799 000 €'), '2026-10-01T10:00:00Z')[0];
  assert.equal(a1.id, a2.id);
  let f = ctx.fusionnerAnnonce_(null, a1); f.statutTri = 'ecartee';
  f = ctx.fusionnerAnnonce_(f, a2);
  assert.equal(f.prix, 799000); assert.equal(f.prixPrecedent, 839000); assert.equal(f.alertes, 2);
  assert.equal(f.statutTri, 'nouvelle', 'une baisse de prix remet l\'annonce dans le tri');
  assert.equal(f.historiquePrix.length, 2);
});

test('autre site : repli générique', () => {
  const l = ctx.extraireAnnonces_('alertes@pap.fr', 'Maison 4 pièces Montreuil', 'Nouvelle annonce\nMaison 4 pièces 85 m²\n93100 Montreuil\n420 000 €\nhttps://www.pap.fr/annonces/maison-r123', '');
  assert.equal(l.length, 1);
  assert.equal(l[0].prix, 420000); assert.equal(l[0].surface, 85); assert.equal(l[0].cp, '93100'); assert.equal(l[0].lien, 'https://www.pap.fr/annonces/maison-r123');
});

test('e-mails de service ignorés : alerte créée, critères avec un prix', () => {
  const t = 'Votre alerte a bien été créée !\nAcheter à Paris, dans le Val-d’Oise…\nPrix maximum : 130 000 €\nhttps://www.bienici.com/mes-alertes';
  assert.equal(ctx.extraireAnnonces_('no_reply@bienici.com', 'Votre alerte "Acheter à Paris…" a bien été créée !', t, '').length, 0);
  assert.equal(ctx.extraireAnnonces_('no-reply@leboncoin.fr', 'Votre recherche a bien été enregistrée', 'Jusqu\'à 130 000 €', '').length, 0);
  assert.equal(ctx.extraireAnnonces_('annonces@alertes.seloger.com', 'Vos critères', 'Budget\n100 000 €\n130 000 €\nModifier', '').length, 0, 'SeLoger : un prix sans « Voir l\'annonce » n\'est pas une annonce');
});
