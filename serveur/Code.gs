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

  if (de.indexOf('bienici') >= 0) {
    /* Bien'ici : chaque ligne de texte est suivie du lien de son annonce (…/annonce/<identifiant>?…) */
    var parId = {}, ordre = [];
    for (var i = 1; i < lignes.length; i++) {
      var m = estUrl(lignes[i]) && url(lignes[i]).match(/bienici\.com\/annonce\/([^?\/\]]+)/);
      if (!m || estUrl(lignes[i - 1])) continue;
      if (!parId[m[1]]) { parId[m[1]] = { lignes: [], lien: 'https://www.bienici.com/annonce/' + m[1] }; ordre.push(m[1]); }
      parId[m[1]].lignes.push(lignes[i - 1]);
    }
    ordre.forEach(function (id) {
      var L = parId[id].lignes.filter(function (l) { return !/^(Voir l|Photo$|RÉFÉRENCE)/i.test(l); });
      var prix = 0, titre = '', ville = '';
      L.forEach(function (l) { var p = l.match(RE_PRIX); if (p && !prix) prix = nombre_(p[1]); else if (/^\d{5}\s/.test(l)) ville = l; else if (!titre) titre = l; });
      out.push(enrichir_({ source: "Bien'ici", idSource: id, titre: titre, texte: L.join(' · ') + (ville ? ' ' + ville : ''), prix: prix, lien: parId[id].lien }));
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
    out = out.filter(function (b) { return b.lignes; }).map(function (b) {
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
  ['titre', 'texte', 'lien', 'cp', 'ville', 'surface', 'lots', 'dpe', 'prixM2Annonce'].forEach(function (k) { if (nouvelle[k]) a[k] = nouvelle[k]; });
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
        lot[a.id] = fusionnerAnnonce_(base, a);
      });
    });
  });
  var enr = Object.keys(lot).map(function (id) { var d = lot[id]; d.id = id; return { coll: 'annonces', id: id, majLe: maintenant, data: d }; });
  if (enr.length) ecrire_(enr, 'alertes');
  fils.forEach(function (fil) { fil.addLabel(libelle); });
  return enr.length;
}

/* ---------- Installation et secours ---------- */
function installer() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('CLASSEUR')) p.setProperty('CLASSEUR', SpreadsheetApp.create('Marchéo — données').getId());
  var c = classeur_();
  feuilleDonnees_(); onglet_('comptes', ['identifiant', 'sel', 'empreinte', 'actif']);
  var defaut = c.getSheetByName('Feuille 1') || c.getSheetByName('Sheet1');
  if (defaut && c.getSheets().length > 1) c.deleteSheet(defaut);
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

if (typeof module !== 'undefined') module.exports = { doPost: doPost, installer: installer, definirMotDePasse: definirMotDePasse, versLigne_: versLigne_, depuisLigne_: depuisLigne_, extraireAnnonces_: extraireAnnonces_, fusionnerAnnonce_: fusionnerAnnonce_ };
