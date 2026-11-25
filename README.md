# Jeu — les nouveautés jeux vidéo par plateforme

Étape 1 du projet : les pages par plateforme (Switch, PC, PS5, PS4, Xbox Series, Xbox One, Mobile)
avec les sorties du jour, de la semaine et du mois.

## Lancer le site sur ton ordinateur

1. Installe [Node.js](https://nodejs.org) (version 20 ou plus).
2. Dans ce dossier, lance :
   ```bash
   npm install
   npm run dev
   ```
3. Ouvre http://localhost:3000

## Avoir les vrais jeux (RAWG + IGDB)

Sans clé, le site affiche des jeux d'exemple. Le site sait utiliser deux sources, ensemble ou séparément :

- **RAWG** : crée une clé gratuite sur https://rawg.io/apidocs.
- **IGDB** : connecte-toi sur https://dev.twitch.tv/console, « Register Your Application »
  (URL de redirection `http://localhost`, catégorie « Website Integration »), puis note le Client ID et génère un Client Secret.

Copie `.env.example` en `.env.local`, remplis ce que tu as, puis relance `npm run dev`.

Quand les deux sources sont configurées, les listes sont fusionnées **sans doublon** (`src/lib/merge.ts`) :
deux fiches sont le même jeu si leur titre est identique une fois simplifié (majuscules, accents, ponctuation et
mentions comme « Deluxe Edition » ignorées) et que leurs années de sortie ont au plus un an d'écart.
Les infos sont alors combinées (image, genres, note moyenne). Si une source est en panne, l'autre s'affiche quand même.

Tests : `npm test`.

## Organisation du code

- `src/lib/platforms.ts` : la liste des plateformes et des périodes (pour en ajouter une, c'est ici).
- `src/lib/games.ts` : interroge RAWG (`rawg.ts`) et IGDB (`igdb.ts`), puis fusionne (`merge.ts`) ; jeux d'exemple dans `demo.ts`.
- `src/app/page.tsx` : la page d'accueil (choix de la plateforme).
- `src/app/plateforme/[slug]/page.tsx` : la page d'une plateforme avec les onglets jour / semaine / mois.
- `src/components/GameCard.tsx` : la carte d'un jeu.

## Étape 2 : profil, notes et recommandations

- `/profil` : coche les plateformes que tu as ou qui t'intéressent ; elles passent en premier sur l'accueil.
- Sur chaque jeu, clique sur les étoiles pour le noter (reclique sur la même étoile pour retirer la note).
- `/mes-notes` : tes jeux notés et les genres que tu aimes.
- `/recommandations` : des jeux des genres que tu notes le mieux, sur tes plateformes.

Calcul des goûts : 5★ = +2, 4★ = +1, 3★ = 0, 2★ = -1, 1★ = -2 pour chaque genre du jeu noté.
Pour l'instant, le profil et les notes sont enregistrés dans ton navigateur (`src/lib/store.ts`) ;
on passera à de vrais comptes en ligne quand le site sera ouvert à tes amis.

## Catalogue de chaque plateforme

`/plateforme/<plateforme>/catalogue` (onglet « 📚 Catalogue ») : tous les jeux déjà sortis, avec recherche par nom,
tri (populaires, mieux notés, plus récents) et pages de 24 jeux. Pratique pour retrouver et noter tes anciens jeux.

## Étape 3 : cartes à collectionner

- `/cartes` : ouvre des boosters de 5 cartes (1 gratuit par jour, +1 tous les 3 jeux notés), retourne les cartes une à une.
- `/cartes/album` : ta collection, filtrable par rareté, avec ta progression.
- Chaque carte est un jeu populaire (RAWG + IGDB) : les 5 plus populaires sont Mythiques, puis Légendaires (15), Épiques (30), Rares (60), le reste Communes.
- Chances par carte (`src/lib/cards.ts`) : Commune 88,96 %, Rare 9,7 %, Épique 1 %, Légendaire 0,32 %, Mythique 0,02 %.
- Vitraux numérotés : environ 1 pack sur 500, à la place d'une carte, dans la limite de 300 exemplaires.
  Pour l'instant le stock est compté dans ton navigateur ; il sera partagé entre joueurs avec les comptes en ligne (étape 4).
