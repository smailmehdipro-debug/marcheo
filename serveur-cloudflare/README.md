# Marchéo : serveur hébergé (Cloudflare Workers)

Un seul serveur pour tous les clients, des comptes isolés, aucune installation chez le client.

| Brique | Rôle |
| --- | --- |
| `src/index.js` | Point d'entrée du Worker. `fetch` reçoit le protocole de l'application et le webhook Stripe (`/stripe`) ; `email` reçoit les alertes transférées. |
| `src/serveur.js` | Comptes, jetons, fiches, alertes, offres et limites, photos, DVF. Même protocole et mêmes actions que `serveur/Code.gs`. |
| `src/mime.js` | Lecture des e-mails bruts, sans dépendance. Produit le même texte que `getPlainBody()` de Gmail. |
| `../serveur/commun.js` | Fonctions pures partagées avec le serveur Apps Script : lecture des alertes, des pages d'annonce et des fichiers DVF. |
| `schema.sql` | Tables D1 : `comptes`, `jetons`, `reinitialisations`, `fiches`, `transferts`, `usage`, `essais`. |

## Protocole

`POST` avec un corps JSON `{action, jeton, donnees}`. Réponse : `{ok: true, resultat}`, ou `{ok: false, code, message}` en cas d'erreur.

- Actions reprises de `Code.gs` : `connexion`, `lire`, `ecrire`, `deconnexion`, `lireAnnonce`, `deposerPhoto`, `lirePhoto`, `ventesDVF`.
- Nouvelles actions : `inscription`, `motDePasseOublie`, `reinitialiserMotDePasse`, `compte`, `etatTransfert`.
- `ecrire` peut aussi renvoyer `bloques`, la liste des fiches refusées par une limite de l'offre gratuite.

## Tests

À la racine du dépôt, sans compte ni installation :

```bash
node --test test/*.test.js
```

- `test/worker.test.js` : comptes, isolation entre comptes, synchronisation, alertes (avec équivalence vérifiée contre `Code.gs`), confirmation de transfert, offres, Stripe, DVF, lecture d'annonce, parcours complet.
- `test/mime.test.js` : lecture des e-mails.

D1 est simulé par SQLite (`node:sqlite`), R2 en mémoire.

## Mise en ligne

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md). Les choix techniques sont dans [DECISIONS.md](DECISIONS.md).
