/* Marchéo · serveur Google Apps Script (gratuit, sur le compte Google de l'utilisateur)
   Installation :
   1. script.google.com > Nouveau projet > coller ce fichier.
   2. Exécuter installer() une fois : crée le classeur « Marchéo — données » et un accès,
      identifiant et mot de passe provisoire affichés dans le journal d'exécution.
   3. Déployer > Nouveau déploiement > Application Web : exécuter en tant que « Moi », accès « Tout le monde ».
   4. Copier l'adresse de l'application Web dans l'écran de connexion de Marchéo.
   Mot de passe perdu : exécuter definirMotDePasse('identifiant', 'nouveau mot de passe').
   Alertes d'annonces : installer() programme importerAlertes() toutes les heures. Les e-mails d'alerte des sites
   listés dans EXPEDITEURS_ALERTES sont lus, chaque annonce devient une fiche « annonces », le fil Gmail reçoit
   le libellé « Marchéo-traité ». L'analyse et le tri se font dans Marchéo, selon les critères des Réglages.

   Format : onglet « donnees », une ligne par fiche : coll | id | majLe | supprime | recuLe | json | json_2…
   majLe : date de modification sur l'appareil (départage deux versions d'une même fiche) ;
   recuLe : date de réception par le serveur (lecture incrémentale : une modification faite hors connexion,
   donc datée d'avant, est quand même transmise aux autres appareils).
   (JSON découpé en morceaux de 45 000 caractères, préfixe « ~ » pour que Sheets ne l'interprète jamais). */

var COLLS = ['biens', 'contacts', 'relances', 'journal', 'reglages', 'annonces'];
var MORCEAU = 45000;
var DUREE_JETON_JOURS = 60;

function doPost(e) {
  var sortie;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    sortie = { ok: true, resultat: traiter_(req.action, req.donnees || {}, req.jeton || '') };
  } catch (err) {
    sortie = { ok: false, code: err.code || 'SERVEUR', message: err.message || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(sortie)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, application: 'Marchéo', message: 'Serveur en service.' })).setMimeType(ContentService.MimeType.JSON);
}

function erreur_(message, code) { var e = new Error(message); e.code = code; return e; }

function traiter_(action, d, jeton) {
  if (action === 'connexion') return connexion_(String(d.identifiant || '').trim().toLowerCase(), String(d.motDePasse || ''));
  var utilisateur = verifierJeton_(jeton);
  if (action === 'lire') return lire_(String(d.depuis || ''));
  if (action === 'ecrire') return ecrire_(d.enregistrements || [], utilisateur);
  if (action === 'deconnexion') { supprimerJeton_(jeton); return { fait: true }; }
  if (action === 'lireAnnonce') return lireAnnonce_(String(d.url || ''));
  if (action === 'deposerPhoto') return deposerPhoto_(String(d.bienId || 'divers'), String(d.nom || 'photo.jpg'), String(d.base64 || ''), String(d.type || 'image/jpeg'));
  if (action === 'lirePhoto') return lirePhoto_(String(d.id || ''));
  if (action === 'ventesDVF') return ventesDVF_(d);
  throw erreur_('Action inconnue.', 'ACTION');
}

/* ---------- Classeur ---------- */
function classeur_() {
  var id = PropertiesService.getScriptProperties().getProperty('CLASSEUR');
  if (!id) throw erreur_('Serveur non installé : exécuter installer().', 'INSTALLATION');
  return SpreadsheetApp.openById(id);
}
function onglet_(nom, entetes) {
  var c = classeur_(), f = c.getSheetByName(nom);
  if (!f) { f = c.insertSheet(nom); f.getRange(1, 1, 1, entetes.length).setValues([entetes]); f.setFrozenRows(1); }
  return f;
}
function feuilleDonnees_() { return onglet_('donnees', ['coll', 'id', 'majLe', 'supprime', 'recuLe', 'json']); }

