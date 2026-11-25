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

## Avoir les vrais jeux

Sans clé, le site affiche des jeux d'exemple. Pour les vraies sorties :

1. Crée un compte gratuit sur https://rawg.io/apidocs et récupère ta clé API.
2. Copie `.env.example` en `.env.local` et colle ta clé après `RAWG_API_KEY=`.
3. Relance `npm run dev`.

## Organisation du code

- `src/lib/platforms.ts` : la liste des plateformes et des périodes (pour en ajouter une, c'est ici).
- `src/lib/rawg.ts` : la récupération des jeux depuis RAWG (avec mise en cache 1 h) et les données d'exemple.
- `src/app/page.tsx` : la page d'accueil (choix de la plateforme).
- `src/app/plateforme/[slug]/page.tsx` : la page d'une plateforme avec les onglets jour / semaine / mois.
- `src/components/GameCard.tsx` : la carte d'un jeu.
