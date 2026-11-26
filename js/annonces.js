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
    /* Budget travaux de l'analyse des annonces, hors aléas : prix au m² et minimum par bien, selon le niveau.
       Remplace le chiffrage poste par poste, inconnu à ce stade. Aléas de chantier de la simulation en plus. */
    /* budget HT = max(minimum, €/m² × surface + € par pièce à vivre × pièces) ; F2 = 2 pièces à vivre */
    travaux: { r: { m2: 200, piece: 200, min: 3000 }, c: { m2: 550, piece: 800, min: 8000 }, l: { m2: 900, piece: 1200, min: 12000 }, defaut: 'r' },
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
  function niveauDepuisTexte(t, dpe, defaut) {
    const x = norm(t);
    if (/gros (oeuvre|travaux)|a rehabiliter|insalubre|plateau|a restaurer entierement|ruine/.test(x)) return 'l';
    if (/a renover|renovation complete|travaux a prevoir|a restaurer|a moderniser/.test(x) || /[FG]/.test(dpe || '')) return 'c';
    if (/a rafraichir|rafraichissement|bon etat|refait|renove/.test(x)) return 'r';
    return defaut || 'c';
  }
  /* Pièces à vivre : studio = 1, T2 ou F2 = 2, « 3 pièces » = 3, « 2 chambres » = 3 */
  function piecesDepuisTexte(t) {
    const x = norm(t);
    let m = x.match(/\b[tf]\s?(\d)\b/) || x.match(/(\d+)\s*pieces?\b/);
    if (m) return +m[1];
    if (/\bstudio|studette|chambre de service\b/.test(x)) return 1;
    m = x.match(/(\d+)\s*chambres?\b/);
    return m ? +m[1] + 1 : 0;
  }
  /* Lecture d'un texte d'annonce collé (page copiée) : prix, surface, pièces, code postal, ville, DPE */
  function lireTexte(t) {
    t = String(t || '');
    const prixM = t.match(/(\d{1,3}(?:[\s\u00a0\u202f.]\d{3})+|\d{4,})\s?€(?!\s?\/)/);
    const surfM = t.replace(/\d[\d\s\u00a0\u202f.]*€\s?\/\s?m²/g, ' ').match(/(\d+(?:[.,]\d+)?)\s?m(?:²|2)(?![\w])/);
    const villeCp = t.match(/([A-ZÀ-Ü][\wÀ-ÿ' -]{1,40}?)\s*\((\d{5})\)/);
    const cpM = villeCp ? [villeCp[0], villeCp[2], villeCp[1]] : t.match(/\b((?:75|77|78|91|92|93|94|95|[0-8]\d|9[0-8])\d{3})\b\s*([A-ZÀ-Ü][\wÀ-ÿ' -]{1,40})?/);
    const dpeM = t.match(/(?:DPE|classe énergie|classe energie)\s*:?\s*([A-G])\b/i);
    const premiere = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || '';
    const n = v => parseFloat(String(v).replace(/[\s\u00a0\u202f.]/g, '').replace(',', '.'));
    return { titre: premiere.slice(0, 120), prix: prixM ? n(prixM[1]) : 0, surface: surfM ? n(surfM[1]) : 0, pieces: piecesDepuisTexte(t),
      cp: cpM ? cpM[1] : '', ville: cpM && cpM[2] ? cpM[2].replace(/[\s-]+(\d.*)?$/, '').replace(/[\s-]+$/, '').trim() : '', dpe: dpeM ? dpeM[1].toUpperCase() : '', type: typeDepuisTexte(t) };
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
      S.pieces = +(k.pieces || k.lots || a.pieces) || piecesDepuisTexte(texte) || Math.max(1, Math.round(surface / 20));
    }
    const BT = Object.assign({}, CRITERES_DEF.travaux, C.travaux || {});
    S.niveau = k.niveau || niveauDepuisTexte(texte, a.dpe, BT.defaut); M.applyLevel(S);
    /* Travaux : budget forfaitaire au m² (minimum par bien), aléas en plus ; remplace le détail des postes */
    const bt = BT[S.niveau] || CRITERES_DEF.travaux[S.niveau], parPiece = (+bt.piece || 0) * (type === 'box' ? 0 : S.pieces);
    const travauxHT = Math.max(+bt.min || 0, (+bt.m2 || 0) * S.surf + parPiece);
    S.trvForfait = Math.round(travauxHT * (1 + S.aleas / 100)); S.trvReel = S.trvForfait;
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
      pieces: S.pieces, travaux: { niveau: S.niveau, m2: +bt.m2, piece: +bt.piece || 0, pieces: S.pieces, min: +bt.min, ht: travauxHT, total: S.trvForfait, aleas: S.aleas },
      tresoAffiche: r.treso, tresoAuMax: qMax ? qMax.treso : null, margeBrute: brute(r), margeBruteEur: r.vente - r.C, criteres: C });
  }

  const api = { DVF, CRITERES_DEF, TYPES_HORS, dansZone, typeDepuisTexte, niveauDepuisTexte, piecesDepuisTexte, lireTexte, evaluer, secteur };
  if (typeof module === 'object' && module.exports) module.exports = api; else global.MarcheoAnnonces = api;
})(typeof window !== 'undefined' ? window : globalThis);
