/* Tests du moteur de calcul : node --test mdb/test/
   1. Valeurs de contrôle du brief (exemple par défaut).
   2. Équivalence stricte avec le moteur du simulateur d'origine, sur des milliers d'états tirés au hasard.
   3. Repères modifiables, coût réel des travaux, suivi de chantier. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../js/calc.js');

/* Moteur d'origine, extrait tel quel du fichier de référence */
function moteurOrigine() {
  const html = fs.readFileSync(path.join(__dirname, '../reference/simulateur-marchand-de-biens.html'), 'utf8');
  const a = html.indexOf('/* ============ données ============ */');
  const b = html.indexOf('/* ============ interface ============ */');
  assert.ok(a > 0 && b > a, 'moteur introuvable dans le fichier de référence');
  const ctx = { module: { exports: {} } };
  vm.runInNewContext(html.slice(a, b), ctx);
  /* applyLevel n'est pas exporté par l'original : les fonctions déclarées sont visibles dans le contexte */
  return Object.assign({ applyLevel: ctx.applyLevel }, ctx.module.exports);
}
const O = moteurOrigine();
const eur = n => Math.round(n);

test('valeurs de contrôle du brief', () => {
  M.setRef(null);
  const S = M.fresh(), r = M.compute(S), L = M.limits(S);
  assert.equal(eur(r.not), 2821, 'frais de notaire');
  assert.equal(eur(r.T), 37565, 'travaux HT aléas compris');
  assert.equal(eur(r.C), 127491, 'coût de revient');
  assert.equal(eur(r.tva), 10833, 'TVA sur la marge');
  assert.equal(eur(r.N), 4123, 'bénéfice net');
  assert.equal(Math.round(r.m * 1000) / 10, 3.2, 'marge nette');
  assert.equal(eur(L.achatMax), 71847, "prix d'achat maximum pour 10 %");
  assert.equal(eur(r.treso), 131248, 'trésorerie maximale');
});

test('frais de notaire au barème', () => {
  for (const a of [0, 5000, 6500, 17000, 60000, 82000, 250000, 1e6]) assert.equal(M.notaire(a), O.notaire(a), 'achat ' + a);
  assert.equal(M.notaire(0), 1115, 'CSI 15 € minimum + formalités');
});

/* Générateur pseudo-aléatoire reproductible */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function etatAleatoire(rand, mod) {
  const types = Object.keys(mod.TYPES), pick = a => a[Math.floor(rand() * a.length)];
  const S = mod.fresh(); mod.setType(S, pick(types));
  S.surf = Math.round(10 + rand() * 300); S.pieces = 1 + Math.floor(rand() * 8);
  S.achat = Math.round(20000 + rand() * 300000); S.vente = Math.round(S.achat * (0.8 + rand() * 1.4));
  S.duree = 1 + Math.floor(rand() * 24); S.gamme = pick([0.8, 1, 1.25]); S.aleas = pick([0, 5, 10, 15]);
  S.taux = pick([0, 3, 4, 6, 8]); S.obj = pick([5, 10, 15]); S.part = pick([30, 50, 70]); S.tvaT = pick([5.5, 10, 20]);
  S.tvaMode = pick(['marge', 'total', 'aucune']); S.agA = pick([0, 3000]); S.agV = pick([0, 3, 5]);
  S.niveau = pick(['r', 'c', 'l']); mod.applyLevel(S);
  if (rand() < .3) S.notaire = Math.round(rand() * 9000);
  S.m1 = [rand() < .3, rand() < .3, rand() < .3]; S.m2 = [rand() < .3, rand() < .3, rand() < .3];
  Object.keys(S.w).forEach(k => { if (rand() < .2) S.w[k].on = !S.w[k].on; if (rand() < .15) S.w[k].val = Math.round(rand() * 8000); });
  Object.keys(S.x).forEach(k => { if (rand() < .2) S.x[k].on = !S.x[k].on; if (rand() < .15) S.x[k].val = Math.round(rand() * 3000); });
  return S;
}

test('équivalence avec le moteur d\'origine (3 000 états)', () => {
  M.setRef(null);
  const ra = rng(42);
  for (let n = 0; n < 3000; n++) {
    const seed = Math.floor(ra() * 1e9);
    const S1 = etatAleatoire(rng(seed), O), S2 = etatAleatoire(rng(seed), M);
    const a = O.compute(S1), b = M.compute(S2);
    for (const k of ['achat', 'vente', 'duree', 'T', 'not', 'acq', 'anx', 'agV', 'mis', 'misPct', 'C', 'tva', 'int', 'R', 'is', 'N', 'm', 'treso'])
      assert.equal(b[k], a[k], `état ${n} (${S1.type}) : ${k}`);
    assert.deepEqual({ base: b.tr.base, ref: b.tr.ref, tot: b.tr.tot }, { base: a.tr.base, ref: a.tr.ref, tot: a.tr.tot }, `état ${n} : travaux`);
    if (n % 10 === 0) assert.deepEqual({ ...M.limits(S2) }, { ...O.limits(S1) }, `état ${n} : limites`);
  }
});

