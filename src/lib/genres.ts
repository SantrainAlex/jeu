import type { Genre } from "./types";

/**
 * Genres communs aux deux sources (RAWG et IGDB).
 * On utilise les identifiants (slugs) de RAWG comme référence, avec un nom en français.
 */
export const GENRE_NAMES: Record<string, string> = {
  action: "Action",
  adventure: "Aventure",
  "role-playing-games-rpg": "RPG",
  racing: "Course",
  platformer: "Plateforme",
  strategy: "Stratégie",
  sports: "Sport",
  puzzle: "Puzzle",
  shooter: "Tir",
  fighting: "Combat",
  indie: "Indé",
  simulation: "Simulation",
  arcade: "Arcade",
  casual: "Casual",
  family: "Famille",
  "board-games": "Jeu de plateau",
  card: "Cartes",
  educational: "Éducatif",
  "massively-multiplayer": "MMO",
};

export function genre(slug: string, fallbackName?: string): Genre {
  return { slug, name: GENRE_NAMES[slug] ?? fallbackName ?? slug };
}

/** Genres IGDB (identifiant numérique) → genre commun. */
const IGDB_TO_COMMON: Record<number, string> = {
  2: "adventure", // Point-and-click
  4: "fighting",
  5: "shooter",
  8: "platformer",
  9: "puzzle",
  10: "racing",
  11: "strategy", // Temps réel
  12: "role-playing-games-rpg",
  13: "simulation",
  14: "sports",
  15: "strategy",
  16: "strategy", // Tour par tour
  24: "strategy", // Tactique
  25: "action", // Hack and slash / Beat 'em up
  31: "adventure",
  32: "indie",
  33: "arcade",
  35: "card",
};

export function genreFromIgdb(id: number, name: string): Genre {
  const slug = IGDB_TO_COMMON[id];
  return slug ? genre(slug) : { slug: `igdb-${id}`, name };
}

/** Genre commun → identifiants IGDB (pour chercher des recommandations sur IGDB). */
export function igdbIdsForGenres(slugs: string[]): number[] {
  return Object.entries(IGDB_TO_COMMON)
    .filter(([, slug]) => slugs.includes(slug))
    .map(([id]) => Number(id));
}