/* ---------- Comptes et jetons ---------- */
function hacher_(sel, secret) {
  var o = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sel + ':' + secret, Utilities.Charset.UTF_8);
  return o.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function comptes_() {
  var f = onglet_('comptes', ['identifiant', 'sel', 'empreinte', 'actif']);
  var v = f.getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) out.push({ ligne: i + 1, identifiant: String(v[i][0]), sel: String(v[i][1]), empreinte: String(v[i][2]), actif: v[i][3] !== false && v[i][3] !== 'non' });
  return out;
}
function connexion_(identifiant, motDePasse) {
  Utilities.sleep(300); // freine les essais en rafale
  var c = comptes_().filter(function (x) { return x.identifiant === identifiant && x.actif; })[0];
  if (!c || hacher_(c.sel, motDePasse) !== c.empreinte) throw erreur_('Identifiant ou mot de passe incorrect.', 'ACCES');
  var jeton = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  var expire = Date.now() + DUREE_JETON_JOURS * 86400000;
  PropertiesService.getScriptProperties().setProperty('J_' + hacher_('jeton', jeton), JSON.stringify({ identifiant: identifiant, expire: expire }));
  return { jeton: jeton, utilisateur: identifiant };
}
function verifierJeton_(jeton) {
  if (!jeton) throw erreur_('Session expirée : se reconnecter.', 'SESSION');
  var p = PropertiesService.getScriptProperties(), k = 'J_' + hacher_('jeton', jeton), v = p.getProperty(k);
  if (!v) throw erreur_('Session expirée : se reconnecter.', 'SESSION');
  var o = JSON.parse(v);
  if (o.expire < Date.now()) { p.deleteProperty(k); throw erreur_('Session expirée : se reconnecter.', 'SESSION'); }
  return o.identifiant;
}
function supprimerJeton_(jeton) { if (jeton) PropertiesService.getScriptProperties().deleteProperty('J_' + hacher_('jeton', jeton)); }

/* ---------- Lecture et écriture des fiches ---------- */
function versLigne_(e, recuLe) {
  var json = '~' + JSON.stringify(e.data || {}), parts = [];
  for (var i = 0; i < json.length; i += MORCEAU) parts.push((i ? '~' : '') + json.slice(i, i + MORCEAU));
  return [e.coll, e.id, e.majLe, e.supprime ? 'oui' : '', recuLe].concat(parts);
}
function depuisLigne_(r) {
  var json = '';
  for (var i = 5; i < r.length; i++) { var s = String(r[i] || ''); if (!s) continue; json += s.charAt(0) === '~' ? s.slice(1) : s; }
  var data = {}; try { data = json ? JSON.parse(json) : {}; } catch (err) { data = {}; }
  return { coll: String(r[0]), id: String(r[1]), majLe: String(r[2]), supprime: r[3] === 'oui', recuLe: String(r[4]), data: data };
}
function lire_(depuis) {
  var f = feuilleDonnees_(), v = f.getDataRange().getValues(), out = [], maxi = depuis;
  /* >= : une fiche reçue dans la même milliseconde que la lecture précédente n'est jamais perdue (réception idempotente). */
  for (var i = 1; i < v.length; i++) {
    var recu = String(v[i][4]);
    if (!depuis || recu >= depuis) out.push(depuisLigne_(v[i]));
    if (recu > maxi) maxi = recu;
  }
  return { enregistrements: out, horodatage: maxi };
}
function ecrire_(lot, utilisateur) {
  var verrou = LockService.getScriptLock(); verrou.waitLock(20000);
  try {
    var f = feuilleDonnees_(), v = f.getDataRange().getValues(), index = {}, refuses = [], ajouts = [], ajoutsIndex = {}, recu = new Date().toISOString();
    for (var i = 1; i < v.length; i++) index[v[i][0] + '|' + v[i][1]] = i;
    lot.forEach(function (e) {
      if (COLLS.indexOf(e.coll) < 0 || !e.id || !e.majLe) return;
      var k = e.coll + '|' + e.id, i = index[k];
      if (i === -1) { ajouts[ajoutsIndex[k]] = versLigne_(e, recu); return; } // même fiche deux fois dans le lot
      if (i != null && String(v[i][2]) > e.majLe) { refuses.push(depuisLigne_(v[i])); return; } // une version plus récente existe déjà
      var ligne = versLigne_(e, recu);
      if (i != null) {
        var largeur = Math.max(ligne.length, f.getLastColumn());
        while (ligne.length < largeur) ligne.push('');
        f.getRange(i + 1, 1, 1, ligne.length).setValues([ligne]);
      } else { ajoutsIndex[k] = ajouts.length; ajouts.push(ligne); index[k] = -1; }
    });
    ajouts.forEach(function (l) { f.appendRow(l); });
    return { ecrits: lot.length - refuses.length, refuses: refuses, par: utilisateur };
  } finally { verrou.releaseLock(); }
}

