# Marchéo

Micro CRM d'acquisition pour marchand de biens : pipeline de biens, simulation par bien, travaux, journal, contacts et relances, comparateur, tableau de bord, dossier PDF. Charte reprise d'Hébéo.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Application (aucune compilation) |
| `js/calc.js` | Moteur de calcul pur, extrait du simulateur d'origine |
| `js/donnees.js` | Cache local, file d'attente hors connexion, synchronisation |
| `js/app.js` | Navigation et écrans |
| `js/pdf.js` | Dossier PDF d'un bien (jsPDF) |
| `js/annonces.js` | Analyse des annonces reçues par alerte e-mail |
| `js/demo.js` | Données fictives du mode démonstration |
| `serveur/Code.gs` | Serveur Google Apps Script (gratuit) |
| `reference/` | Simulateur d'origine, référence des règles de calcul |
| `test/` | Tests automatiques |

## Tests

```
node --test marcheo/test/*.test.js
```

- valeurs de contrôle du brief ;
- équivalence avec le moteur d'origine sur 3 000 états tirés au hasard ;
- serveur : connexion, écriture, lecture, conflit, déconnexion ;
- synchronisation téléphone et PC, y compris hors connexion.

## Mise en service de la synchronisation

Sans serveur, l'application tourne en mode démonstration : les données restent dans le navigateur.

1. Sur le compte Google qui doit héberger les données : script.google.com, Nouveau projet, coller `serveur/Code.gs`.
2. Exécuter `installer()` une fois et accepter les autorisations. Le journal d'exécution affiche l'identifiant `direction` et un mot de passe provisoire.
3. Exécuter `definirMotDePasse('direction', 'un mot de passe choisi')` pour le remplacer.
4. Déployer, Nouveau déploiement, Application Web : exécuter en tant que « Moi », accès « Tout le monde ». Copier l'adresse qui finit par `/exec`.
5. Dans Marchéo : Réglages, Connecter un serveur. Coller l'adresse, saisir l'identifiant et le mot de passe. Refaire l'étape 5 sur chaque appareil.

Les données sont dans le classeur « Marchéo — données » de ce compte Google, une ligne par fiche.
Deux versions d'une même fiche : la plus récente gagne. Les horloges du téléphone et du PC doivent être à l'heure.

## Annonces reçues par alerte e-mail

Le serveur lit toutes les heures les alertes des sites listés dans `EXPEDITEURS_ALERTES` (`serveur/Code.gs`) : SeLoger, Bien'ici, Leboncoin, PAP, Logic-Immo, Immonot et d'autres. Chaque annonce entre dans Marchéo, aucune n'est perdue. Le fil Gmail reçoit le libellé « Marchéo-traité ».

L'analyse se fait dans Marchéo, au moment de l'affichage, avec toutes les lignes du simulateur. Tri en trois étapes :

1. prix affiché ≤ 130 000 €, sinon écartée d'office, sans calcul ;
2. argent total à sortir ≤ 140 000 € : achat, frais d'agence, notaire, travaux et aléas, frais annexes, TVA des travaux avancée ;
3. marge brute ≥ 10 % du prix de revente (revente moins coût de revient).

Les étapes 2 et 3 s'apprécient au prix obtenu après une négociation réaliste (15 % au plus). Un seuil à 0 le désactive.

Les autres annonces restent consultables : « À compléter », « Écartées par l'analyse », « Toutes ».
Tous les seuils se modifient depuis la page Annonces (« Modifier les critères ») ou dans Réglages, avec les prix des secteurs.
