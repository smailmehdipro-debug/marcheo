/* Marchéo · analyse des annonces reçues par les alertes e-mail.
   Chaque annonce passe dans le moteur de calcul (calc.js) : type, surface, lots et niveau de travaux déduits du texte,
   revente estimée au prix du secteur. Tri en trois étapes :
   1. prix affiché au plus égal au plafond d'entrée (130 000 € par défaut), sinon écartée d'office ;
   2. argent total à sortir (trésorerie maximale : achat, frais d'agence, notaire, travaux et aléas, annexes,
      TVA des travaux avancée) au plus égal au plafond (140 000 € par défaut) ;
   3. marge brute (revente moins coût de revient) d'au moins 10 % du prix de revente.
   Les étapes 2 et 3 s'apprécient au prix obtenu après une négociation réaliste (15 % au plus par défaut).
   Résultat : « signalée », « écartée » (avec motifs) ou « à compléter » (donnée manquante). Tous les seuils sont dans CRITERES.
   Module pur : testé hors navigateur. */
(function (global) {
  'use strict';
  const M = global.MDB || (typeof require === 'function' ? require('./calc.js') : null);
  const DVF = global.MarcheoDVF || (typeof require === 'function' ? require('./secteurs-dvf.js') : { secteurs: [] });

  const CRITERES_DEF = {
    prixAfficheMax: 130000, // au-dessus, écartée d'office sans calcul (€ ; 0 = sans limite)
    tresoMax: 140000,       // argent total à sortir, trésorerie maximale (€ ; 0 = sans limite)
    margeBruteMin: 10,      // marge brute minimum, en % du prix de revente
    negoMax: 15,            // négociation maximum jugée réaliste sur le prix affiché (%)
    types: ['appt', 'maison', 'local', 'box'], // types analysés ; les autres sont écartés d'office
    /* Zone : départements entiers (2 chiffres), codes postaux (5 chiffres) ou noms de communes. Vide = partout.
       92 nord, 93 est et 78 nord : communes listées une à une, liste à ajuster. */
    zone: ['75', '95',
      '92600 Asnières-sur-Seine', '92270 Bois-Colombes', '92110 Clichy', '92700 Colombes', '92400 Courbevoie', '92230 Gennevilliers',
      '92250 La Garenne-Colombes', '92300 Levallois-Perret', '92000 Nanterre', '92390 Villeneuve-la-Garenne',
      '93100 Montreuil', '93110 Rosny-sous-Bois', '93250 Villemomble', '93130 Noisy-le-Sec', '93140 Bondy', '93320 Les Pavillons-sous-Bois',
      '93190 Livry-Gargan', '93390 Clichy-sous-Bois', '93370 Montfermeil', '93270 Sevran', '93420 Villepinte', '93290 Tremblay-en-France',
      '93600 Aulnay-sous-Bois', '93220 Gagny', '93340 Le Raincy', '93330 Neuilly-sur-Marne', '93360 Neuilly-Plaisance', '93160 Noisy-le-Grand',
      '93470 Coubron', '93410 Vaujours', '93460 Gournay-sur-Marne',
      '78300 Poissy', '78700 Conflans-Sainte-Honorine', '78260 Achères', '78955 Carrières-sous-Poissy', '78130 Les Mureaux', '78200 Mantes-la-Jolie',
      '78711 Mantes-la-Ville', '78520 Limay', '78500 Sartrouville', '78800 Houilles', '78400 Chatou', '78230 Le Pecq', '78100 Saint-Germain-en-Laye',
      '78600 Maisons-Laffitte', '78480 Verneuil-sur-Seine', '78510 Triel-sur-Seine', '78570 Andrésy', '78410 Aubergenville', '78250 Meulan-en-Yvelines',
      '78360 Montesson', '78110 Le Vésinet', '78420 Carrières-sur-Seine'],
    exclus: ['viager', 'nue-propriété', 'nue propriété', 'usufruit', 'fonds de commerce', 'droit au bail', 'résidence services', 'ehpad', 'multipropriété'],
    signaux: ['succession', 'urgent', 'mutation', 'divorce', 'à rénover', 'travaux', 'rénovation', 'plateau', 'baisse de prix', 'investisseur', 'marchand de biens', 'à saisir', 'libre'],
    secteurs: []            // [{cp, commune, pm2, pm2Terrain, prixBox}]
  };
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

  const TYPES_HORS = { immeuble: 'Immeuble', terrain: 'Terrain' };
  function typeDepuisTexte(t) {
    const x = norm(t);
    if (/immeuble|batiment|plusieurs (appartements|lots)|\d+ (appartements|lots|logements)|immeuble de rapport/.test(x)) return 'immeuble';
    if (/\b(box|boxes|parking|garage)s?\b/.test(x)) return 'box';
    if (/terrain/.test(x)) return 'terrain';
    if (/\b(local|commerce|boutique|bureau|entrepot|atelier)s?\b/.test(x)) return 'local';
    if (/maison|pavillon|villa|longere|corps de ferme/.test(x)) return 'maison';
    if (/appartement|studio|duplex|loft|\bt\d\b|\bf\d\b/.test(x)) return 'appt';
    return '';
  }
  function niveauDepuisTexte(t, dpe) {
    const x = norm(t);
    if (/gros (oeuvre|travaux)|a rehabiliter|insalubre|plateau|a restaurer entierement|ruine/.test(x)) return 'l';
    if (/a renover|renovation complete|travaux a prevoir|a restaurer|a moderniser/.test(x) || /[FG]/.test(dpe || '')) return 'c';
    if (/a rafraichir|rafraichissement|bon etat|refait|renove/.test(x)) return 'r';
    return 'c';
  }
  const trouve = (t, liste) => (liste || []).filter(m => norm(t).includes(norm(m)));
  /* Zone : un élément « 95 » couvre le département, « 92600 Asnières-sur-Seine » le code postal ou la commune. */
  function dansZone(a, zone) {
    if (!zone || !zone.length) return true;
    const cp = String(a.cp || ''), v = norm(a.ville).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!cp && !v) return null;
    return zone.some(z => {
      const m = String(z).trim().match(/^(\d{2,5})?\s*(.*)$/), code = m[1] || '', nom = norm(m[2]).replace(/[^a-z0-9]+/g, ' ').trim();
      if (code && cp) return code.length === 5 ? cp === code : cp.startsWith(code);
      return !!(nom && v && nom === v);
    });
  }
  /* Prix du secteur : d'abord les prix saisis dans les Réglages, ensuite la référence DVF (ventes réelles). */
  function chercher(liste, a) {
    const cp = a.cp || '', v = norm(a.ville);
    return (liste || []).find(s => s.cp && cp && String(s.cp) === String(cp)) || (liste || []).find(s => s.commune && v && norm(s.commune).split(' / ').includes(v)) || null;
  }
  function secteur(a, secteurs) {
    const perso = chercher(secteurs, a), ref = chercher(DVF.secteurs, a);
    if (perso) return Object.assign({ origine: 'saisi' }, ref ? { pm2Maison: ref.pm2Maison, n: ref.n, mediane: ref.mediane, nMaisons: ref.nMaisons, medianeMaison: ref.medianeMaison } : {}, perso);
    return ref ? Object.assign({ origine: 'DVF' }, ref) : null;
  }

  /* R : réglages Marchéo (taux, obj, part, pfu, dmax, tvaT, tvaMode) + critères */
  function evaluer(a, R) {
    R = R || {};
    const C = Object.assign({}, CRITERES_DEF, R.criteres || {});
    const k = a.corrections || {}, texte = [a.titre, a.texte].join(' ');
    const type = k.type || a.type || typeDepuisTexte(texte) || 'appt';
    const typeOk = (C.types || []).includes(type) && M.TYPES[type];
    const surface = +(k.surface || a.surface) || 0, prix = +(k.prix || a.prix) || 0;
    const sec = secteur(a, C.secteurs);
    const pm2 = +(k.pm2 || (sec && (type === 'terrain' ? sec.pm2Terrain : type === 'box' ? sec.prixBox : type === 'maison' ? (sec.pm2Maison || sec.pm2) : sec.pm2))) || 0;
    const motifs = [], manque = [];
    if (!prix) manque.push('prix');
    if (!surface && type !== 'box') manque.push('surface');
    if (!pm2) manque.push(type === 'box' ? 'prix d\'un box du secteur' : 'prix au m² du secteur');
    const exclus = trouve(texte, C.exclus), signaux = trouve(texte, C.signaux);
    if (a.prixPrecedent && a.prixPrecedent > prix) signaux.push('baisse de prix de ' + Math.round((1 - prix / a.prixPrecedent) * 100) + ' %');
    if (/[FG]/.test(a.dpe || '')) signaux.push('DPE ' + a.dpe);
    const base = { type, surface, prix, pm2, secteur: sec, signaux, exclus };
    if (exclus.length) motifs.push('exclu : ' + exclus.join(', '));
    const zoneOk = dansZone(a, C.zone);
    if (zoneOk === false) motifs.push('hors zone : ' + ([a.cp, a.ville].filter(Boolean).join(' ')));
    if (zoneOk === null) manque.push('code postal');
    if (!typeOk) motifs.push('type hors critères : ' + ((M.TYPES[type] || {}).n || TYPES_HORS[type] || type).toLowerCase());
    if (prix && +C.prixAfficheMax && prix > +C.prixAfficheMax) motifs.push('prix affiché au-dessus de ' + (+C.prixAfficheMax).toLocaleString('fr-FR') + ' €');
    if (motifs.length && !manque.length) return Object.assign(base, { statut: 'ecartee', motifs, manque, score: null });
    if (manque.length) return Object.assign(base, { statut: motifs.length ? 'ecartee' : 'a_completer', motifs: motifs.length ? motifs : ['à compléter : ' + manque.join(', ')], manque, score: null });

    if (!typeOk) return Object.assign(base, { statut: 'ecartee', motifs, manque, score: null });
    /* Simulation : achat au prix affiché, revente au prix du secteur, travaux selon le texte */
    const S = M.fresh(type);
    ['taux', 'obj', 'part', 'pfu', 'dmax', 'tvaT', 'tvaMode'].forEach(x => { if (R[x] != null) S[x] = R[x]; });
    if (type === 'box') { S.pieces = +(k.lots || a.lots) || Math.max(1, Math.round((surface || 12 * 8) / 12)); S.surf = surface || S.pieces * 12; }
    else {
      S.surf = surface;
      S.pieces = +(k.lots || a.pieces) || Math.max(1, Math.round(surface / 20));
    }
    S.niveau = k.niveau || niveauDepuisTexte(texte, a.dpe); M.applyLevel(S);
    S.achat = prix; S.pm2 = pm2; S.vente = Math.round(pm2 * (type === 'box' ? S.pieces : S.surf));
    S.adresse = [a.titre, a.ville].filter(Boolean).join(', ');
    const mb = (+C.margeBruteMin || 0) / 100, brute = q => q.vente ? (q.vente - q.C) / q.vente : 0;
    const controles = p => { const q = M.compute(S, { achat: p }); return { q, treso: !+C.tresoMax || q.treso <= +C.tresoMax, marge: brute(q) >= mb }; };
    const tient = p => { const c = controles(p); return c.treso && c.marge; };
    const achatMax = tient(0) ? M.solve(tient, 0, Math.max(prix, S.vente), true) : 0;
    const r = M.compute(S), nego = prix ? 1 - achatMax / prix : 1;
    /* Motifs : ce qui ne tient pas au prix négocié au maximum réaliste */
    const pNego = prix * (1 - C.negoMax / 100), cn = controles(pNego);
    if (nego > C.negoMax / 100) {
      if (!cn.treso) motifs.push('argent à sortir ' + Math.round(cn.q.treso).toLocaleString('fr-FR') + ' € > ' + (+C.tresoMax).toLocaleString('fr-FR') + ' €');
      if (!cn.marge) motifs.push('marge brute ' + (brute(cn.q) * 100).toFixed(1).replace('.', ',') + ' % < ' + C.margeBruteMin + ' %');
      motifs.push(achatMax ? 'négociation de ' + Math.round(nego * 100) + ' % nécessaire' : 'aucun prix d\'achat ne tient les critères');
    }
    const qMax = achatMax ? M.compute(S, { achat: achatMax }) : null;
    let score = Math.round(50 + (C.negoMax / 100 - nego) * 250 + signaux.length * 5);
    score = Math.max(0, Math.min(100, score));
    const statut = motifs.length ? 'ecartee' : 'signalee';
    return Object.assign(base, { statut, motifs, manque, score, S, r, achatMax, nego, marge: r.m, vente: S.vente, niveau: S.niveau, lots: S.pieces,
      tresoAffiche: r.treso, tresoAuMax: qMax ? qMax.treso : null, margeBrute: brute(r), margeBruteEur: r.vente - r.C, criteres: C });
  }

  const api = { DVF, CRITERES_DEF, TYPES_HORS, dansZone, typeDepuisTexte, niveauDepuisTexte, evaluer, secteur };
  if (typeof module === 'object' && module.exports) module.exports = api; else global.MarcheoAnnonces = api;
})(typeof window !== 'undefined' ? window : globalThis);