/* ---------- Alertes d'annonces (Gmail) ---------- */
var EXPEDITEURS_ALERTES = ['alertes.seloger.com', 'no_reply@bienici.com', 'leboncoin.fr', 'pap.fr', 'logic-immo.com', 'immonot.com', 'ouestfrance-immo.com', 'figaroimmo.fr', 'bellesdemeures.com', 'paruvendu.fr'];
var LIBELLE_TRAITE = 'Marchéo-traité';

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
  if (/alerte.*(cr[ée]{2}e|enregistr|activ|modifi|supprim|d[ée]sactiv)|recherche.*(enregistr|sauvegard)|confirm|bienvenue|mot de passe|v[ée]rifi/i.test(String(sujet || ''))) return [];

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

function importerAlertes() {
  var requete = 'from:(' + EXPEDITEURS_ALERTES.join(' OR ') + ') -label:' + LIBELLE_TRAITE.replace(/ /g, '-') + ' newer_than:120d';
  var libelle = GmailApp.getUserLabelByName(LIBELLE_TRAITE) || GmailApp.createLabel(LIBELLE_TRAITE);
  var fils = GmailApp.search(requete, 0, 60);
  if (!fils.length) return 0;
  var f = feuilleDonnees_(), v = f.getDataRange().getValues(), existantes = {};
  for (var i = 1; i < v.length; i++) if (v[i][0] === 'annonces') { var e = depuisLigne_(v[i]); existantes[e.id] = e.data; }
  var lot = {}, maintenant = new Date().toISOString();
  fils.forEach(function (fil) {
    fil.getMessages().forEach(function (m) {
      extraireAnnonces_(m.getFrom(), m.getSubject(), m.getPlainBody(), m.getDate().toISOString()).forEach(function (a) {
        var base = lot[a.id] || existantes[a.id];
        if (!base || !base.surface) completerBienici_(a);
        lot[a.id] = fusionnerAnnonce_(base, a);
      });
    });
  });
  var enr = Object.keys(lot).map(function (id) { var d = lot[id]; d.id = id; return { coll: 'annonces', id: id, majLe: maintenant, data: d }; });
  if (enr.length) ecrire_(enr, 'alertes');
  fils.forEach(function (fil) { fil.addLabel(libelle); });
  return enr.length;
}

/* ---------- Lecture d'une annonce à partir de son lien ----------
   Les sites protégés (Leboncoin, SeLoger) refusent souvent les lectures automatiques : Marchéo propose alors de coller le texte. */
