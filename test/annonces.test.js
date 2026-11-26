/* Analyse des annonces (js/annonces.js) : tri en trois étapes
   1. prix affiché ≤ 130 000 € ; 2. argent total à sortir ≤ 140 000 € ; 3. marge brute ≥ 10 % de la revente. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/calc.js');
const A = require('../js/annonces.js');

const R = { taux: 4, obj: 10, part: 50, pfu: 31.4, dmax: 18, tvaT: 10, tvaMode: 'marge',
  criteres: { zone: [], secteurs: [{ cp: '93200', commune: 'Saint-Denis', pm2: 3500 }, { cp: '93400', commune: 'Saint-Ouen', pm2: 3400 }] } };
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
  /* Même calcul que le simulateur, travaux au forfait : (550 €/m² × 42 m² + 800 € × 2 pièces) + 10 % d'aléas = 27 170 € */
  assert.equal(e.travaux.niveau, 'c'); assert.equal(e.travaux.pieces, 2); assert.equal(e.travaux.total, 27170); assert.equal(e.r.T, 27170);
  const S = M.fresh(); S.trvReel = 27170;
  const r = M.compute(S);
  assert.equal(Math.round(e.r.C), Math.round(r.C));
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
  assert.equal(A.evaluer({ titre: 'Appartement T2', prix: 90000, surface: 40, cp: '37000' }, R).statut, 'a_completer', 'code postal sans référence');
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

test('zone : 95 et 75 entiers, communes listées du 92 nord, 93 est et 78 nord', () => {
  const Z = A.CRITERES_DEF.zone;
  assert.equal(A.dansZone({ cp: '95100' }, Z), true, 'Argenteuil, 95');
  assert.equal(A.dansZone({ cp: '75018' }, Z), true, 'Paris 18e');
  assert.equal(A.dansZone({ cp: '93100', ville: 'Montreuil' }, Z), true, '93 est');
  assert.equal(A.dansZone({ cp: '93200', ville: 'Saint-Denis' }, Z), false, '93 ouest : hors zone');
  assert.equal(A.dansZone({ cp: '92600' }, Z), true, '92 nord');
  assert.equal(A.dansZone({ cp: '92100', ville: 'Boulogne-Billancourt' }, Z), false, '92 sud : hors zone');
  assert.equal(A.dansZone({ ville: 'Poissy' }, Z), true, 'commune sans code postal');
  assert.equal(A.dansZone({}, Z), null, 'ni code postal ni commune : à compléter');
  assert.equal(A.dansZone({ cp: '37000' }, []), true, 'zone vide : partout');
  const e = A.evaluer({ titre: 'Appartement T2', prix: 80000, surface: 40, cp: '93200', ville: 'Saint-Denis' }, Object.assign({}, R, { criteres: Object.assign({}, R.criteres, { zone: Z }) }));
  assert.equal(e.statut, 'ecartee'); assert.match(e.motifs.join(), /hors zone/);
});

test('référence DVF : prix par code postal, prix saisi prioritaire, maison à part', () => {
  assert.ok(A.DVF.secteurs.length > 100);
  const sansPerso = Object.assign({}, R, { criteres: { zone: [], secteurs: [] } });
  const e = A.evaluer({ titre: 'Appartement T2', prix: 80000, surface: 40, cp: '93600', ville: 'Aulnay-sous-Bois' }, sansPerso);
  const ref = A.DVF.secteurs.find(s => s.cp === '93600');
  assert.equal(e.secteur.origine, 'DVF'); assert.equal(e.pm2, ref.pm2);
  const m = A.evaluer({ titre: 'Maison 3 pièces', prix: 80000, surface: 60, cp: '93600' }, sansPerso);
  assert.equal(m.pm2, ref.pm2Maison);
  const perso = Object.assign({}, R, { criteres: { zone: [], secteurs: [{ cp: '93600', pm2: 3000 }] } });
  const p = A.evaluer({ titre: 'Appartement T2', prix: 80000, surface: 40, cp: '93600' }, perso);
  assert.equal(p.pm2, 3000); assert.equal(p.secteur.origine, 'saisi');
  assert.equal(A.evaluer({ titre: 'Appartement T2', prix: 80000, ville: 'Poissy', surface: 40 }, sansPerso).secteur.cp, '78300', 'commune sans code postal');
});

test('budget travaux : forfait au m² par niveau, minimum par bien, rafraîchissement par défaut', () => {
  const D = A.CRITERES_DEF.travaux;
  assert.deepEqual([D.r.m2, D.c.m2, D.l.m2, D.r.piece, D.c.piece, D.l.piece, D.r.min, D.c.min, D.l.min, D.defaut], [200, 550, 900, 200, 800, 1200, 3000, 8000, 12000, 'r']);
  const muet = A.evaluer({ titre: 'Appartement 2 pièces', prix: 80000, surface: 40, cp: '93200' }, R);
  assert.equal(muet.travaux.niveau, 'r', 'annonce muette : rafraîchissement'); assert.equal(muet.travaux.ht, 8400, '200 × 40 + 200 × 2 pièces'); assert.equal(muet.travaux.total, 9240);
  const studio = A.evaluer({ titre: 'Studio à rénover', prix: 50000, surface: 12, cp: '93200' }, R);
  assert.equal(studio.travaux.ht, 8000, 'minimum de 8 000 € en rénovation complète');
  const g = A.evaluer({ titre: 'Appartement, DPE G', prix: 60000, surface: 30, cp: '93200', dpe: 'G' }, R);
  assert.equal(g.travaux.niveau, 'c');
  const perso = A.evaluer({ titre: 'Appartement 2 pièces', prix: 80000, surface: 40, cp: '93200' }, avec({ travaux: { r: { m2: 100, min: 1000 }, c: { m2: 400, min: 5000 }, l: { m2: 700, min: 9000 }, defaut: 'c' } }));
  assert.equal(perso.travaux.niveau, 'c'); assert.equal(perso.travaux.ht, 16000, 'critères modifiables');
  assert.equal(A.evaluer({ titre: 'Appartement 2 pièces', prix: 80000, surface: 40, cp: '93200', corrections: { niveau: 'l' } }, R).travaux.ht, 38400, 'correction manuelle du niveau');
  const f3 = A.evaluer({ titre: 'Appartement F3', prix: 80000, surface: 40, cp: '93200', corrections: { niveau: 'c' } }, R), f1 = A.evaluer({ titre: 'Appartement F3', prix: 80000, surface: 40, cp: '93200', corrections: { niveau: 'c', pieces: 1 } }, R);
  assert.equal(f3.pieces, 3); assert.equal(f3.travaux.ht - f1.travaux.ht, 1600, 'deux pièces de plus : 2 × 800 €');
});

test('lecture d\'un texte d\'annonce collé', () => {
  const x = A.lireTexte('Appartement 2 pièces 38 m²\nSevran (93270)\n89 000 €\nDPE : F\nÀ rénover');
  assert.deepEqual([x.prix, x.surface, x.pieces, x.cp, x.ville, x.dpe, x.type], [89000, 38, 2, '93270', 'Sevran', 'F', 'appt']);
  const y = A.lireTexte('Studio 18 m2 - 93140 Bondy - 62 000 €');
  assert.deepEqual([y.prix, y.surface, y.pieces, y.cp, y.ville], [62000, 18, 1, '93140', 'Bondy']);
  assert.equal(A.piecesDepuisTexte('Appartement 2 chambres'), 3);
});
