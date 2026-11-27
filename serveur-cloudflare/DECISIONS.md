# Décisions techniques : serveur hébergé

Une ligne par décision : ce qui a été choisi, pourquoi, et l'alternative écartée.

- **Fonctions pures dans `serveur/commun.js`, poussé avec `Code.gs` par clasp.** Une seule copie de la logique de lecture des alertes, des pages et des fichiers DVF. Apps Script et le Worker l'utilisent tous les deux. Écarté : copier le code dans le Worker, qui aurait demandé un test de synchronisation permanent.
- **`commun.js` en JavaScript « script » avec `module.exports` optionnel.** Le même fichier est global dans Apps Script et importable par le Worker (esbuild le convertit). Écarté : un module ES, qu'Apps Script ne sait pas charger.
- **Décodeur MIME maison (`src/mime.js`, 120 lignes).** Il évite toute dépendance d'exécution, donc aucune installation npm pour lancer les tests de l'application. Il couvre quoted-printable, base64, multipart et en-têtes RFC 2047. Écarté : postal-mime, plus complet mais qui oblige à installer `node_modules` pour lancer `node --test`.
- **Équivalence avec `getPlainBody()` : partie `text/plain` en priorité, sinon HTML converti avec le lien sur la ligne qui suit son texte.** C'est le format qu'attend `extraireAnnonces_` (Bien'ici).
- **Expéditeur jugé sur l'en-tête `From` d'origine.** Un transfert par filtre Gmail le conserve. Écarté : l'expéditeur d'enveloppe, réécrit par Gmail (SRS).
- **Mots de passe : PBKDF2-SHA-256, 100 000 itérations, sel aléatoire de 16 octets.** 100 000 est le maximum accepté par WebCrypto sur Cloudflare Workers. Écarté : scrypt ou argon2, absents de WebCrypto.
- **Jetons de session aléatoires de 32 octets, stockés en empreinte SHA-256, valables 60 jours** (même durée que `Code.gs`). Écarté : les JWT, qu'on ne peut pas révoquer à la déconnexion sans table.
- **Freinage : 10 essais par adresse IP et 10 par compte, par fenêtre de 15 minutes, en table D1.** Écarté : Durable Objects ou KV, plus coûteux pour ce volume.
- **La connexion accepte `email` et `identifiant`.** Le protocole de `Code.gs` (`identifiant`) reste valable tel quel.
- **Adresse de transfert aléatoire de 10 caractères** (`a-z` et `2-9`, sans caractère ambigu). Elle évite le spam et ne révèle pas l'identité du client. Écarté : `prenom.nom@`, question laissée ouverte dans le brief.
- **Limites de l'offre gratuite en constantes (`LIMITES`, en tête de `src/serveur.js`).**
  - Annonces : au-delà de 20 par mois, l'annonce est reçue et enregistrée, mais transmise masquée (sans son contenu). L'application l'affiche comme « masquée ».
  - Projet actif en trop : la fiche est refusée (`bloques`) et l'application prévient l'utilisateur.
  - DVF : au-delà de 3 recherches par mois, l'erreur `LIMITE` est renvoyée.
  - Photos : 20 au total.
- **Fin d'essai calculée à la lecture du compte, sans tâche planifiée.** Aucun cron à maintenir, et le résultat est le même. Écarté : un Cron Trigger quotidien.
- **Paiement : vérification de la signature Stripe (HMAC-SHA-256, tolérance de 5 minutes) codée directement.** Aucune bibliothèque Stripe. Le compte est retrouvé par `client_reference_id`, à défaut par l'e-mail. Écarté : le SDK Stripe, lourd pour un Worker.
- **Cache DVF dans R2** (`dvf/<année>/<insee>.csv`). Les années anciennes sont conservées sans limite, l'année en cours et la précédente sont rafraîchies au bout de 30 jours. Écarté : l'API Cache de Cloudflare, locale à chaque datacenter.
- **Photos dans R2 sous la clé `photos/<compte>/<bien>/<aléa>-<nom>`.** `lirePhoto` refuse toute clé qui ne commence pas par le compte du jeton.
- **Réponse d'erreur générique** (« Erreur du serveur ») pour les exceptions non prévues. Aucun détail interne n'est exposé, et les erreurs métier gardent leur code et leur message.
- **Tests du Worker en Node, avec D1 simulé par `node:sqlite` et R2 en mémoire (`test/aides/cloudflare.js`).** Ils tournent avec `node --test test/*.test.js`, sans compte ni installation. Le parcours a aussi été vérifié avec `wrangler dev` et le vrai runtime `workerd` (voir DEPLOIEMENT.md). Écarté : vitest avec le pool Workers, qui ajoute une chaîne d'outils.
- **Adresse du serveur dans `js/donnees.js` (`SERVEUR_MARCHEO`), vide tant que rien n'est déployé.** Quand elle est vide, l'application se comporte exactement comme avant (démo directe, « Autre serveur »). On peut aussi essayer un serveur avec `?serveur=https://…`. Écarté : inventer une adresse de production.
- **Accueil à la première visite seulement si un serveur Marchéo est configuré.** Les utilisateurs actuels de la démo ne voient aucun changement tant que le serveur n'est pas en ligne.
- **Export CSV avec point-virgule et BOM UTF-8.** Excel en français l'ouvre directement, accents compris, et Google Sheets l'importe sans réglage. Les cellules qui commencent par `= + - @` sont neutralisées (injection de formules).
- **Migration d'un client Apps Script par la sauvegarde existante.** Réglages → Exporter une sauvegarde, puis Importer une sauvegarde sur le nouveau compte. Aucun code serveur supplémentaire. Écarté : un import direct du classeur Google, qui demanderait une autorisation Sheets.
- **Conditions d'utilisation et confidentialité : projets de texte avec des mentions à compléter entre crochets.** Rien n'est inventé (prix, durées de conservation, raison sociale).