function lireAnnonce_(url) {
  if (!/^https:\/\/[^\s]+$/.test(url)) throw erreur_('Lien invalide.', 'LIEN');
  var bi = url.match(/bienici\.com\/annonce\/(?:[^\/?#]+\/)*?([^\/?#]+)(?:[?#]|$)/);
  if (bi) { var x = lireBienici_(bi[1]); if (x) { x.lien = 'https://www.bienici.com/annonce/' + bi[1]; return x; } }
  var rep = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'fr-FR,fr;q=0.9' } });
  var code = rep.getResponseCode();
  if (code >= 400) return { bloque: true, code: code };
  return extraireDePage_(rep.getContentText(), url);
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
/* Bien'ici : données publiques de l'annonce (realEstateAd.json), vérifiées sur une annonce réelle */
var TYPES_BIENICI = { flat: 'appt', house: 'maison', parking: 'box', premises: 'local', shop: 'local', office: 'local', building: 'immeuble', terrain: 'terrain', land: 'terrain' };
function lireBienici_(id) {
  var rep = UrlFetchApp.fetch('https://www.bienici.com/realEstateAd.json?id=' + encodeURIComponent(id), { muteHttpExceptions: true });
  if (rep.getResponseCode() !== 200) return null;
  var d; try { d = JSON.parse(rep.getContentText()); } catch (e) { return null; }
  return depuisBienici_(d);
}
function depuisBienici_(d) {
  if (!d || !d.price) return null;
  var desc = decoder_(String(d.description || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
  var a = { source: "Bien'ici", titre: d.title || d.generatedTitle || '', texte: desc.slice(0, 3000), prix: +d.price || 0, surface: +d.surfaceArea || 0,
    pieces: +d.roomsQuantity || 0, cp: String(d.postalCode || ''), ville: d.city || '', dpe: d.energyClassification || '', type: TYPES_BIENICI[d.propertyType] || '',
    chargesAnnuelles: +d.annualCondominiumFees || 0, baissePrix: !!d.priceHasDecreased };
  if (!a.titre) a.titre = [{ appt: 'Appartement', maison: 'Maison', box: 'Parking', local: 'Local', immeuble: 'Immeuble', terrain: 'Terrain' }[a.type] || 'Bien', a.pieces ? a.pieces + ' pièce' + (a.pieces > 1 ? 's' : '') : '', a.surface ? a.surface + ' m²' : ''].filter(Boolean).join(' ');
  return a;
}
/* Complète les annonces Bien'ici reçues par alerte (surface, pièces, DPE, charges absents de l'e-mail) */
function completerBienici_(a) {
  if (!a.idSource || a.source !== "Bien'ici" || a.surface) return a;
  try { var x = lireBienici_(a.idSource); if (x) ['surface', 'pieces', 'dpe', 'type', 'chargesAnnuelles', 'texte'].forEach(function (k) { if (x[k] && !a[k]) a[k] = x[k]; }); } catch (e) { /* lecture impossible : l'annonce reste à compléter */ }
  return a;
}

/* Photos de visite : un dossier Drive « Marchéo — photos », un sous-dossier par projet */
function dossier_(parent, nom) { var it = parent.getFoldersByName(nom); return it.hasNext() ? it.next() : parent.createFolder(nom); }
function deposerPhoto_(bienId, nom, base64, type) {
  if (!base64 || base64.length > 12000000) throw erreur_('Photo ou document absent ou trop lourd.', 'PHOTO');
  if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(type || '')) type = 'image/jpeg';
  var d = dossier_(dossier_(DriveApp.getRootFolder(), 'Marchéo — photos'), bienId.replace(/[^\w-]/g, '').slice(0, 40) || 'divers');
  var f = d.createFile(Utilities.newBlob(Utilities.base64Decode(base64), type, nom.replace(/[^\w.-]/g, '-').slice(0, 80)));
  return { id: f.getId() };
}
function lirePhoto_(id) {
  if (!/^[\w-]{10,}$/.test(id)) throw erreur_('Photo inconnue.', 'PHOTO');
  var f = DriveApp.getFileById(id), p = f.getParents();
  if (!p.hasNext() || !p.next().getParents().hasNext()) throw erreur_('Photo hors du dossier Marchéo.', 'PHOTO');
  return { base64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/* À exécuter une fois depuis l'éditeur après une mise à jour : demande les autorisations (pages web, Drive pour les photos) */
/* ---------- Ventes comparables DVF (données publiques Etalab, sans clé ni coût) ----------
   1. Géocodage de l'adresse par la Base Adresse Nationale (api-adresse.data.gouv.fr).
   2. Fichiers DVF géolocalisés de la commune (files.data.gouv.fr/geo-dvf), des années les plus récentes.
   3. Ventes d'un seul logement du même type, surface proche, triées par distance puis par date. */
var DVF_TYPES = { appt: 'Appartement', maison: 'Maison', local: 'Local industriel. commercial ou assimilé' };

function geocoder_(adresse, cp, ville) {
  function chercher(q, extra) {
    var url = 'https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(q) + (cp ? '&postcode=' + encodeURIComponent(cp) : '') + (extra || '');
    for (var i = 0; i < 2; i++) {
      try {
        var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (r.getResponseCode() === 200) { var f = (JSON.parse(r.getContentText()).features || [])[0]; return f || null; }
      } catch (e) {}
      url = url.replace('https://api-adresse.data.gouv.fr/search/', 'https://data.geopf.fr/geocodage/search');
    }
    return null;
  }
  var f = adresse ? chercher([adresse, ville].filter(String).join(' ')) : null;
  var precis = !!(f && f.properties.score >= 0.6 && /housenumber|street/.test(f.properties.type));
  if (!precis) f = chercher(ville || cp, '&type=municipality') || f;
  if (!f) return null;
  return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], insee: f.properties.citycode, commune: f.properties.city, cp: f.properties.postcode, libelle: f.properties.label, precis: precis };
}

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

function ventesDVF_(d) {
  var typeLocal = DVF_TYPES[d.type];
  if (!typeLocal) throw erreur_('Type non couvert par DVF (box : ventes de dépendances sans surface).', 'DVF');
  var g = (d.lat && d.insee) ? { lat: +d.lat, lon: +d.lon, insee: String(d.insee), commune: d.ville, precis: true } : geocoder_(String(d.adresse || ''), String(d.cp || ''), String(d.ville || ''));
  if (!g || !g.insee) throw erreur_('Adresse introuvable dans la Base Adresse Nationale.', 'DVF');
  var dep = /^97/.test(g.insee) ? g.insee.slice(0, 3) : g.insee.slice(0, 2), an = new Date().getFullYear(), annees = [];
  for (var y = an; y >= an - 4; y--) annees.push(y);
  var reponses = UrlFetchApp.fetchAll(annees.map(function (y) { return { url: 'https://files.data.gouv.fr/geo-dvf/latest/csv/' + y + '/communes/' + dep + '/' + g.insee + '.csv', muteHttpExceptions: true, followRedirects: true }; }));
  var ventes = [], lues = [];
  reponses.forEach(function (r, i) { if (r.getResponseCode() !== 200) return; lues.push(annees[i]); ventes = ventes.concat(ventesUniques_(lignesCsv_(r.getContentText()), typeLocal)); });
  if (!lues.length) throw erreur_('Fichiers DVF indisponibles pour cette commune.', 'DVF');
  /* Les trois années disponibles les plus récentes : assez de ventes, prix encore actuels */
  var garder = lues.slice(0, 3).map(String);
  ventes = ventes.filter(function (v) { return garder.indexOf(v.date.slice(0, 4)) >= 0; });
  var res = choisirComparables_(ventes, { lat: g.lat, lon: g.lon, surface: d.surface, pieces: d.pieces }, 3);
  res.lieu = { libelle: g.libelle || '', commune: g.commune || '', insee: g.insee, precis: g.precis, lat: g.lat, lon: g.lon };
  res.periode = garder[garder.length - 1] + '–' + garder[0]; res.derniere = ventes.reduce(function (m, v) { return v.date > m ? v.date : m; }, '');
  res.type = typeLocal;
  return res;
}

function autoriserLectureAnnonces() {
  UrlFetchApp.fetch('https://www.bienici.com/', { muteHttpExceptions: true });
  dossier_(DriveApp.getRootFolder(), 'Marchéo — photos');
  Logger.log('Autorisations accordées : lecture des annonces et photos.');
}
function decoder_(t) { return String(t || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&euro;/g, '€').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }); }

