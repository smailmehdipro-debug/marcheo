# Mise en ligne du serveur Marchéo hébergé

Étapes à faire par une personne, une seule fois. Comptez environ une heure. Rien de tout cela n'a été exécuté : le code a été construit et testé en local, sans compte Cloudflare.

## 0. Prérequis

- Un compte Cloudflare (l'offre gratuite suffit pour démarrer).
- Un nom de domaine géré par Cloudflare, par exemple `marcheo.fr`. Il est nécessaire pour les adresses de transfert `<adresse>@alertes.marcheo.fr`.
- Node.js 22 ou plus récent sur le poste.

```bash
cd serveur-cloudflare
npm install
npx wrangler login
```

## 1. Base D1 et stockage R2

```bash
npx wrangler d1 create marcheo
```

Recopiez le `database_id` affiché dans `wrangler.toml` (ligne `database_id`), puis :

```bash
npm run base:distante
npx wrangler r2 bucket create marcheo-stockage
```

## 2. Variables

Dans `wrangler.toml` :

- `ALERTES_DOMAINE` : `alertes.<votre domaine>`.
- `APP_URL` : l'adresse publique de l'application, utilisée dans les liens « mot de passe oublié ».

## 3. Déploiement du Worker

```bash
npm run deploy
```

Notez l'adresse du Worker, par exemple `https://marcheo-serveur.<compte>.workers.dev`. Un nom de domaine personnalisé (`api.<domaine>`) peut se brancher ensuite dans Cloudflare → Workers → Domaines.

Vérification : ouvrez cette adresse dans le navigateur. Elle doit répondre :

```json
{"ok":true,"application":"Marchéo","message":"Serveur en service."}
```

**Offre Workers :** l'offre gratuite limite le calcul à 10 ms par requête. La lecture d'un e-mail d'alerte ou d'un fichier DVF peut dépasser cette limite. Si des erreurs « CPU time exceeded » apparaissent dans les journaux (`npx wrangler tail`), passez à l'offre Workers payante (environ 5 $ par mois, tarif à vérifier sur cloudflare.com).

## 4. Réception des alertes (Email Routing)

1. Cloudflare → votre domaine → Email → Email Routing → activer, puis laisser Cloudflare créer les enregistrements DNS (MX et SPF) du sous-domaine `alertes`.
2. Routing rules → **Catch-all address** → action **Send to a Worker** → `marcheo-serveur`.
3. Essai :
   - Créez un compte dans l'application.
   - Copiez l'adresse de transfert affichée.
   - Depuis une boîte Gmail, ajoutez cette adresse comme adresse de transfert (Paramètres → Transfert et POP/IMAP).
   - Le code de confirmation doit s'afficher dans Marchéo en moins d'une minute.

## 5. Paiement (Stripe)

1. Stripe → Produits : créer l'abonnement Pro, puis un **lien de paiement** (Payment Link).
2. Dans le lien de paiement, transmettre l'identifiant du compte Marchéo dans `client_reference_id`. Sinon, Stripe retrouve le compte par l'adresse e-mail saisie au paiement, qui doit alors être celle du compte.
3. Stripe → Développeurs → Webhooks → ajouter le point de terminaison `https://<worker>/stripe`, avec les événements `checkout.session.completed` et `customer.subscription.deleted`.
4. Copier le secret de signature du webhook, puis :

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

## 6. Envoi des e-mails « mot de passe oublié »

Le serveur appelle `env.ENVOI.envoyer({ a, sujet, texte })`. En local et dans les tests, c'est un journal. En production, il faut brancher un service d'envoi : Cloudflare Email Sending, ou un fournisseur (Brevo, Postmark, Resend) appelé en `fetch` avec une clé stockée par `wrangler secret put`. **Tant que ce n'est pas fait, « mot de passe oublié » répond normalement mais n'envoie rien.**

## 7. Brancher l'application

Dans `js/donnees.js`, renseignez l'adresse du Worker :

```js
const SERVEUR_MARCHEO = 'https://marcheo-serveur.<compte>.workers.dev';
```

Puis poussez sur `main`. Dès lors, les nouveaux visiteurs voient l'accueil « Voir la démo / Créer mon compte / Me connecter ».

Pour essayer avant de modifier le fichier : ouvrez l'application avec `?serveur=https://<worker>` (réglage gardé par le navigateur).

## 8. Migrer un client installé sur Google Apps Script

1. Le client ouvre Marchéo, toujours connecté à son serveur Apps Script, puis Réglages → **Exporter une sauvegarde** (fichier `.json`).
2. Il se déconnecte, crée son compte Marchéo (« Créer mon compte »), puis Réglages → **Importer une sauvegarde**. Toutes ses fiches partent vers le nouveau serveur.
3. Les photos restent dans son Google Drive. Les anciennes ne sont pas recopiées ; les nouvelles iront dans R2.
4. Il remplace dans Gmail son ancien fonctionnement (lecture directe par Apps Script) par le filtre de transfert, en suivant la page « Recevoir mes alertes ». Il peut ensuite désactiver le déclencheur horaire `importerAlertes` de son script.

`serveur/Code.gs` continue de fonctionner tel quel pour les clients qui ne migrent pas.

## Essai en local (sans compte Cloudflare)

```bash
cd serveur-cloudflare
npm install
npm run base:locale
npx wrangler dev --port 8787
```

Ouvrez ensuite l'application avec `?serveur=http://127.0.0.1:8787`.

Pour simuler un e-mail reçu, le fichier `.eml` doit avoir un en-tête `Message-ID` :

```bash
curl -X POST "http://127.0.0.1:8787/cdn-cgi/handler/email?from=client%40gmail.com&to=<adresse>%40alertes.exemple.fr" --data-binary @alerte.eml
```

Ce parcours a été vérifié le 27/11/2026 avec wrangler 4 et le runtime workerd : inscription, code de confirmation Gmail affiché, alerte Bien'ici reçue, annonces synchronisées et triées.
