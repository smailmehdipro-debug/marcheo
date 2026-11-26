/* Moteur de calcul · opération de marchand de biens
   Module pur : aucune dépendance à l'interface, au stockage ou au navigateur.
   Reprend à l'identique les règles du simulateur d'origine (marcheo/reference/simulateur-marchand-de-biens.html) :
   notaire, travaux, compute, limits, tableaux W, X, TYPES, M1, M2.
   Seule évolution : les prix unitaires (« repères ») sont lus dans un tableau REF modifiable,
   dont les valeurs par défaut sont celles du simulateur. Le calcul est inchangé tant que REF n'est pas modifié.
   Ajouts pour le CRM, sans effet sur le calcul par défaut :
   - S.trvReel (nombre ou null) : coût réel des travaux HT, qui remplace le budget pour recalculer la marge en cours de chantier ;
   - fonctions dérivées (partage, contrôles, comparables, scénarios, indicateurs) sorties de l'ancien affichage. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MDB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const r50 = n => Math.round(n / 50) * 50;
  const ALLB = ['appt', 'maison', 'local'];

  /* ---------- Repères : valeurs par défaut (relevé fin novembre 2026) ----------
     src : 'verifie' quand une source existe, 'estime' quand la valeur est une estimation sans source vérifiée. */
  const REF_DEF = {
    w: {
      demo: 40, macon: 60, vitrine: 6000, raccord: 3500, cloisons: 45, isol: 70, elec: 100, plomb: 70, chauf: 60,
      ecs: 900, vmc: 900, fen: 850, portes: 350, pentree: 1500, sols: 50, enduit: 35, peint: 30, sdb: 6000, wc: 700,
      cuis: 4500, retouch: 25, deco: 40, deco_min: 1500, nett: 8, toit: 90, facade: 50, assain: 8000,
      bporte: 900, bpeint: 300, bserr: 80, belec: 250, betanch: 60, tviab: 8000, tacces: 3000, tdebr: 2000
    },
    x: {
      plans_m2: 10, plans_min: 500, archi_local: 2500, archi: 1500, struct: 1200, geo_terrain: 2500, geo: 1800,
      sol_lot: 1000, modif: 2000, do_pct: 3, do_min: 3000, copro_box: 8, copro_m2: 3, tf_terrain: 0.3, tf_box: 10,
      tf_m2: 15, assur: 30, abo: 40, diag_maison: 605, diag_box: 150, diag_terrain: 50, diag_appt: 375, audit: 700,
      edate: 380, photo: 300, compta: 1200, banque: 15, banque_min: 100
    }
  };
  /* Repères signalés comme estimations sans source vérifiée (brief, « À savoir sur les repères de prix »). */
  const REF_ESTIME = ['x.plans_m2', 'x.plans_min', 'x.copro_box', 'x.copro_m2', 'x.tf_terrain', 'x.tf_box', 'x.tf_m2',
    'x.assur', 'x.compta', 'w.demo', 'w.cloisons', 'w.chauf', 'w.enduit', 'w.deco', 'w.deco_min'];

  let REF = clone(REF_DEF);
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* Remplace des repères : setRef({w:{elec:110}, x:{photo:350}}). Les clés absentes gardent leur valeur par défaut. */
  function setRef(over) {
    REF = clone(REF_DEF);
    if (over) ['w', 'x'].forEach(g => Object.keys(over[g] || {}).forEach(k => {
      const v = Number(over[g][k]); if (k in REF[g] && isFinite(v) && v >= 0) REF[g][k] = v;
    }));
    return REF;
  }
  const getRef = () => REF;
  const fr = n => n.toLocaleString('fr-FR');

  /* ---------- Postes de travaux ---------- */
  const W = [
    { id: 'demo', l: 'Démolition, curage, évacuation', per: 'm2', lv: 'cl' },
    { id: 'macon', l: 'Maçonnerie, ouvertures, reprises', per: 'm2', lv: 'l' },
    { id: 'vitrine', l: 'Dépose de la vitrine, nouvelle façade et menuiseries', per: 'f', t: ['local'], on: 1 },
    { id: 'raccord', l: 'Création des évacuations et raccordements', per: 'f', t: ['local'], on: 1 },
    { id: 'cloisons', l: 'Cloisons, doublages, faux plafonds', per: 'm2', lv: 'cl' },
    { id: 'isol', l: "Isolation des murs par l'intérieur", per: 'm2', lv: 'l' },
    { id: 'elec', l: 'Électricité complète, tableau, mise aux normes', per: 'm2', lv: 'cl' },
    { id: 'plomb', l: 'Plomberie, alimentations et évacuations', per: 'm2', lv: 'cl' },
    { id: 'chauf', l: 'Chauffage, radiateurs électriques', per: 'm2', lv: 'cl' },
    { id: 'ecs', l: "Ballon d'eau chaude", per: 'f', lv: 'cl' },
    { id: 'vmc', l: 'Ventilation mécanique', per: 'f', lv: 'cl' },
    { id: 'fen', l: 'Fenêtres double vitrage', per: 'fen', lv: 'l' },
    { id: 'portes', l: 'Portes intérieures', per: 'porte', lv: 'cl' },
    { id: 'pentree', l: "Porte d'entrée", per: 'f', lv: 'l' },
    { id: 'sols', l: 'Sols, parquet ou carrelage', per: 'm2', lv: 'rcl' },
    { id: 'enduit', l: 'Enduits, bandes, ratissage des murs et plafonds', per: 'm2', lv: 'cl' },
    { id: 'peint', l: 'Peinture murs et plafonds', per: 'm2', lv: 'rcl' },
    { id: 'sdb', l: 'Salle de bain complète', per: 'f', lv: 'cl' },
    { id: 'wc', l: 'WC', per: 'f', lv: 'cl' },
    { id: 'cuis', l: 'Cuisine équipée posée', per: 'f', lv: 'cl' },
    { id: 'retouch', l: 'Petites reprises : prises, robinetterie, joints', per: 'm2', lv: 'r' },
    { id: 'deco', l: 'Décoration et mise en scène pour vendre plus vite', per: 'm2', min: 'deco_min', lv: 'rcl' },
    { id: 'nett', l: 'Nettoyage de fin de chantier', per: 'm2', lv: 'rcl' },
    { id: 'toit', l: 'Toiture, révision ou réfection', per: 'm2', t: ['maison'], on: 0 },
    { id: 'facade', l: 'Ravalement de façade', per: 'm2', t: ['maison'], on: 0 },
    { id: 'assain', l: 'Assainissement, raccordement', per: 'f', t: ['maison'], on: 0 },
    { id: 'bporte', l: 'Portes de garage', per: 'unit', un: 'boxes', t: ['box'], on: 0 },
    { id: 'bpeint', l: 'Peinture des sols et des murs', per: 'unit', un: 'boxes', t: ['box'], on: 1 },
    { id: 'bserr', l: 'Serrures, numérotation, signalétique', per: 'unit', un: 'boxes', t: ['box'], on: 1 },
    { id: 'belec', l: 'Éclairage et électricité', per: 'unit', un: 'boxes', t: ['box'], on: 0 },
    { id: 'betanch', l: 'Étanchéité de toiture', per: 'm2', t: ['box'], on: 0 },
    { id: 'tviab', l: 'Viabilisation : eau, électricité, télécom, assainissement', per: 'unit', un: 'lots', t: ['terrain'], on: 0 },
    { id: 'tacces', l: 'Accès, clôture, portail', per: 'unit', un: 'lots', t: ['terrain'], on: 0 },
    { id: 'tdebr', l: 'Débroussaillage, abattage, démolition', per: 'f', t: ['terrain'], on: 1 }
  ];
  const vis = (i, type) => (i.t || ALLB).includes(type);
  /* Repère d'un poste de travaux : {v: montant, h: détail du calcul} */
  function wDef(it, S) {
    const g = S.gamme, u = REF.w[it.id] * g, min = it.min ? REF.w[it.min] : 0;
    if (it.per === 'm2') return { v: Math.max(min, r50(u * S.surf)), h: Math.round(u) + ' €/m² × ' + S.surf + ' m²' + (min ? ', ' + fr(min) + ' € minimum' : '') };
    if (it.per === 'fen') { const q = S.pieces + 1; return { v: r50(u * q), h: q + ' fenêtres × ' + Math.round(u) + ' €' }; }
    if (it.per === 'porte') { const q = S.pieces + 1; return { v: r50(u * q), h: q + ' portes × ' + Math.round(u) + ' €' }; }
    if (it.per === 'unit') return { v: r50(u * S.pieces), h: S.pieces + ' ' + it.un + ' × ' + Math.round(u) + ' €' };
    return { v: r50(u), h: 'forfait' };
  }

  /* ---------- Frais annexes ----------
     d(S, durée, travaux, revente) -> {v, h} ; on = coché par défaut ; onT = coché pour ces types ; t = types concernés */
  const X = [
    { g: 'Études et autorisations' },
    { id: 'plans', l: "Plans et relevé de l'existant", on: 1, t: ALLB, d: S => ({ v: Math.max(REF.x.plans_min, r50(REF.x.plans_m2 * S.surf)), h: fr(REF.x.plans_m2) + ' €/m², ' + fr(REF.x.plans_min) + ' € minimum' }) },
    { id: 'archi', l: 'Architecte, déclaration préalable ou permis', on: 0, onT: ['local'], t: ALLB, d: S => S.type === 'local' ? { v: REF.x.archi_local, h: 'changement de destination et façade' } : { v: REF.x.archi, h: 'forfait, si façade modifiée' } },
    { id: 'struct', l: "Bureau d'études structure", on: 0, t: ALLB, d: () => ({ v: REF.x.struct, h: 'forfait, si mur porteur' }) },
    { id: 'geo', l: 'Géomètre : bornage, division, état descriptif', on: 0, onT: ['box', 'terrain'], d: S => S.type === 'terrain' ? { v: REF.x.geo_terrain, h: 'bornage et division' } : { v: REF.x.geo, h: 'division, 700 à 1 800 €' } },
    { id: 'sol', l: 'Étude de sol', on: 1, t: ['terrain'], d: S => ({ v: REF.x.sol_lot * S.pieces, h: fr(REF.x.sol_lot) + ' € par lot' }) },
    { id: 'modif', l: 'Modificatif du règlement de copropriété', on: 0, onT: ['local'], t: ['local', 'box'], d: () => ({ v: REF.x.modif, h: 'forfait, géomètre et notaire' }) },
    { id: 'do', l: 'Assurance dommages-ouvrage', on: 0, t: ALLB, d: (S, du, T) => ({ v: Math.max(REF.x.do_min, r50(T * REF.x.do_pct / 100)), h: fr(REF.x.do_pct) + ' % des travaux, ' + fr(REF.x.do_min) + ' € minimum' }) },
    { g: 'Portage' },
    { id: 'copro', l: 'Charges de copropriété', on: 1, t: ['appt', 'local', 'box'], d: (S, du) => S.type === 'box' ? { v: r50(REF.x.copro_box * S.pieces * du), h: fr(REF.x.copro_box) + ' € par box et par mois × ' + du + ' mois' } : { v: r50(REF.x.copro_m2 * S.surf * du), h: fr(REF.x.copro_m2) + ' €/m²/mois × ' + du + ' mois' } },
    { id: 'tf', l: 'Taxe foncière au prorata', on: 1, d: (S, du) => { const u = S.type === 'terrain' ? REF.x.tf_terrain : S.type === 'box' ? REF.x.tf_box : REF.x.tf_m2; return { v: r50(u * S.surf * du / 12), h: fr(u) + ' €/m²/an × ' + du + ' mois' }; } },
    { id: 'assur', l: 'Assurance propriétaire et chantier', on: 1, d: (S, du) => ({ v: r50(REF.x.assur * du), h: fr(REF.x.assur) + ' €/mois × ' + du + ' mois' }) },
    { id: 'abo', l: 'Eau et électricité de chantier', on: 1, t: ALLB, d: (S, du) => ({ v: r50(REF.x.abo * du), h: fr(REF.x.abo) + ' €/mois × ' + du + ' mois' }) },
    { g: 'Revente' },
    { id: 'diag', l: 'Diagnostics de vente : DPE, amiante, plomb, électricité, gaz, surface', on: 1, d: S => S.type === 'maison' ? { v: REF.x.diag_maison, h: 'pack maison, 500 à 700 €' } : S.type === 'box' ? { v: REF.x.diag_box, h: 'état des risques, amiante' } : S.type === 'terrain' ? { v: REF.x.diag_terrain, h: 'état des risques' } : { v: REF.x.diag_appt, h: 'pack appartement, 295 à 485 €' } },
    { id: 'audit', l: 'Audit énergétique', on: 0, t: ['maison'], d: () => ({ v: REF.x.audit, h: 'forfait, maison classée E, F ou G' }) },
    { id: 'edate', l: 'État daté du syndic', on: 1, t: ['appt', 'local', 'box'], d: S => S.type === 'box' ? { v: REF.x.edate * S.pieces, h: fr(REF.x.edate) + ' € par box vendu' } : { v: REF.x.edate, h: 'plafond légal' } },
    { id: 'photo', l: 'Photos et annonces', on: 1, d: () => ({ v: REF.x.photo, h: 'forfait' }) },
    { g: 'Société' },
    { id: 'compta', l: "Comptabilité et juridique de l'opération", on: 1, d: () => ({ v: REF.x.compta, h: 'forfait' }) },
    { id: 'banque', l: 'Frais bancaires', on: 1, d: (S, du) => ({ v: r50(Math.max(REF.x.banque_min, REF.x.banque * du)), h: fr(REF.x.banque) + ' €/mois' }) }
  ];
  const xVis = (i, type) => !i.t || i.t.includes(type);
  const XI = X.filter(x => x.id);

  /* ---------- Prestations de la société partenaire (en % du prix de revente) ---------- */
  const M1 = [['Trouver le bien', 0.7], ["Sécuriser l'achat et suivre le notaire", 0.3], ['Revendre', 1]];
  const M2 = [['Préparer le chantier', 0.5], ['Piloter les travaux', 1], ['Livrer et remettre le dossier', 0.5]];

  /* ---------- Types de biens ---------- */
  const TYPES = {
    appt: { ql: 'Prix au m² du quartier, rénové (€)', n: 'Appartement', sl: 'Surface (m²)', pl: 'Pièces', note: 'Rénovation et revente à un occupant.', p: { surf: 42, pieces: 2, achat: 82000, vente: 147000, duree: 9, niveau: 'c', pm2: 3500 } },
    maison: { ql: 'Prix au m² du quartier, rénové (€)', n: 'Maison', sl: 'Surface (m²)', pl: 'Pièces', note: 'Postes toiture, façade et assainissement disponibles en bas de la liste des travaux.', p: { surf: 70, pieces: 3, achat: 70000, vente: 170000, duree: 11, niveau: 'c', pm2: 2400 } },
    local: { ql: 'Prix au m² des logements du quartier (€)', n: 'Local commercial', sl: 'Surface (m²)', pl: 'Pièces créées', note: 'Transformation en logement : changement de destination, façade et accord de la copropriété.', p: { surf: 45, pieces: 2, achat: 50000, vente: 165000, duree: 12, niveau: 'l', pm2: 3650 } },
    box: { ql: "Prix d'un box dans le quartier (€)", n: 'Lot de boxes', sl: 'Surface totale (m²)', pl: 'Nombre de boxes', note: "Achat en bloc, revente à l'unité. Le prix de revente est le total de tous les boxes.", p: { surf: 120, pieces: 8, achat: 76000, vente: 108000, duree: 8, niveau: 'c', pm2: 13500 } },
    terrain: { ql: 'Prix au m² du terrain à bâtir (€)', n: 'Terrain à diviser', sl: 'Surface du terrain (m²)', pl: 'Lots à vendre', note: 'Division parcellaire. Le prix de revente est le total des lots.', p: { surf: 1000, pieces: 2, achat: 70000, vente: 120000, duree: 12, niveau: 'c', pm2: 120 } }
  };
  const NIVEAUX = { r: 'Rafraîchissement', c: 'Rénovation complète', l: 'Rénovation lourde' };
  const GAMMES = { '0.8': 'Éco, piloté en direct', '1': 'Standard', '1.25': 'Soigné' };

  /* ---------- État d'une simulation ---------- */
  const DEF = {
    type: 'appt', surf: 42, pieces: 2, duree: 9, achat: 82000, vente: 147000, pm2: 3500, niveau: 'c', gamme: 1, aleas: 10,
    taux: 4, obj: 10, env: 130000, part: 50, pfu: 31.4, tvaT: 10, tvaMode: 'marge', agA: 0, agV: 0, notaire: null, w: {}, x: {},
    m1: [false, false, false], m2: [false, false, false], comps: '', abf: '', preempt: '', dmax: 18, adresse: '',
    trvReel: null
  };
  function applyLevel(S) { W.forEach(i => { const p = S.w[i.id] || { val: null }; p.on = vis(i, S.type) && (i.on != null ? !!i.on : i.lv.includes(S.niveau)); S.w[i.id] = p; }); }
  function initLines(S) { S.w = {}; S.x = {}; S.notaire = null; applyLevel(S); XI.forEach(i => S.x[i.id] = { on: !!(i.on || (i.onT && i.onT.includes(S.type))), val: null }); }
  function setType(S, t) { S.type = t; Object.assign(S, TYPES[t].p); initLines(S); }
  function fresh(type) { const S = clone(DEF); initLines(S); if (type && type !== 'appt' && TYPES[type]) setType(S, type); return S; }
  /* Complète un état ancien ou partiel (lignes manquantes, champs ajoutés depuis) sans toucher aux valeurs saisies. */
  function normalize(S) {
    if (!S || typeof S !== 'object' || !TYPES[S.type]) return fresh();
    Object.keys(DEF).forEach(k => { if (S[k] == null && DEF[k] != null) S[k] = clone(DEF[k]); });
    if (S.pm2 == null) S.pm2 = TYPES[S.type].p.pm2;
    if (!S.w || typeof S.w !== 'object') S.w = {};
    if (!S.x || typeof S.x !== 'object') S.x = {};
    W.forEach(i => { if (!S.w[i.id]) S.w[i.id] = { on: false, val: null }; });
    XI.forEach(i => { if (!S.x[i.id]) S.x[i.id] = { on: !!i.on, val: null }; });
    if (!('trvReel' in S)) S.trvReel = null;
    return S;
  }

  /* ---------- Calcul ---------- */
  /* Frais de notaire, régime marchand de biens : droits 0,715 %, émoluments par tranches,
     contribution de sécurité immobilière 0,10 % (15 € minimum), formalités 1 100 €. */
  function notaire(a) {
    const tr = [[6500, .0387], [17000, .01596], [60000, .01064], [Infinity, .00799]];
    let e = 0, prev = 0; for (const [lim, t] of tr) { if (a > prev) { e += (Math.min(a, lim) - prev) * t; prev = lim; } }
    return Math.round(a * 0.00715 + e + Math.max(15, a * 0.001) + 1100);
  }
  function travaux(S) {
    let base = 0, ref = 0, top = null;
    W.forEach(i => {
      if (!vis(i, S.type)) return; const p = S.w[i.id]; if (!p.on) return;
      const d = wDef(i, S).v, v = p.val == null ? d : p.val; base += v; ref += d; if (!top || v > top.v) top = { l: i.l, v };
    });
    return { base, ref, tot: base * (1 + S.aleas / 100), top };
  }
  /* o : surcharges pour les limites et les scénarios {achat, vente, duree, tf (facteur travaux)} */
  function compute(S, o = {}) {
    const achat = o.achat ?? S.achat, vente = o.vente ?? S.vente, duree = o.duree ?? S.duree, tf = o.tf ?? 1;
    const tr = travaux(S), reel = S.trvReel != null && isFinite(S.trvReel), T = (reel ? S.trvReel : tr.tot) * tf;
    const not = S.notaire == null ? notaire(achat) : S.notaire;
    let anx = 0; XI.forEach(i => { if (!xVis(i, S.type)) return; const p = S.x[i.id]; if (!p.on) return; anx += p.val == null ? i.d(S, duree, T, vente).v : p.val; });
    const agV = vente * S.agV / 100, acq = not + S.agA;
    const misPct = M1.reduce((t, p, i) => t + (S.m1[i] ? p[1] : 0), 0) + M2.reduce((t, p, i) => t + (S.m2[i] ? p[1] : 0), 0), mis = vente * misPct / 100;
    const C = achat + acq + T + anx + agV + mis;
    const tva = S.tvaMode === 'marge' ? Math.max(0, (vente - achat) / 6) : S.tvaMode === 'total' ? vente / 6 : 0;
    const int = C * S.taux / 100 * duree / 12;
    const R = vente - C - tva - int;
    const is = R <= 0 ? 0 : Math.min(R, 42500) * .15 + Math.max(0, R - 42500) * .25;
    const N = R - is;
    return { achat, vente, duree, T, tr, reel, not, acq, anx, agV, mis, misPct, C, tva, int, R, is, N, m: C > 0 ? N / C : 0, treso: C - agV - mis + T * S.tvaT / 100 };
  }
  function solve(f, lo, hi, up) { for (let k = 0; k < 45; k++) { const mid = (lo + hi) / 2; (f(mid) ? up : !up) ? lo = mid : hi = mid; } return (lo + hi) / 2; }
  function limits(S) {
    const t = S.obj / 100, ok = o => compute(S, o).m >= t;
    return {
      achatMax: ok({ achat: 0 }) ? solve(a => ok({ achat: a }), 0, S.vente, true) : 0,
      venteMin: solve(v => ok({ vente: v }), 0, S.vente * 3 + 1, false),
      venteZero: solve(v => compute(S, { vente: v }).N >= 0, 0, S.vente * 3 + 1, false),
      tfMax: ok({ tf: 0 }) ? solve(f => ok({ tf: f }), 0, 4, true) : 0,
      retard: (() => { if (!ok({})) return -1; let k = 0; while (k < 36 && ok({ duree: S.duree + k + 1 })) k++; return k; })()
    };
  }

  /* ---------- Grandeurs dérivées (sorties de l'ancien affichage, mêmes formules) ---------- */
  const unite = S => S.type === 'box' ? { q: S.pieces || 1, s: ' /box', w: 'le box' } : { q: S.surf || 1, s: ' /m²', w: 'le m²' };
  /* État de la marge par rapport à l'objectif : 'ok' (atteint), 'juste' (au moins la moitié), 'ko' */
  const etat = (m, obj) => { const t = obj / 100; return m >= t ? 'ok' : m >= t / 2 ? 'juste' : 'ko'; };

  function partage(S, r) {
    const pos = Math.max(0, r.N), mine = pos * S.part / 100, pfu = mine * S.pfu / 100, droits = r.achat * 0.00715;
    const hDiv = pos * (100 - S.part) / 100, hBrut = r.int + hDiv, hIS = (r.int + hDiv * 0.05) * 0.15, hRend = r.treso ? (hBrut - hIS) / r.treso : 0;
    return {
      brut: r.vente - r.C, droits,
      operateur: { dividendes: mine, prelevement: pfu, net: mine - pfu },
      investisseur: { capital: r.treso, interets: r.int, dividendes: hDiv, brut: hBrut, is: hIS, net: hBrut - hIS, rendement: hRend, rendementAn: hRend * 12 / (r.duree || 1) },
      fiscalite: droits + r.tva + r.is + pfu,
      tvaTravaux: r.T * S.tvaT / 100
    };
  }

  function parseComps(txt) {
    const out = []; String(txt || '').split(/\r?\n/).forEach(line => {
      if (!line.trim()) return; const c = line.split(/;|\t/).map(x => x.trim()); if (c.length < 3) return;
      const n = v => { const x = parseFloat(String(v).replace(/[^0-9,.\-]/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
      const surf = n(c[1]), prix = n(c[2]); if (surf > 0 && prix > 0) out.push({ adresse: c[0], surface: surf, prix, date: c[3] || '', m2: prix / surf });
    }); return out;
  }
  /* Comparables : accepte le texte importé (format du simulateur) ou une liste [{adresse, surface, prix, date}] */
  function comparables(S, list) {
    const comps = list ? list.filter(x => x.surface > 0 && x.prix > 0).map(x => Object.assign({}, x, { m2: x.prix / x.surface })) : parseComps(S.comps);
    const moy = comps.length ? comps.reduce((t, x) => t + x.m2, 0) / comps.length : 0;
    const vM2 = S.type === 'box' ? 0 : S.vente / (S.surf || 1);
    return { comps, moy, venteM2: vM2, ecart: moy && vM2 ? vM2 / moy - 1 : null };
  }
  /* Prix du quartier -> revente visée */
  function quartier(S) {
    const U = unite(S), vise = S.pm2 * U.q;
    return { vise, ecart: vise ? S.vente / vise - 1 : 0, achatU: S.achat / U.q, venteU: S.vente / U.q, unite: U };
  }

  /* Les quatre contrôles avant décision */
  function controles(S, r, nComps) {
    const okv = v => v === 'Oui' || v === 'Non';
    const c = [
      { k: 'marge', ok: r.m >= S.obj / 100, l: 'Marge nette ≥ ' + S.obj + ' %' },
      { k: 'duree', ok: S.duree > 0 && S.duree <= S.dmax, l: 'Durée ≤ ' + S.dmax + ' mois' },
      { k: 'comps', ok: nComps >= 3, l: 'Comparables ≥ 3', v: nComps },
      { k: 'zones', ok: okv(S.abf) && okv(S.preempt), l: 'Zones ABF et préemption renseignées' }
    ];
    return { liste: c, score: c.filter(x => x.ok).length };
  }

  const SCENARIOS = [['Comme prévu', S => ({})], ['Revente − 5 %', S => ({ vente: S.vente * .95 })], ['Revente − 10 %', S => ({ vente: S.vente * .9 })],
    ['Travaux + 15 %', () => ({ tf: 1.15 })], ['Travaux + 30 %', () => ({ tf: 1.3 })], ['6 mois de retard', S => ({ duree: S.duree + 6 })],
    ['− 5 %, + 15 %, + 6 mois', S => ({ vente: S.vente * .95, tf: 1.15, duree: S.duree + 6 })]];
  function scenarios(S) { return SCENARIOS.map(([l, f]) => { const q = compute(S, f(S)); return { l, N: q.N, m: q.m, etat: etat(q.m, S.obj) }; }); }

  /* Limites arrondies comme dans le simulateur (au 500 € inférieur ou supérieur) */
  function limitesAffichees(S, r, L) {
    return {
      achatMax: L.achatMax > 0 ? Math.floor(L.achatMax / 500) * 500 : null,
      venteMin: Math.ceil(L.venteMin / 500) * 500,
      venteZero: Math.ceil(L.venteZero / 500) * 500,
      travauxMax: L.tfMax > 0 ? r.T * L.tfMax : null,
      retard: L.retard
    };
  }

  /* Indicateurs de lecture (remplacent les phrases d'analyse) : valeur + état 'ok' | 'juste' | 'ko' | '' */
  function indicateurs(S, r, L) {
    const U = unite(S), Q = quartier(S), dec = r.vente ? 1 - r.achat / r.vente : 0;
    const ecartRef = r.tr.ref ? r.tr.base / r.tr.ref - 1 : 0, brut = r.vente - r.C;
    const plus1 = compute(S, { duree: S.duree + 1 });
    return {
      decote: { v: dec, etat: dec >= .4 ? 'ok' : dec >= .3 ? 'juste' : 'ko' },
      ecartQuartier: { v: Q.vise ? Q.ecart : null, etat: !Q.vise ? '' : Q.ecart > .05 ? 'juste' : Q.ecart < -.05 ? 'ok' : '', margeAuQuartier: Q.vise ? compute(S, { vente: Q.vise }).m : null },
      negociation: { v: L.achatMax - S.achat, etat: r.m >= S.obj / 100 ? 'ok' : 'ko' },
      travauxU: { v: r.T / U.q },
      travauxPart: { v: r.C ? r.T / r.C : 0 },
      ecartRepere: { v: ecartRef, etat: ecartRef < -.15 ? 'juste' : '' },
      baisseObjectif: { v: r.vente ? 1 - L.venteMin / r.vente : 0 },
      baissePerte: { v: r.vente ? 1 - L.venteZero / r.vente : 0 },
      coutMois: { v: r.N - plus1.N },
      fiscaliteMarge: { v: brut > 0 ? (r.tva + r.is) / brut : null },
      tresorerie: { v: r.treso, reste: S.env - r.treso, etat: r.treso <= S.env ? 'ok' : 'ko' },
      alertesType: S.type === 'local' ? ['TVA sur le prix total possible après transformation lourde'] :
        S.type === 'terrain' ? ['TVA sur la marge contestable sur un terrain divisé'] :
        S.type === 'box' ? ['Chaque box doit être un lot distinct'] : []
    };
  }

  /* Analyse complète d'un état : tout ce dont l'interface et le PDF ont besoin */
  function analyse(S, comps) {
    const r = compute(S), L = limits(S), C = comparables(S, comps);
    return { r, L, lim: limitesAffichees(S, r, L), etat: etat(r.m, S.obj), partage: partage(S, r), comp: C, quartier: quartier(S),
      controles: controles(S, r, C.comps.length), scenarios: scenarios(S), ind: indicateurs(S, r, L) };
  }

  /* ---------- Suivi de chantier ----------
     Lignes de suivi créées depuis les postes cochés de la simulation, avec leur budget (aléas non répartis). */
  function lignesChantier(S) {
    return W.filter(i => vis(i, S.type) && S.w[i.id] && S.w[i.id].on).map(i => {
      const p = S.w[i.id], d = wDef(i, S).v; return { poste: i.id, l: i.l, budget: p.val == null ? d : p.val };
    });
  }
  /* lignes : [{budget, devis, facture, paye, avancement}] ; seuil en % (15 par défaut) */
  function totauxChantier(lignes, aleas, seuil = 15) {
    const s = k => lignes.reduce((t, x) => t + (Number(x[k]) || 0), 0);
    const budgetPostes = s('budget'), budget = budgetPostes * (1 + (aleas || 0) / 100);
    const engage = s('devis'), facture = s('facture'), paye = s('paye');
    const poids = budgetPostes || 1, avancement = lignes.reduce((t, x) => t + (Number(x.budget) || 0) * (Math.min(100, Number(x.avancement) || 0) / 100), 0) / poids;
    const depassement = budget ? engage / budget - 1 : 0;
    /* Coût réel estimé : devis signé quand il existe, sinon budget du poste ; aléas appliqués aux seuls postes sans devis */
    const reel = lignes.reduce((t, x) => t + (x.devis ? Number(x.devis) : (Number(x.budget) || 0) * (1 + (aleas || 0) / 100)), 0);
    return { budget, budgetPostes, engage, facture, paye, reste: engage - paye, avancement, depassement, alerte: depassement > seuil / 100, reel };
  }

  return {
    version: 1, r50, ALLB, W, X, XI, M1, M2, TYPES, NIVEAUX, GAMMES, DEF, REF_DEF, REF_ESTIME,
    setRef, getRef, vis, xVis, wDef, applyLevel, initLines, setType, fresh, normalize,
    notaire, travaux, compute, solve, limits,
    unite, etat, partage, parseComps, comparables, quartier, controles, scenarios, limitesAffichees, indicateurs, analyse,
    lignesChantier, totauxChantier
  };
});