/* ---------- Installation et secours ---------- */
function installer() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('CLASSEUR')) p.setProperty('CLASSEUR', SpreadsheetApp.create('Marchéo — données').getId());
  var c = classeur_();
  feuilleDonnees_(); onglet_('comptes', ['identifiant', 'sel', 'empreinte', 'actif']);
  var defaut = c.getSheetByName('Feuille 1') || c.getSheetByName('Sheet1');
  if (defaut && c.getSheets().length > 1) c.deleteSheet(defaut);
  autoriserLectureAnnonces(); // demande dès l'installation l'autorisation de lire une page web (+ Annonce par lien)
  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'importerAlertes'; }))
    ScriptApp.newTrigger('importerAlertes').timeBased().everyHours(1).create();
  if (!comptes_().length) {
    var mdp = Utilities.getUuid().slice(0, 12);
    definirMotDePasse('direction', mdp);
    Logger.log('Accès créé. Identifiant : direction · mot de passe provisoire : ' + mdp);
  } else Logger.log('Déjà installé. Classeur : ' + c.getUrl());
}
function definirMotDePasse(identifiant, motDePasse) {
  identifiant = String(identifiant).trim().toLowerCase();
  if (String(motDePasse).length < 8) throw new Error('8 caractères minimum.');
  var f = onglet_('comptes', ['identifiant', 'sel', 'empreinte', 'actif']), sel = Utilities.getUuid();
  var c = comptes_().filter(function (x) { return x.identifiant === identifiant; })[0];
  var ligne = [identifiant, sel, hacher_(sel, motDePasse), 'oui'];
  if (c) f.getRange(c.ligne, 1, 1, 4).setValues([ligne]); else f.appendRow(ligne);
  Logger.log('Mot de passe défini pour ' + identifiant + '.');
}

if (typeof module !== 'undefined') module.exports = { deposerPhoto_: deposerPhoto_, lirePhoto_: lirePhoto_, depuisBienici_: depuisBienici_, extraireDePage_: extraireDePage_, doPost: doPost, installer: installer, definirMotDePasse: definirMotDePasse, versLigne_: versLigne_, depuisLigne_: depuisLigne_, extraireAnnonces_: extraireAnnonces_, fusionnerAnnonce_: fusionnerAnnonce_ };
