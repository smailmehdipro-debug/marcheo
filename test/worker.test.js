/* Serveur hébergé (serveur-cloudflare/) testé en local : D1 simulé par SQLite, R2 en mémoire, réseau simulé.
   Couvre comptes, isolation entre comptes, synchronisation, alertes par e-mail (équivalence avec Code.gs),
   confirmation de transfert Gmail, offres et limites, webhook Stripe, photos, DVF, et le parcours complet. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { d1, r2, envoi, reponse } = require('./aides/cloudflare.js');
const { eml } = require('./aides/eml.js');

const alerte = f => fs.readFileSync(path.join(__dirname, 'alertes', f), 'utf8').replace(/\r\n/g, '\n');
const DOMAINE = 'alertes.exemple.fr';

/* Code.gs + commun.js, comme dans Apps Script : référence pour l'équivalence */
function codeGs() {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../serveur/commun.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../serveur/Code.gs'), 'utf8'), ctx);
  return ctx;
}

async function environnement(o = {}) {
  const { creerServeur } = await import('../serveur-cloudflare/src/serveur.js');
  const horloge = { t: new Date('2026-11-27T12:00:00Z').getTime() };
  const env = { DB: d1(), STOCKAGE: r2(), ENVOI: envoi(), ALERTES_DOMAINE: DOMAINE, APP_URL: 'https://app.exemple.fr/', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
  const appels = [];
  const fetch = o.fetch || (async (url) => { appels.push(url); return reponse(404, ''); });
  const S = creerServeur(env, { fetch: async (...a) => { appels.push(a[0]); return fetch(...a); }, maintenant: () => new Date(horloge.t), completer: o.completer });
  let ip = 0;
  const appel = async (action, donnees, jeton, ctx) => JSON.parse(JSON.stringify(await S.appel(JSON.stringify({ action, donnees, jeton }), ctx || { ip: '10.0.0.' + (++ip % 250) })));
  const inscrire = async (email, mdp = 'motdepasse1') => (await appel('inscription', { email, motDePasse: mdp })).resultat;
  const courriel = (a, de, objet, texte, extra = {}) => S.recevoirEmail({ destinataire: a, octets: Buffer.from(eml(Object.assign({ de, a, objet, texte, transfertPour: a }, extra))) });
  return { S, env, horloge, appel, inscrire, courriel, appels };
}

test('inscription, connexion, session, déconnexion', async () => {
  const E = await environnement();
  const c = await E.inscrire('Client@Exemple.fr');
  assert.ok(c.jeton && c.adresseTransfert.endsWith('@' + DOMAINE));
  assert.match(c.adresseTransfert, /^[a-z2-9]{10}@/, 'adresse de transfert aléatoire');
  assert.equal((await E.appel('inscription', { email: 'client@exemple.fr', motDePasse: 'autremotdepasse' })).code, 'EXISTE');
  assert.equal((await E.appel('inscription', { email: 'pas-une-adresse', motDePasse: 'motdepasse1' })).code, 'INSCRIPTION');
  assert.equal((await E.appel('inscription', { email: 'b@exemple.fr', motDePasse: 'court' })).code, 'INSCRIPTION');
  assert.equal((await E.appel('lire', {}, '')).code, 'SESSION');
  assert.equal((await E.appel('connexion', { email: 'client@exemple.fr', motDePasse: 'faux' })).code, 'ACCES');
  const r = await E.appel('connexion', { identifiant: 'CLIENT@exemple.fr', motDePasse: 'motdepasse1' });
  assert.ok(r.ok, 'connexion par identifiant (protocole Code.gs) acceptée');
  const ligne = await E.env.DB.prepare('SELECT empreinte, iterations FROM comptes').first();
  assert.equal(ligne.iterations, 100000); assert.equal(ligne.empreinte.length, 64, 'PBKDF2 SHA-256');
  assert.ok((await E.appel('lire', {}, r.resultat.jeton)).ok);
  assert.ok((await E.appel('deconnexion', {}, r.resultat.jeton)).ok);
  assert.equal((await E.appel('lire', {}, r.resultat.jeton)).code, 'SESSION', 'jeton supprimé à la déconnexion');
  E.horloge.t += 61 * 86400000;
  assert.equal((await E.appel('lire', {}, c.jeton)).code, 'SESSION', 'jeton expiré après 60 jours');
});

test('freinage des essais de connexion', async () => {
  const E = await environnement();
  await E.inscrire('a@exemple.fr');
  const ctx = { ip: '1.2.3.4' };
  for (let i = 0; i < 10; i++) assert.equal((await E.appel('connexion', { email: 'a@exemple.fr', motDePasse: 'faux' + i }, '', ctx)).code, 'ACCES');
  assert.equal((await E.appel('connexion', { email: 'a@exemple.fr', motDePasse: 'motdepasse1' }, '', ctx)).code, 'FREIN', 'onzième essai refusé, même juste');
  E.horloge.t += 16 * 60000;
  assert.ok((await E.appel('connexion', { email: 'a@exemple.fr', motDePasse: 'motdepasse1' }, '', ctx)).ok, 'de nouveau possible après 15 minutes');
});

test('mot de passe oublié : lien d\'une heure, sessions fermées', async () => {
  const E = await environnement();
  const c = await E.inscrire('a@exemple.fr');
  assert.deepEqual((await E.appel('motDePasseOublie', { email: 'inconnu@exemple.fr' })).resultat, { fait: true }, 'même réponse pour un compte inconnu');
  assert.equal(E.env.ENVOI.boite.length, 0);
  await E.appel('motDePasseOublie', { email: 'a@exemple.fr' });
  const lien = E.env.ENVOI.boite[0].texte.match(/#\/reinitialiser\/(\w+)/)[1];
  assert.ok((await E.appel('reinitialiserMotDePasse', { jeton: lien, motDePasse: 'nouveaumotdepasse' })).ok);
  assert.equal((await E.appel('lire', {}, c.jeton)).code, 'SESSION', 'anciennes sessions fermées');
  assert.equal((await E.appel('reinitialiserMotDePasse', { jeton: lien, motDePasse: 'encoreunautre' })).code, 'LIEN', 'lien à usage unique');
  assert.ok((await E.appel('connexion', { email: 'a@exemple.fr', motDePasse: 'nouveaumotdepasse' })).ok);
});

test('lire et écrire : la plus récente gagne, lecture incrémentale, collections connues seulement', async () => {
  const E = await environnement();
  const { jeton } = await E.inscrire('a@exemple.fr');
  let e = await E.appel('ecrire', { enregistrements: [
    { coll: 'biens', id: 'b1', majLe: '2026-11-27T10:00:00.000Z', data: { id: 'b1', note: 'x'.repeat(120000) } },
    { coll: 'contacts', id: 'c1', majLe: '2026-11-27T10:00:00.000Z', data: { id: 'c1', nom: 'Agence' } },
    { coll: 'inconnue', id: 'z', majLe: '2026-11-27T10:00:00.000Z', data: {} }
  ] }, jeton);
  assert.equal(e.resultat.ecrits, 2);
  let l = (await E.appel('lire', { depuis: '' }, jeton)).resultat;
  assert.equal(l.enregistrements.length, 2);
  assert.equal(l.enregistrements.find(x => x.id === 'b1').data.note.length, 120000);
  const depuis = l.horodatage;
  e = await E.appel('ecrire', { enregistrements: [{ coll: 'contacts', id: 'c1', majLe: '2026-11-27T09:00:00.000Z', data: { id: 'c1', nom: 'ancienne' } }] }, jeton);
  assert.equal(e.resultat.refuses.length, 1, 'version plus ancienne refusée');
  assert.equal(e.resultat.refuses[0].data.nom, 'Agence', 'la version du serveur est renvoyée');
  E.horloge.t += 1000;
  await E.appel('ecrire', { enregistrements: [{ coll: 'contacts', id: 'c1', majLe: '2026-11-27T11:00:00.000Z', supprime: true, data: { id: 'c1', _supprime: true } }] }, jeton);
  l = (await E.appel('lire', { depuis }, jeton)).resultat;
  assert.ok(l.enregistrements.some(x => x.id === 'c1' && x.supprime), 'suppression transmise');
  assert.ok(l.horodatage > depuis);
});

test('isolation : un compte ne lit ni n\'écrit jamais les fiches d\'un autre', async () => {
  const E = await environnement();
  const A = await E.inscrire('a@exemple.fr'), B = await E.inscrire('b@exemple.fr');
  await E.appel('ecrire', { enregistrements: [{ coll: 'biens', id: 'commun', majLe: '2026-11-27T10:00:00.000Z', data: { id: 'commun', proprietaire: 'A' } }] }, A.jeton);
  assert.equal((await E.appel('lire', { depuis: '' }, B.jeton)).resultat.enregistrements.length, 0, 'B ne voit rien de A');
  /* B écrit le même identifiant, plus récent : la fiche de A reste intacte */
  const e = await E.appel('ecrire', { enregistrements: [{ coll: 'biens', id: 'commun', majLe: '2026-11-27T12:00:00.000Z', data: { id: 'commun', proprietaire: 'B' } }] }, B.jeton);
  assert.equal(e.resultat.refuses.length, 0);
  assert.equal((await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements[0].data.proprietaire, 'A');
  assert.equal((await E.appel('lire', { depuis: '' }, B.jeton)).resultat.enregistrements[0].data.proprietaire, 'B');
  /* photos : B ne peut pas lire la photo de A, même avec son identifiant */
  const p = (await E.appel('deposerPhoto', { bienId: 'commun', nom: 'a.jpg', base64: Buffer.from('photo A').toString('base64'), type: 'image/jpeg' }, A.jeton)).resultat;
  assert.equal((await E.appel('lirePhoto', { id: p.id }, B.jeton)).code, 'PHOTO');
  assert.equal(Buffer.from((await E.appel('lirePhoto', { id: p.id }, A.jeton)).resultat.base64, 'base64').toString(), 'photo A');
  /* alertes : l'e-mail adressé à A n'arrive que chez A */
  await E.courriel(A.adresseTransfert, 'Bien’ici <no_reply@bienici.com>', '2 nouvelles annonces', alerte('bienici.txt'));
  assert.equal((await E.appel('lire', { depuis: '' }, B.jeton)).resultat.enregistrements.filter(x => x.coll === 'annonces').length, 0);
  assert.equal((await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements.filter(x => x.coll === 'annonces').length, 2);
});

test('alertes par e-mail : mêmes annonces que Code.gs (Bien\'ici et SeLoger), expéditeur contrôlé', async () => {
  const G = codeGs(), E = await environnement();
  const A = await E.inscrire('a@exemple.fr');
  for (const [f, de, objet] of [['bienici.txt', 'Bien’ici <no_reply@bienici.com>', '2 nouvelles annonces'], ['seloger.txt', 'SeLoger <annonces@alertes.seloger.com>', '1 nouvelle annonce : 93100']]) {
    const date = '2026-11-27T12:00:00.000Z';
    const attendu = G.extraireAnnonces_(de, objet, alerte(f), date);
    const r = await E.courriel(A.adresseTransfert, de, objet, alerte(f));
    assert.equal(r.annonces, attendu.length, f);
    const lues = (await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements.filter(x => x.coll === 'annonces').map(x => x.data);
    for (const a of attendu) {
      const b = lues.find(x => x.id === a.id);
      assert.ok(b, f + ' : annonce ' + a.id + ' reçue');
      for (const k of ['prix', 'titre', 'lien', 'cp', 'ville', 'surface', 'source', 'idSource']) assert.deepEqual(b[k], a[k], f + ' : ' + k);
      assert.equal(b.statutTri, 'nouvelle');
    }
  }
  assert.deepEqual(await E.courriel(A.adresseTransfert, 'Inconnu <promo@boutique.fr>', 'Promo 1 000 000 €', '1 500 000 €'), { ignore: 'expéditeur non reconnu : promo@boutique.fr' });
  assert.deepEqual(await E.courriel('personne@' + DOMAINE, 'Bien’ici <no_reply@bienici.com>', 'x', alerte('bienici.txt')), { ignore: 'destinataire inconnu' });
  /* une deuxième alerte avec un prix plus bas est fusionnée : baisse de prix notée */
  const baisse = alerte('bienici.txt').replace('742 000 €', '700 000 €');
  await E.courriel(A.adresseTransfert, 'Bien’ici <no_reply@bienici.com>', '1 nouvelle annonce', baisse);
  const a = (await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements.find(x => x.data.prix === 700000).data;
  assert.equal(a.prixPrecedent, 742000); assert.equal(a.alertes, 2);
});

test('confirmation de transfert Gmail : code et lien affichés, puis première annonce', async () => {
  const E = await environnement();
  const A = await E.inscrire('a@exemple.fr');
  let t = (await E.appel('etatTransfert', {}, A.jeton)).resultat;
  assert.equal(t.adresse, A.adresseTransfert); assert.equal(t.confirmation, null); assert.equal(t.premiereAnnonce, '');
  const corps = 'client@gmail.com a demandé à transférer automatiquement ses messages vers votre adresse e-mail.\n\nPour autoriser client@gmail.com à transférer ses messages, cliquez sur le lien ci-dessous :\n\nhttps://mail-settings.google.com/mail/vf-%5BABC%5D-XYZ\n\nCode de confirmation : 123456789\n';
  await E.S.recevoirEmail({ destinataire: A.adresseTransfert, octets: Buffer.from(eml({ de: 'L\'équipe Gmail <forwarding-noreply@google.com>', a: A.adresseTransfert, objet: '(#123456789) Confirmation de transfert – Recevez les messages de client@gmail.com', texte: corps })) });
  t = (await E.appel('etatTransfert', {}, A.jeton)).resultat;
  assert.equal(t.confirmation.code, '123456789');
  assert.equal(t.confirmation.lien, 'https://mail-settings.google.com/mail/vf-%5BABC%5D-XYZ');
  await E.courriel(A.adresseTransfert, 'Bien’ici <no_reply@bienici.com>', '2 nouvelles annonces', alerte('bienici.txt'));
  assert.ok((await E.appel('etatTransfert', {}, A.jeton)).resultat.premiereAnnonce, 'première annonce reçue');
});

test('offres : essai de 7 jours, puis gratuit sans perte de données, limites appliquées par le serveur', async () => {
  const E = await environnement();
  const A = await E.inscrire('a@exemple.fr');
  assert.equal((await E.appel('compte', {}, A.jeton)).resultat.offre, 'essai');
  const bien = (id, etape) => ({ coll: 'biens', id, majLe: new Date(E.horloge.t).toISOString(), data: { id, etape } });
  assert.equal((await E.appel('ecrire', { enregistrements: [bien('b1', 'repere'), bien('b2', 'etude')] }, A.jeton)).resultat.ecrits, 2, 'essai : projets illimités');
  E.horloge.t += 8 * 86400000;
  let c = (await E.appel('compte', {}, A.jeton)).resultat;
  assert.equal(c.offre, 'gratuit', 'bascule automatique après 7 jours');
  assert.equal((await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements.length, 2, 'aucune donnée supprimée');
  /* 1 projet actif : un troisième projet actif est bloqué, un projet écarté passe */
  const e = (await E.appel('ecrire', { enregistrements: [bien('b3', 'repere'), bien('b4', 'ecarte')] }, A.jeton)).resultat;
  assert.deepEqual(e.bloques.map(x => x.id), ['b3']); assert.equal(e.ecrits, 1);
  assert.equal((await E.appel('ecrire', { enregistrements: [bien('b1', 'etude')] }, A.jeton)).resultat.ecrits, 1, 'un projet déjà actif reste modifiable');
  /* 20 annonces par mois : la 21e est reçue mais masquée */
  for (let i = 0; i < 21; i++) {
    const texte = 'Nouvelle annonce\nAppartement ' + (30 + i) + ' m² à Bondy\n' + (100000 + i * 1000).toLocaleString('fr-FR').replace(/ /g, ' ') + ' €\nhttps://www.pap.fr/annonces/' + i;
    await E.courriel(A.adresseTransfert, 'PAP <alertes@pap.fr>', 'Nouvelle annonce ' + i, texte);
  }
  c = (await E.appel('compte', {}, A.jeton)).resultat;
  assert.equal(c.usage.annoncesMois, 21); assert.equal(c.masquees, 1);
  const annonces = (await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements.filter(x => x.coll === 'annonces');
  assert.equal(annonces.length, 21, 'toutes reçues');
  const masquee = annonces.find(x => x.data.masquee);
  assert.ok(masquee && masquee.data.prix === undefined, 'contenu de l\'annonce masquée non transmis');
  /* 3 recherches DVF par mois */
  const E2 = await environnement({ fetch: fauxReseauDVF() });
  const B = await E2.inscrire('b@exemple.fr'); E2.horloge.t += 8 * 86400000;
  for (let i = 0; i < 3; i++) assert.ok((await E2.appel('ventesDVF', { type: 'maison', cp: '78711', ville: 'Mantes-la-Ville', surface: 100 }, B.jeton)).ok, 'recherche ' + (i + 1));
  assert.equal((await E2.appel('ventesDVF', { type: 'maison', cp: '78711', ville: 'Mantes-la-Ville', surface: 100 }, B.jeton)).code, 'LIMITE');
});

test('paiement : webhook Stripe signé, passage en Pro, annonces masquées rendues visibles', async () => {
  const E = await environnement();
  const A = await E.inscrire('a@exemple.fr'); E.horloge.t += 8 * 86400000;
  const signer = corps => { const t = Math.floor(E.horloge.t / 1000); return 't=' + t + ',v1=' + crypto.createHmac('sha256', 'whsec_test').update(t + '.' + corps).digest('hex'); };
  for (let i = 0; i < 21; i++) await E.courriel(A.adresseTransfert, 'PAP <alertes@pap.fr>', 'Annonce ' + i, 'Studio ' + (15 + i) + ' m²\n' + (90000 + i * 1000) + ' €\nhttps://www.pap.fr/a/' + i);
  assert.equal((await E.appel('compte', {}, A.jeton)).resultat.masquees, 1);
  const compteId = (await E.env.DB.prepare('SELECT id FROM comptes').first()).id;
  const ev = JSON.stringify({ type: 'checkout.session.completed', data: { object: { client_reference_id: compteId, customer: 'cus_1' } } });
  await assert.rejects(E.S.stripe(ev, 't=1,v1=faux'), /Signature Stripe invalide/);
  assert.deepEqual(await E.S.stripe(ev, signer(ev)), { traite: true });
  const c = (await E.appel('compte', {}, A.jeton)).resultat;
  assert.equal(c.offre, 'pro'); assert.equal(c.masquees, 0);
  assert.ok((await E.appel('lire', { depuis: '' }, A.jeton)).resultat.enregistrements.every(x => !x.data.masquee));
  const fin = JSON.stringify({ type: 'customer.subscription.deleted', data: { object: { customer: 'cus_1' } } });
  await E.S.stripe(fin, signer(fin));
  assert.equal((await E.appel('compte', {}, A.jeton)).resultat.offre, 'gratuit', 'abonnement résilié : retour au gratuit');
});

/* Réseau simulé : Base Adresse Nationale et un fichier DVF réel (extrait de Mantes-la-Ville, 2025) */
function fauxReseauDVF() {
  const csv = fs.readFileSync(path.join(__dirname, 'alertes', 'dvf-78362-extrait.csv'), 'utf8');
  return async url => {
    if (/geocodage|api-adresse/.test(url)) return reponse(200, { features: [{ geometry: { coordinates: [1.7117, 48.9667] }, properties: { citycode: '78362', city: 'Mantes-la-Ville', postcode: '78711', label: 'Mantes-la-Ville', score: 0.9, type: 'municipality' } }] });
    if (/geo-dvf\/latest\/csv\/2025\/communes\/78\/78362\.csv/.test(url)) return reponse(200, csv);
    return reponse(404, '');
  };
}

test('ventes DVF : comparables, cache par commune et par année', async () => {
  const E = await environnement({ fetch: fauxReseauDVF() });
  const A = await E.inscrire('a@exemple.fr');
  const r = (await E.appel('ventesDVF', { type: 'maison', cp: '78711', ville: 'Mantes-la-Ville', surface: 100 }, A.jeton)).resultat;
  assert.ok(r.ventes.length > 0 && r.secteur.mediane > 0);
  assert.equal(r.periode, '2025–2025'); assert.equal(r.type, 'Maison');
  assert.ok(E.env.STOCKAGE.objets.has('dvf/2025/78362.csv'), 'fichier mis en cache');
  const avant = E.appels.filter(u => /geo-dvf.*2025/.test(u)).length;
  await E.appel('ventesDVF', { type: 'maison', cp: '78711', ville: 'Mantes-la-Ville', surface: 100 }, A.jeton);
  assert.equal(E.appels.filter(u => /geo-dvf.*2025/.test(u)).length, avant, 'deuxième recherche servie par le cache');
  assert.equal((await E.appel('ventesDVF', { type: 'box', cp: '78711' }, A.jeton)).code, 'DVF');
});

test('lecture d\'une annonce par son lien : page structurée, Bien\'ici, site bloqué', async () => {
  const bi = JSON.parse(fs.readFileSync(path.join(__dirname, 'alertes', 'bienici-annonce.json'), 'utf8'));
  const E = await environnement({ fetch: async url => /realEstateAd\.json/.test(url) ? reponse(200, bi)
    : /leboncoin/.test(url) ? reponse(403, '') : reponse(200, '<html><head><title>Appartement 2 pièces 40 m² - Bondy</title></head><body><script>{"price":[95000],"zipcode":"93140","city":"Bondy"}</script></body></html>') });
  const A = await E.inscrire('a@exemple.fr');
  assert.deepEqual((await E.appel('lireAnnonce', { url: 'https://www.leboncoin.fr/ad/1' }, A.jeton)).resultat, { bloque: true, code: 403 });
  const p = (await E.appel('lireAnnonce', { url: 'https://www.exemple-immo.fr/annonce/1' }, A.jeton)).resultat;
  assert.deepEqual([p.prix, p.cp, p.ville], [95000, '93140', 'Bondy']);
  const b = (await E.appel('lireAnnonce', { url: 'https://www.bienici.com/annonce/vente/triel/abc-123' }, A.jeton)).resultat;
  assert.deepEqual([b.prix, b.surface, b.lien], [64000, 17, 'https://www.bienici.com/annonce/abc-123']);
  assert.equal((await E.appel('lireAnnonce', { url: 'ftp://x' }, A.jeton)).code, 'LIEN');
});

test('parcours complet : inscription → alerte transférée → annonce lue → tri par js/annonces.js', async () => {
  const E = await environnement();
  const MA = require('../js/annonces.js');
  const inscrit = await E.inscrire('nouveau@exemple.fr');
  await E.courriel(inscrit.adresseTransfert, 'SeLoger <annonces@alertes.seloger.com>', '1 nouvelle annonce : 93100', alerte('seloger.txt'));
  const l = (await E.appel('lire', { depuis: '' }, inscrit.jeton)).resultat.enregistrements.filter(x => x.coll === 'annonces');
  assert.equal(l.length, 1);
  const a = l[0].data, e = MA.evaluer(a, {});
  assert.equal(a.prix, 839000);
  assert.equal(e.statut, 'ecartee', 'immeuble à 839 000 € : écarté par les critères par défaut');
  assert.ok(e.motifs.some(m => /prix affiché au-dessus|type hors critères/.test(m)), e.motifs.join(' · '));
});

test('point d\'entrée HTTP : état, protocole, CORS', async () => {
  const W = (await import('../serveur-cloudflare/src/index.js')).default;
  const env = { DB: d1(), STOCKAGE: r2(), ALERTES_DOMAINE: DOMAINE };
  const get = await W.fetch(new Request('https://api.exemple.fr/'), env);
  assert.deepEqual(await get.json(), { ok: true, application: 'Marchéo', message: 'Serveur en service.' });
  const post = await W.fetch(new Request('https://api.exemple.fr/', { method: 'POST', body: JSON.stringify({ action: 'lire', jeton: '', donnees: {} }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }), env);
  assert.equal(post.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(await post.json(), { ok: false, code: 'SESSION', message: 'Session expirée : reconnectez-vous.' });
  const ins = await (await W.fetch(new Request('https://api.exemple.fr/', { method: 'POST', body: JSON.stringify({ action: 'inscription', donnees: { email: 'x@exemple.fr', motDePasse: 'motdepasse1' } }) }), env)).json();
  assert.ok(ins.ok && ins.resultat.jeton);
  const raw = new Blob([eml({ de: 'Bien’ici <no_reply@bienici.com>', a: ins.resultat.adresseTransfert, objet: '2 nouvelles annonces', texte: alerte('bienici.txt') })]).stream();
  await W.email({ to: ins.resultat.adresseTransfert, raw }, env);
  const l = await (await W.fetch(new Request('https://api.exemple.fr/', { method: 'POST', body: JSON.stringify({ action: 'lire', jeton: ins.resultat.jeton, donnees: {} }) }), env)).json();
  assert.equal(l.resultat.enregistrements.length, 2, 'alerte reçue par le gestionnaire email()');
});
