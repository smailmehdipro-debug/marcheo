/* Analyse des annonces (js/annonces.js) : plafond de trésorerie, écart de revente, objectif de marge, types */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/calc.js');
const A = require('../js/annonces.js');

const R = { taux: 4, obj: 10, part: 50, pfu: 31.4, dmax: 18, tvaT: 10, tvaMode: 'marge',
  criteres: { secteurs: [{ cp: '93200', commune: 'Saint-Denis', pm2: 3500 }, { cp: '93400', commune: 'Saint-Ouen', pm2: 6900 }] } };

test('critères par défaut : trésorerie 150 000 €, revente + 10 %, quatre types', () => {
  assert.equal(A.CRITERES_DEF.tresoMax, 150000);
  assert.equal(A.CRITERES_DEF.ecartRevente, 10);
  assert.deepEqual(A.CRITERES_DEF.types, ['appt', 'maison', 'local', 'box']);
});

test('type et niveau de travaux déduits du texte', () => {
  assert.equal(A.typeDepuisTexte('Appartement T3 lumineux'), 'appt');
  assert.equal(A.typeDepuisTexte('Pavillon 5 pièces'), 'maison');
  assert.equal(A.typeDepuisTexte('Lot de 6 boxes fermés'), 'box');
  assert.equal(A.typeDepuisTexte('Immeuble de 4 appartements'), 'immeuble');
  assert.equal(A.niveauDepuisTexte('Maison à rénover entièrement'), 'c');
  assert.equal(A.niveauDepuisTexte('Appartement à rafraîchir'), 'r');
  assert.equal(A.niveauDepuisTexte('T2 bon état', 'G'), 'c', 'DPE G : rénovation complète');
});

test('immeubles et terrains : importés, écartés d\'office', () => {
  const e = A.evaluer({ titre: 'Immeuble de 4 appartements', prix: 839000, surface: 120, cp: '93200' }, R);
  assert.equal(e.statut, 'ecartee'); assert.match(e.motifs.join(), /type hors critères : immeuble/);
  assert.equal(A.evaluer({ titre: 'Terrain constructible', prix: 60000, surface: 500, cp: '93200' }, R).statut, 'ecartee');
});

test('l\'exemple du brief : prix maximum 71 847 €, comme la valeur de contrôle', () => {
  const e = A.evaluer({ titre: 'Appartement 2 pièces à rénover', prix: 82000, surface: 42, cp: '93200' }, R);
  assert.equal(e.vente, 147000);
  assert.equal(Math.round(e.tresoAffiche), 131248, 'même calcul que le moteur');
  assert.equal(Math.round(e.achatMax), 71847, 'ici, c\'est l\'objectif de marge qui fixe le prix maximum');
  assert.equal(e.statut, 'signalee', '12 % de négociation, sous les 15 % admis');
  const q = M.compute(Object.assign(M.fresh(), { achat: e.achatMax }));
  assert.ok(q.treso <= 150000 && q.vente >= q.treso * 1.1, 'au prix maximum, plafond et écart de revente tiennent');
  const R2 = Object.assign({}, R, { criteres: Object.assign({}, R.criteres, { negoMax: 10 }) });
  const e2 = A.evaluer({ titre: 'Appartement 2 pièces à rénover', prix: 82000, surface: 42, cp: '93200' }, R2);
  assert.equal(e2.statut, 'ecartee'); assert.match(e2.motifs.join(), /marge nette/);
});

test('bonne affaire : signalée', () => {
  const e = A.evaluer({ titre: 'Appartement 2 pièces à rénover, succession', prix: 75000, surface: 42, cp: '93200' }, R);
  assert.equal(e.statut, 'signalee', e.motifs.join());
  assert.ok(e.tresoAuMax <= 150000); assert.ok(e.signaux.includes('succession'));
});

test('plafond de trésorerie : un bien cher est écarté même s\'il est rentable', () => {
  const e = A.evaluer({ titre: 'Appartement 3 pièces à rénover', prix: 250000, surface: 60, cp: '93400' }, R);
  assert.equal(e.statut, 'ecartee'); assert.match(e.motifs.join(), /plafond|trésorerie/);
});

test('critères modifiables : plafond relevé, écart et types', () => {
  const a = { titre: 'Appartement 3 pièces à rénover', prix: 250000, surface: 60, cp: '93400' };
  const R2 = Object.assign({}, R, { criteres: Object.assign({}, R.criteres, { tresoMax: 400000 }) });
  assert.equal(A.evaluer(a, R2).statut, 'signalee', A.evaluer(a, R2).motifs.join());
  const R3 = Object.assign({}, R, { criteres: Object.assign({}, R.criteres, { tresoMax: 400000, ecartRevente: 60 }) });
  assert.match(A.evaluer(a, R3).motifs.join(), /revente à \+/);
  const R4 = Object.assign({}, R, { criteres: Object.assign({}, R.criteres, { types: ['maison'] }) });
  assert.match(A.evaluer(a, R4).motifs.join(), /type hors critères : appartement/);
});

test('à compléter, exclusions, corrections, baisse de prix', () => {
  assert.equal(A.evaluer({ titre: 'Appartement T2', prix: 90000, cp: '93200' }, R).statut, 'a_completer');
  assert.equal(A.evaluer({ titre: 'Appartement T2', prix: 90000, surface: 40, cp: '75011' }, R).statut, 'a_completer');
  assert.equal(A.evaluer({ titre: 'Appartement en viager occupé', prix: 60000, surface: 50, cp: '93200' }, R).statut, 'ecartee');
  const e = A.evaluer({ titre: 'Appartement T2', prix: 90000, cp: '93200', corrections: { surface: 45 } }, R);
  assert.notEqual(e.statut, 'a_completer');
  const b = A.evaluer({ titre: 'Appartement T2', prix: 70000, prixPrecedent: 80000, surface: 40, cp: '93200' }, R);
  assert.ok(b.signaux.some(s => /baisse de prix de 13 %/.test(s)));
});
