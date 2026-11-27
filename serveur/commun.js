/* Marchéo · fonctions pures partagées par les deux serveurs.
   - Serveur Google Apps Script (serveur/Code.gs) : ce fichier est poussé avec Code.gs (clasp) ; ses fonctions sont globales.
   - Serveur hébergé Cloudflare (serveur-cloudflare/) : importé comme module.
   Aucune dépendance à Google ni à Cloudflare : lecture des e-mails d'alerte, des pages d'annonce, des fichiers DVF. */
var EXPEDITEURS_ALERTES = ['alertes.seloger.com', 'no_reply@bienici.com', 'leboncoin.fr', 'pap.fr', 'logic-immo.com', 'immonot.com', 'ouestfrance-immo.com', 'figaroimmo.fr', 'bellesdemeures.com', 'paruvendu.fr'];
function nombre_(t) { var x = parseFloat(String(t).replace(/[\s\u00a0\u202f.]/g, '').replace(',', '.')); return isFinite(x) ? x : 0; }
var RE_PRIX = /(\d{1,3}(?:[ \u00a0\u202f.]\d{3})+|\d{4,})\s?€(?!\s?\/)/;
var RE_PRIX_M2 = /(\d{1,3}(?:[ \u00a0\u202f.]\d{3})*|\d+)\s?€\s?\/\s?m²/;
var RE_SURF = /(\d+(?:[.,]\d+)?)\s?m²(?!\s*\))/;
function normaliser_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
/* Complète une annonce à partir de son texte : surface, prix au m², code postal, ville, lots, DPE */
function enrichir_(a) {
  var t = [a.titre, a.texte].join(' ');
  var pm2 = t.match(RE_PRIX_M2);
  if (pm2) a.prixM2Annonce = nombre_(pm2[1]);
  var s = t.replace(RE_PRIX_M2, ' ').match(RE_SURF);
  if (s) a.surface = nombre_(s[1]);
  if (!a.surface && a.prix && a.prixM2Annonce) a.surface = Math.round(a.prix / a.prixM2Annonce);
  var cp = t.match(/\((\d{5})\)/) || t.match(/\b(\d{5})\s+([A-ZÀ-Ü][\wÀ-ÿ' -]{1,40})/);
  if (cp) { a.cp = cp[1]; if (cp[2]) a.ville = cp[2].trim(); }
  var lots = t.match(/(\d+)\s+(?:appartements|lots|logements|studios)/i);
  if (lots) a.lots = parseInt(lots[1], 10);
  var dpe = t.match(/DPE\s*:?\s*([A-G])\b/);
  if (dpe) a.dpe = dpe[1];
  return a;
}
/* Lit un e-mail d'alerte et rend la liste des annonces qu'il contient. Fonction pure, testée hors Google. */
function extraireAnnonces_(expediteur, sujet, texte, date) {
  var lignes = String(texte || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  var estUrl = function (l) { return /^\[?https?:\/\//.test(l); };
  var url = function (l) { return l.replace(/^\[|\]$/g, ''); };
  var out = [], de = String(expediteur || '').toLowerCase();
  /* E-mails de service (alerte créée, modifiée, désactivée, confirmation de compte) : aucune annonce, même si un prix y figure */
  if (/alerte.*(cr[ée]{2}e|enregistr|activ|modifi|supprim|d[ée]sactiv)|(cr[ée]ation|enregistrement|modification|suppression) de (votre |l.)?(alerte|recherche)|recherche.*(enregistr|sauvegard)|confirm|bienvenue|mot de passe|v[ée]rifi/i.test(String(sujet || ''))) return [];

  if (de.indexOf('bienici') >= 0) {
    /* Bien'ici : chaque ligne de texte est suivie du lien de son annonce (…/annonce/<identifiant>?…) */
    var parId = {}, ordre = [];
    for (var i = 1; i < lignes.length; i++) {
      var m = estUrl(lignes[i]) && url(lignes[i]).match(/bienici\.com\/annonce\/([^?\/\]]+)/);
      if (!m || estUrl(lignes[i - 1])) continue;
      if (!parId[m[1]]) { parId[m[1]] = { lignes: [], lien: 'https://www.bienici.com/annonce/' + m[1] }; ordre.push(m[1]); }
      parId[m[1]].lignes.push(lignes[i - 1]);
    }
    var agence = (String(texte).match(/L[’']agence\s+(.+?)\s+(?:vous propose|a s[ée]lectionn[ée])/) || [])[1] || '';
    ordre.forEach(function (id) {
      var L = parId[id].lignes.filter(function (l) { return !/^(Voir l|Photo$|RÉFÉRENCE)/i.test(l); });
      var prix = 0, titre = '', ville = '';
      L.forEach(function (l) { var p = l.match(RE_PRIX); if (p && !prix) prix = nombre_(p[1]); else if (/^\d{5}\s/.test(l)) ville = l; else if (!titre) titre = l; });
      out.push(enrichir_({ source: "Bien'ici", agence: agence, idSource: id, titre: titre, texte: L.join(' · ') + (ville ? ' ' + ville : ''), prix: prix, lien: parId[id].lien }));
    });
  } else if (de.indexOf('seloger') >= 0) {
    /* SeLoger : prix (et prix au m²), titre, lieu, puis « Voir l'annonce » précédé de son lien */
    var bloc = null, dernierLien = '';
    lignes.forEach(function (l) {
      if (estUrl(l)) { dernierLien = url(l); return; }
      var p = l.match(RE_PRIX);
      if (p) { if (bloc) out.push(bloc); bloc = { source: 'SeLoger', prix: nombre_(p[1]), lignes: [l] }; return; }
      if (!bloc) return;
      if (/^Voir l.annonce/i.test(l)) { bloc.lien = dernierLien; out.push(bloc); bloc = null; return; }
      bloc.lignes.push(l);
    });
    out = out.filter(function (b) { return b.lignes && b.lien; }).map(function (b) { // une annonce SeLoger se termine toujours par « Voir l'annonce »
      var L = b.lignes.slice(1), titre = L[0] || '', lieu = L.slice(1).join(' ').replace(/\s*,\s*/g, ', ');
      return enrichir_({ source: 'SeLoger', titre: titre, texte: b.lignes.join(' ') + ' ' + lieu, prix: b.prix, lien: b.lien || '', ville: ((lieu.match(/([A-ZÀ-Ü][\wÀ-ÿ' -]+)\s*\(\d{5}\)/) || [])[1] || '').trim() });
    });
  } else {
    /* Autres sites : une annonce par prix trouvé, avec le lien le plus proche */
    var lien = '';
    lignes.forEach(function (l, i) {
      if (estUrl(l)) { lien = url(l); return; }
      var p = l.match(RE_PRIX);
      if (!p) return;
      var contexte = lignes.slice(Math.max(0, i - 3), i + 4).filter(function (x) { return !estUrl(x); }).join(' · ');
      var suivant = lignes.slice(i + 1, i + 4).filter(estUrl)[0];
      out.push(enrichir_({ source: (de.match(/@?([a-z-]+)\.(?:fr|com)/) || [])[1] || 'Alerte', titre: sujet, texte: contexte, prix: nombre_(p[1]), lien: suivant ? url(suivant) : lien }));
    });
  }
  return out.filter(function (a) { return a.prix > 1000; }).map(function (a) {
    a.recueLe = date || new Date().toISOString();
    a.cle = normaliser_(a.idSource || [a.source, a.cp || a.ville, a.titre, a.surface].join(' '));
    a.id = 'an' + hacherCourt_(a.cle);
    return a;
  });
}
function hacherCourt_(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
/* Fusion avec l'existant : le tri fait dans Marchéo est conservé ; une baisse de prix est notée. */
function fusionnerAnnonce_(ancienne, nouvelle) {
  if (!ancienne) return Object.assign({ statutTri: 'nouvelle', vueLe: nouvelle.recueLe, alertes: 1, historiquePrix: [{ date: nouvelle.recueLe, prix: nouvelle.prix }] }, nouvelle);
  var a = Object.assign({}, ancienne);
  ['titre', 'texte', 'lien', 'cp', 'ville', 'surface', 'lots', 'pieces', 'type', 'chargesAnnuelles', 'agence', 'dpe', 'prixM2Annonce'].forEach(function (k) { if (nouvelle[k]) a[k] = nouvelle[k]; });
  a.alertes = (a.alertes || 1) + 1; a.vueLe = nouvelle.recueLe;
  if (nouvelle.prix && nouvelle.prix !== a.prix) {
    a.historiquePrix = (a.historiquePrix || []).concat([{ date: nouvelle.recueLe, prix: nouvelle.prix }]);
    if (nouvelle.prix < a.prix) a.prixPrecedent = a.prix;
    a.prix = nouvelle.prix;
    if (a.statutTri === 'ecartee' && a.prixPrecedent) a.statutTri = 'nouvelle'; // une baisse de prix remet l'annonce dans le tri
  }
  return a;
}
function extraireDePage_(html, url) {
  var meta = function (nom) { var m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + nom + '["\'][^>]+content=["\']([^"\']*)', 'i')) || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + nom, 'i')); return m ? decoder_(m[1]) : ''; };
  var json = function (re) { var m = html.match(re); return m ? m[1] : ''; };
  var titre = meta('og:title') || decoder_((html.match(/<title>([^<]*)/i) || [])[1] || '');
  var description = meta('og:description') || meta('description');
  var texte = decoder_(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').slice(0, 20000);
  var a = { titre: titre.slice(0, 160), texte: (description + ' ' + texte).slice(0, 3000), lien: url, source: (url.match(/https:\/\/(?:www\.)?([^\/.]+)/) || [])[1] || '' };
  a.prix = nombre_(json(/"price"\s*:\s*\[?\s*"?(\d{4,9})/) || ((titre + ' ' + description).match(RE_PRIX) || [])[1] || '');
  a.surface = nombre_(json(/"(?:square|surface|livingArea|floorSize)"[^0-9]{0,40}(\d+(?:[.,]\d+)?)/) || '');
  a.pieces = parseInt(json(/"(?:rooms|numberOfRooms|nb_rooms)"[^0-9]{0,30}(\d+)/) || '0', 10) || 0;
  a.cp = json(/"(?:zipcode|postalCode|postal_code)"\s*:\s*"?(\d{5})/);
  a.ville = decoder_(json(/"(?:city|addressLocality)"\s*:\s*"([^"]{2,60})"/));
  a.dpe = json(/"(?:energy_rate|energyClass|dpe)"[^A-G]{0,20}"([A-G])"/);
  enrichir_(a);
  return a;
}
var TYPES_BIENICI = { flat: 'appt', house: 'maison', parking: 'box', premises: 'local', shop: 'local', office: 'local', building: 'immeuble', terrain: 'terrain', land: 'terrain' };
function depuisBienici_(d) {
  if (!d || !d.price) return null;
  var desc = decoder_(String(d.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
  var a = { source: "Bien'ici", titre: d.title || d.generatedTitle || '', texte: desc.slice(0, 3000), prix: +d.price || 0, surface: +d.surfaceArea || 0,
    pieces: +d.roomsQuantity || 0, cp: String(d.postalCode || ''), ville: d.city || '', dpe: d.energyClassification || '', type: TYPES_BIENICI[d.propertyType] || '',
    chargesAnnuelles: +d.annualCondominiumFees || 0, baissePrix: !!d.priceHasDecreased };
  if (!a.titre) a.titre = [{ appt: 'Appartement', maison: 'Maison', box: 'Parking', local: 'Local', immeuble: 'Immeuble', terrain: 'Terrain' }[a.type] || 'Bien', a.pieces ? a.pieces + ' pièce' + (a.pieces > 1 ? 's' : '') : '', a.surface ? a.surface + ' m²' : ''].filter(Boolean).join(' ');
  return a;
}
var DVF_TYPES = { appt: 'Appartement', maison: 'Maison', local: 'Local industriel. commercial ou assimilé' };
function lignesCsv_(texte) {
  var lignes = String(texte || '').split(/\r?\n/), entete = null, out = [];
  for (var i = 0; i < lignes.length; i++) {
    var l = lignes[i]; if (!l) continue;
    var v = l.indexOf('"') < 0 ? l.split(',') : (function () { var c = [], cur = '', q = false; for (var j = 0; j < l.length; j++) { var ch = l[j]; if (q) { if (ch === '"' && l[j + 1] === '"') { cur += '"'; j++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { c.push(cur); cur = ''; } else cur += ch; } c.push(cur); return c; })();
    if (!entete) { entete = v; continue; }
    var o = {}; for (var k = 0; k < entete.length; k++) o[entete[k]] = v[k] || ''; out.push(o);
  }
  return out;
}
/* Une mutation = une vente ; on ne garde que les ventes d'un seul logement (ou local), dépendances admises. */
function ventesUniques_(lignes, typeLocal) {
  var parMut = {}, ordre = [];
  lignes.forEach(function (r) {
    if (r.nature_mutation !== 'Vente') return;
    var m = parMut[r.id_mutation]; if (!m) { m = parMut[r.id_mutation] = { r: r, biens: {}, autres: 0 }; ordre.push(r.id_mutation); }
    if (r.type_local === 'Appartement' || r.type_local === 'Maison' || r.type_local === DVF_TYPES.local) {
      m.biens[[r.type_local, r.surface_reelle_bati, r.nombre_pieces_principales, r.lot1_numero].join('|')] = r;
    }
  });
  var out = [];
  ordre.forEach(function (id) {
    var m = parMut[id], cles = Object.keys(m.biens); if (cles.length !== 1) return;
    var b = m.biens[cles[0]]; if (b.type_local !== typeLocal) return;
    var prix = parseFloat(b.valeur_fonciere), surf = parseFloat(b.surface_reelle_bati);
    if (!(prix > 0 && surf > 0)) return;
    var m2 = prix / surf; if (m2 < 300 || m2 > 30000) return;
    out.push({ date: b.date_mutation, prix: Math.round(prix), surface: surf, pieces: parseInt(b.nombre_pieces_principales, 10) || 0, m2: Math.round(m2),
      adresse: [b.adresse_numero, b.adresse_suffixe, b.adresse_nom_voie].filter(String).join(' ').replace(/\s+/g, ' ').trim() + ', ' + b.nom_commune,
      lat: parseFloat(b.latitude), lon: parseFloat(b.longitude) });
  });
  return out;
}
function distanceM_(a, b) {
  if (!isFinite(a.lat) || !isFinite(b.lat)) return Infinity;
  var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
function quantile_(l, q) { if (!l.length) return 0; var s = l.slice().sort(function (a, b) { return a - b; }), p = (s.length - 1) * q, i = Math.floor(p); return Math.round(s[i] + (s[Math.min(i + 1, s.length - 1)] - s[i]) * (p - i)); }
/* Choix des comparables à partir des ventes déjà lues (fonction pure, testée). */
function choisirComparables_(ventes, cible, nombre) {
  nombre = nombre || 3;
  ventes.forEach(function (v) { v.distance = distanceM_(cible, v); });
  var surf = +cible.surface || 0, choix = [], rayon = null, tolerance = null;
  var tolerances = surf ? [0.25, 0.4, 0.6] : [null], rayons = [300, 600, 1000, 2000, Infinity];
  for (var t = 0; t < tolerances.length && choix.length < nombre; t++) {
    for (var k = 0; k < rayons.length; k++) {
      var l = ventes.filter(function (v) { return v.distance <= rayons[k] && (tolerances[t] == null || Math.abs(v.surface - surf) <= surf * tolerances[t]); });
      if (l.length >= nombre || (t === tolerances.length - 1 && k === rayons.length - 1)) {
        if (cible.pieces) { var memes = l.filter(function (v) { return v.pieces === +cible.pieces; }); if (memes.length >= nombre) l = memes; }
        l.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : a.distance - b.distance; });
        choix = l.slice(0, nombre); rayon = rayons[k]; tolerance = tolerances[t]; break;
      }
    }
  }
  /* Prix du secteur : ventes du même type à moins d'1 km (toute la commune s'il y en a moins de 10) */
  var proches = ventes.filter(function (v) { return v.distance <= 1000; }), zone = '1 km';
  if (proches.length < 10) { proches = ventes; zone = 'commune'; }
  var m2 = proches.map(function (v) { return v.m2; });
  return {
    ventes: choix.map(function (v) { return { adresse: v.adresse, date: v.date, prix: v.prix, surface: v.surface, pieces: v.pieces, m2: v.m2, distance: isFinite(v.distance) ? v.distance : null }; }),
    rayon: isFinite(rayon) ? rayon : null, tolerance: tolerance,
    secteur: { mediane: quantile_(m2, 0.5), p25: quantile_(m2, 0.25), p75: quantile_(m2, 0.75), n: m2.length, zone: zone }
  };
}
function decoder_(t) { return String(t || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }); }

if (typeof module !== 'undefined') module.exports = {
  EXPEDITEURS_ALERTES: EXPEDITEURS_ALERTES, RE_PRIX: RE_PRIX, RE_PRIX_M2: RE_PRIX_M2, RE_SURF: RE_SURF, TYPES_BIENICI: TYPES_BIENICI, DVF_TYPES: DVF_TYPES, nombre_: nombre_, normaliser_: normaliser_, enrichir_: enrichir_, extraireAnnonces_: extraireAnnonces_, hacherCourt_: hacherCourt_, fusionnerAnnonce_: fusionnerAnnonce_, extraireDePage_: extraireDePage_, depuisBienici_: depuisBienici_, lignesCsv_: lignesCsv_, ventesUniques_: ventesUniques_, distanceM_: distanceM_, quantile_: quantile_, choisirComparables_: choisirComparables_, decoder_: decoder_
};
