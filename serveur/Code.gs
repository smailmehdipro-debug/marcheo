/* Marchéo · serveur Google Apps Script (gratuit, sur le compte Google de l'utilisateur)
   Installation :
   1. script.google.com > Nouveau projet > coller ce fichier.
   2. Exécuter installer() une fois : crée le classeur « Marchéo — données » et un accès,
      identifiant et mot de passe provisoire affichés dans le journal d'exécution.
   3. Déployer > Nouveau déploiement > Application Web : exécuter en tant que « Moi », accès « Tout le monde ».
   4. Copier l'adresse de l'application Web dans l'écran de connexion de Marchéo.
   Mot de passe perdu : exécuter definirMotDePasse('identifiant', 'nouveau mot de passe').

   Format : onglet « donnees », une ligne par fiche : coll | id | majLe | supprime | recuLe | json | json_2…
   majLe : date de modification sur l'appareil (départage deux versions d'une même fiche) ;
   recuLe : date de réception par le serveur (lecture incrémentale : une modification faite hors connexion,
   donc datée d'avant, est quand même transmise aux autres appareils).
   (JSON découpé en morceaux de 45 000 caractères, préfixe « ~ » pour que Sheets ne l'interprète jamais). */

var COLLS = ['biens', 'contacts', 'relances', 'journal', 'reglages'];
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

/* ---------- Installation et secours ---------- */
function installer() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('CLASSEUR')) p.setProperty('CLASSEUR', SpreadsheetApp.create('Marchéo — données').getId());
  var c = classeur_();
  feuilleDonnees_(); onglet_('comptes', ['identifiant', 'sel', 'empreinte', 'actif']);
  var defaut = c.getSheetByName('Feuille 1') || c.getSheetByName('Sheet1');
  if (defaut && c.getSheets().length > 1) c.deleteSheet(defaut);
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

if (typeof module !== 'undefined') module.exports = { doPost: doPost, installer: installer, definirMotDePasse: definirMotDePasse, versLigne_: versLigne_, depuisLigne_: depuisLigne_ };
