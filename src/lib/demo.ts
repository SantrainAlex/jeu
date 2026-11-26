import { genre } from "./genres";
import type { GameDetails } from "./details";
import type { Game } from "./types";

// ---------- Jeux d'exemple, utilisés tant qu'aucune clé RAWG ou IGDB n'est configurée ----------

const WORDS = [
  ["Pixel", "Neon", "Star", "Shadow", "Crystal", "Turbo", "Lunar", "Iron", "Mystic", "Retro"],
  ["Quest", "Racers", "Legends", "Odyssey", "Tactics", "Arena", "Garden", "Drift", "Saga", "Rush"],
];
const GENRES = ["action", "adventure", "role-playing-games-rpg", "racing", "platformer", "strategy", "sports", "puzzle"].map(
  (s) => genre(s),
);

function demoGame(n: number, i: number, name: string, released: string): Game {
  return {
    id: n * 1000 + i,
    slug: `demo-${n}-${i}`,
    name,
    released,
    image: null,
    rating: ((n * 17) % 50) / 10,
    genres: [GENRES[n % 8], GENRES[(n + 3) % 8]],
    sources: [],
  };
}

export function demoReleases(seed: number, count: number, from: string, to: string): Game[] {
  const start = new Date(from).getTime();
  const span = new Date(to).getTime() - start;
  return Array.from({ length: count }, (_, i) => {
    const n = seed + i * 13;
    const released = new Date(start + (span * ((i * 37) % 100)) / 100).toISOString().slice(0, 10);
    return demoGame(n, i, `${WORDS[0][n % 10]} ${WORDS[1][(seed + i * 7) % 10]}`, released);
  });
}

export function demoCatalog(): Game[] {
  // 60 jeux aux noms tous différents
  return Array.from({ length: 60 }, (_, i) =>
    demoGame(500 + i * 11, i, `${WORDS[0][i % 10]} ${WORDS[1][(i + Math.floor(i / 10)) % 10]}`, "2025-06-01"),
  );
}

/** Jeux d'exemple pour les recommandations : chacun « sort » sur une partie des plateformes demandées. */
export function demoCandidates(platformSlugs: string[], genreSlugs: string[]): Game[] {
  return demoCatalog()
    .filter((g) => g.genres.some((x) => genreSlugs.includes(x.slug)))
    .map((g, i) => {
      const on = platformSlugs.filter((_, j) => (i + j * 2) % 3 !== 0);
      return { ...g, platforms: on.length ? on : [platformSlugs[i % platformSlugs.length]] };
    });
}

export function demoCatalogPage(opts: { query?: string; sort: "populaires" | "notes" | "recents"; page: number; pageSize: number }) {
  const q = opts.query?.toLowerCase() ?? "";
  const all = demoCatalog()
    .map((g, i) => ({ ...g, released: `${2010 + (i % 15)}-0${1 + (i % 9)}-15` }))
    .filter((g) => g.name.toLowerCase().includes(q));
  if (opts.sort === "notes") all.sort((a, b) => b.rating - a.rating);
  if (opts.sort === "recents") all.sort((a, b) => (b.released ?? "").localeCompare(a.released ?? ""));
  const start = (opts.page - 1) * opts.pageSize;
  return { games: all.slice(start, start + opts.pageSize), hasMore: start + opts.pageSize < all.length };
}

const SEQUELS = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];

/** 1 000 jeux d'exemple aux noms tous différents, pour les cartes (100 noms x 10 épisodes). */
export function demoCardGames(): Game[] {
  return Array.from({ length: 1000 }, (_, i) => {
    const base = `${WORDS[0][i % 10]} ${WORDS[1][Math.floor(i / 10) % 10]}`;
    return demoGame(700 + i * 7, i, base + SEQUELS[Math.floor(i / 100)], `${2005 + (i % 20)}-05-10`);
  });
}

/** Fiche d'un jeu d'exemple (sans vidéo ni capture). */
export function demoDetails(id: number): GameDetails {
  const n = Math.floor(id / 1000);
  const g = demoGame(n, id % 1000, `${WORDS[0][n % 10]} ${WORDS[1][(n * 3) % 10]}`, "2025-06-01");
  return {
    ...g,
    id,
    igdbId: null,
    cover: null,
    ratingCount: 120,
    press: null,
    platforms: ["PC", "Nintendo Switch", "PlayStation 5"],
    developers: ["Studio d'exemple"],
    publishers: ["Éditeur d'exemple"],
    modes: ["Solo"],
    stores: [],
    freeToPlay: false,
    playtime: 12,
    ageRating: null,
    description:
      "Ceci est un jeu d'exemple. Ajoute ta clé RAWG et/ou tes identifiants IGDB dans le fichier .env.local " +
      "pour voir les vraies fiches, avec bandes-annonces, captures d'écran et description.",
    website: null,
    videos: [],
    screenshots: [],
    links: [],
  };
}
