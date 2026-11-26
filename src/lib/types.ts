export type Genre = { name: string; slug: string };

export type Source = "rawg" | "igdb";

export type Game = {
  /** Identifiant RAWG ; pour un jeu présent seulement sur IGDB : -(identifiant IGDB) */
  id: number;
  slug: string;
  name: string;
  released: string | null;
  image: string | null;
  /** jaquette verticale du jeu (IGDB), idéale pour les cartes à collectionner */
  cover?: string | null;
  /** note de la communauté sur 5 (0 si inconnue) */
  rating: number;
  genres: Genre[];
  /** d'où viennent les infos de ce jeu */
  sources: Source[];
  /**
   * Plateformes du site (slugs de platforms.ts) sur lesquelles on a trouvé le jeu.
   * Rempli seulement pour les recommandations, où chaque plateforme est cherchée séparément.
   */
  platforms?: string[];
};

export type GamesResult = {
  games: Game[];
  /** true si ce sont des jeux d'exemple (aucune clé configurée) */
  demo: boolean;
  /** sources qui ont répondu */
  sources: Source[];
};
