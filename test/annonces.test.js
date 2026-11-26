/* Analyse des annonces (js/annonces.js) : tri en trois étapes
   1. prix affiché ≤ 130 000 € ; 2. argent total à sortir ≤ 140 000 € ; 3. marge brute ≥ 10 % de la revente. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/calc.js');
const A = require('../js/annonces.js');

const R = { taux: 4, obj: 10, part: 50, pfu: 31.4, dmax: 18, tvaT: 10, tvaMode: 'marge',
  criteres: { secteurs: [{ cp: '93200', commune: 'Saint-Denis', pm2: 3500 }, { cp: '93400', commune: 'Saint-Ouen', pm2: 3400 }] } };
const avec = c => Object.assign({}, R, { criteres: Object.assign({}, R.criteres, c) });

test('critères par défaut', () => {
  assert.equal(A.CRITERES_DEF.prixAfficheMax, 130000);
  assert.equal(A.CRITERES_DEF.tresoMax, 140000);
  assert.equal(A.CRITERES_DEF.margeBruteMin, 10);
  assert.deepEqual(A.CRITERES_DEF.types, ['appt', 'maison', 'local', 'box']);
});

test('étape 1 : prix affiché au-dessus de 130 000 € : écartée d\'office, sans calcul', () => {
  const e = A.evaluer({ titre: 'Appartement 3 pièces à rénover', prix: 149000, surface: 58, cp: '93200' }, R);
  assert.equal(e.statut, 'ecartee'); assert.match(e.motifs.join(), /prix affiché au-dessus de 130/); assert.equal(e.r, undefined);
});

test('l\'exemple d\'arbitrage : 130 000 € en bon état, revendu 170 000 €, est retenu', () => {
  const a = { titre: 'Appartement 2 pièces bon état', prix: 130000, surface: 50, cp: '93400' };
  const e = A.evaluer(a, R);
  assert.equal(e.vente, 170000); assert.equal(e.niveau, 'r');
  assert.ok(e.margeBrute > 0.10, 'marge brute au prix affiché ' + e.margeBrute);
  assert.ok(e.tresoAffiche > 140000, 'au prix affiché, plus de 140 000 € à sortir');
  assert.equal(e.statut, 'signalee', e.motifs.join());
  assert.ok(e.tresoAuMax <= 140000 + 1, 'au prix maximum, l\'argent à sortir tient sous 140 000 €');
  assert.ok(e.nego > 0 && e.nego <= 0.15, 'négociation nécessaire : ' + e.nego);
});

test('étape 2 : 120 000 € avec gros travaux : argent à sortir trop élevé, écartée', () => {
  const e = A.evaluer({ titre: 'Appartement 3 pièces à rénover entièrement', prix: 120000, surface: 65, cp: '93400' }, R);
  assert.equal(e.statut, 'ecartee'); assert.match(e.motifs.join(), /argent à sortir/);
});

test('étape 3 : marge brute calculée comme dans le simulateur', () => {
  const e = A.evaluer({ titre: 'Appartement 2 pièces à rénover', prix: 82000, surface: 42, cp: '93200' }, R);
  const r = M.compute(M.fresh());
  assert.equal(Math.round(e.r.C), Math.round(r.C), 'coût de revient de l\'exemple du brief : 127 491 €');
  assert.equal(Math.round(e.margeBruteEur), Math.round(r.vente - r.C));
  assert.equal(e.margeBrute, (r.vente - r.C) / r.vente);
  assert.equal(e.statut, 'signalee');
  const e2 = A.evaluer({ titre: 'Appartement 2 pièces à rénover', prix: 82000, surface: 42, cp: '93200' }, avec({ margeBruteMin: 25, negoMax: 5 }));
  assert.equal(e2.statut, 'ecartee'); assert.match(e2.motifs.join(), /marge brute/);
});

test('critères modifiables, 0 désactive un plafond', () => {
  const a = { titre: 'Appartement 3 pièces à rénover', prix: 149000, surface: 58, cp: '93200' };
  assert.notEqual(A.evaluer(a, avec({ prixAfficheMax: 0, tresoMax: 0, margeBruteMin: 0 })).statut, 'ecartee');
  assert.match(A.evaluer({ titre: 'Appartement T2', prix: 90000, surface: 40, cp: '93200' }, avec({ types: ['maison'] })).motifs.join(), /type hors critères/);
});

test('immeubles, terrains, viager, données manquantes, corrections, baisse de prix', () => {
  assert.match(A.evaluer({ titre: 'Immeuble de 4 appartements', prix: 839000, surface: 120, cp: '93200' }, R).motifs.join(), /type hors critères : immeuble/);
  assert.equal(A.evaluer({ titre: 'Terrain constructible', prix: 60000, surface: 500, cp: '93200' }, R).statut, 'ecartee');
  assert.equal(A.evaluer({ titre: 'Appartement en viager occupé', prix: 60000, surface: 50, cp: '93200' }, R).statut, 'ecartee');
  assert.equal(A.evaluer({ titre: 'Appartement T2', prix: 90000, cp: '93200' }, R).statut, 'a_completer');
  assert.equal(A.evaluer({ titre: 'Appartement T2', prix: 90000, surface: 40, cp: '75011' }, R).statut, 'a_completer');
  assert.notEqual(A.evaluer({ titre: 'Appartement T2', prix: 90000, cp: '93200', corrections: { surface: 45 } }, R).statut, 'a_completer');
  const b = A.evaluer({ titre: 'Appartement T2', prix: 70000, prixPrecedent: 80000, surface: 40, cp: '93200' }, R);
  assert.ok(b.signaux.some(s => /baisse de prix de 13 %/.test(s)));
});

test('type et niveau de travaux déduits du texte', () => {
  assert.equal(A.typeDepuisTexte('Pavillon 5 pièces'), 'maison');
  assert.equal(A.typeDepuisTexte('Lot de 6 boxes fermés'), 'box');
  assert.equal(A.niveauDepuisTexte('Appartement à rafraîchir'), 'r');
  assert.equal(A.niveauDepuisTexte('T2 bon état', 'G'), 'c', 'DPE G : rénovation complète');
});