test('repères affichés identiques (libellés et montants)', () => {
  M.setRef(null);
  for (const t of Object.keys(M.TYPES)) {
    const S1 = O.fresh(), S2 = M.fresh(); O.setType(S1, t); M.setType(S2, t);
    assert.deepEqual(JSON.parse(JSON.stringify(M.travaux(S2))), JSON.parse(JSON.stringify(O.travaux(S1))), 'travaux ' + t);
    assert.deepEqual(JSON.parse(JSON.stringify(S2.w)), JSON.parse(JSON.stringify(S1.w)), 'postes cochés ' + t);
    assert.deepEqual(JSON.parse(JSON.stringify(S2.x)), JSON.parse(JSON.stringify(S1.x)), 'annexes cochées ' + t);
  }
});

test('repères modifiables', () => {
  const S = M.fresh(), avant = M.compute(S);
  M.setRef({ w: { elec: 120 }, x: { photo: 500 } });
  const apres = M.compute(S);
  assert.equal(M.wDef(M.W.find(i => i.id === 'elec'), S).v, 5050, '120 €/m² × 42 m² arrondi à 50 €');
  assert.ok(apres.C > avant.C);
  M.setRef(null);
  assert.equal(M.compute(S).C, avant.C, 'retour aux repères par défaut');
  assert.ok(M.REF_ESTIME.every(k => { const [g, id] = k.split('.'); return id in M.REF_DEF[g]; }), 'repères estimés tous connus');
});

test('coût réel des travaux à la place du budget', () => {
  M.setRef(null);
  const S = M.fresh(), base = M.compute(S);
  S.trvReel = 45000;
  const r = M.compute(S);
  assert.equal(r.T, 45000); assert.ok(r.reel);
  assert.ok(r.N < base.N);
  S.trvReel = base.T;
  assert.equal(M.compute(S).N, base.N, 'même montant, même bénéfice');
});

test('partage et revenus de l\'associé investisseur', () => {
  M.setRef(null);
  const S = M.fresh(), r = M.compute(S), p = M.partage(S, r);
  assert.equal(eur(p.operateur.dividendes), eur(r.N * .5));
  assert.equal(eur(p.operateur.prelevement), eur(r.N * .5 * .314));
  assert.equal(eur(p.investisseur.brut), eur(r.int + r.N * .5));
  assert.equal(eur(p.investisseur.is), eur((r.int + r.N * .5 * .05) * .15));
});

test('contrôles, comparables et scénarios', () => {
  M.setRef(null);
  const S = M.fresh();
  S.comps = 'Rue A;40;140000;2026-03\nRue B;45;162000\nRue C;38;125400';
  S.abf = 'Non'; S.preempt = 'Oui';
  const A = M.analyse(S);
  assert.equal(A.comp.comps.length, 3);
  assert.equal(Math.round(A.comp.moy), Math.round((3500 + 3600 + 3300) / 3));
  assert.equal(A.controles.score, 3, 'marge sous 10 % : 3 contrôles sur 4');
  assert.equal(A.scenarios.length, 7);
  assert.equal(A.scenarios[0].N, A.r.N);
  assert.equal(A.lim.achatMax, 71500);
  assert.equal(A.etat, 'ko');
});

test('suivi de chantier', () => {
  M.setRef(null);
  const S = M.fresh(), L = M.lignesChantier(S);
  assert.equal(L.reduce((t, x) => t + x.budget, 0), M.travaux(S).base, 'les postes cochés portent tout le budget');
  const lignes = L.map(x => ({ budget: x.budget, devis: 0, facture: 0, paye: 0, avancement: 0 }));
  lignes[0].devis = lignes[0].budget * 1.1; lignes[0].facture = 1000; lignes[0].paye = 800; lignes[0].avancement = 50;
  const T = M.totauxChantier(lignes, S.aleas);
  assert.equal(T.budget, M.travaux(S).tot);
  assert.equal(T.reste, T.engage - 800);
  assert.equal(T.alerte, false);
  lignes.forEach(x => { x.devis = x.budget * 1.3; });
  const T2 = M.totauxChantier(lignes, S.aleas);
  assert.ok(T2.depassement > .15 && T2.alerte, 'dépassement au-delà de 15 % des devis sur le budget aléas compris');
  assert.equal(M.totauxChantier(lignes, S.aleas, 25).alerte, false, 'seuil réglable');
});

test('normalisation d\'un état ancien', () => {
  const S = M.normalize({ type: 'maison', surf: 80, w: {}, x: {} });
  assert.equal(S.trvReel, null);
  assert.ok(S.w.elec && S.x.photo);
  assert.equal(M.normalize(null).type, 'appt');
});
