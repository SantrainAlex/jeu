import { PERIODS, type Period, type Platform } from "./platforms";

export type Genre = { name: string; slug: string };

export type Game = {
  id: number;
  name: string;
  released: string | null;
  image: string | null;
  rating: number; // note RAWG sur 5
  genres: Genre[];
  slug: string;
};

export type GamesResult = {
  games: Game[];
  /** true si les données sont des exemples (pas de clé RAWG configurée) */
  demo: boolean;
};

const API = "https://api.rawg.io/api";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateRange(period: Period) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (PERIODS[period].days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

type RawgGame = {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  genres?: Genre[];
};

async function rawg(path: string, params: Record<string, string>, key: string): Promise<Game[]> {
  const query = new URLSearchParams({ key, ...params });
  const res = await fetch(`${API}${path}?${query}`, {
    // On garde la réponse en cache 1 heure pour ne pas épuiser le quota RAWG
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`RAWG a répondu ${res.status}`);
  const data = (await res.json()) as { results: RawgGame[] };
  return data.results.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    released: g.released,
    image: g.background_image,
    rating: g.rating,
    genres: (g.genres ?? []).map(({ name, slug }) => ({ name, slug })),
  }));
}

/** Les sorties d'une plateforme sur une période (jour, semaine, mois). */
export async function getNewGames(platform: Platform, period: Period): Promise<GamesResult> {
  const { from, to } = dateRange(period);
  const key = process.env.RAWG_API_KEY;
  if (!key) return { games: demoNewGames(platform, period, from, to), demo: true };

  const games = await rawg(
    "/games",
    { platforms: platform.rawgIds.join(","), dates: `${from},${to}`, ordering: "-added", page_size: "40" },
    key,
  );
  return { games, demo: false };
}

/**
 * Des jeux candidats pour les recommandations : les jeux les mieux notés
 * des genres que tu aimes, sur tes plateformes.
 */
export async function getCandidates(platformIds: number[], genreSlugs: string[]): Promise<GamesResult> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return { games: demoCatalog().filter((g) => g.genres.some((x) => genreSlugs.includes(x.slug))), demo: true };

  const params: Record<string, string> = {
    genres: genreSlugs.join(","),
    ordering: "-added",
    metacritic: "70,100",
    page_size: "40",
  };
  if (platformIds.length) params.platforms = platformIds.join(",");
  return { games: await rawg("/games", params, key), demo: false };
}

// ---------- Données d'exemple (utilisées tant qu'il n'y a pas de clé RAWG) ----------

const DEMO_WORDS = [
  ["Pixel", "Neon", "Star", "Shadow", "Crystal", "Turbo", "Lunar", "Iron", "Mystic", "Retro"],
  ["Quest", "Racers", "Legends", "Odyssey", "Tactics", "Arena", "Garden", "Drift", "Saga", "Rush"],
];
export const DEMO_GENRES: Genre[] = [
  { name: "Action", slug: "action" },
  { name: "Aventure", slug: "adventure" },
  { name: "RPG", slug: "role-playing-games-rpg" },
  { name: "Course", slug: "racing" },
  { name: "Plateforme", slug: "platformer" },
  { name: "Stratégie", slug: "strategy" },
  { name: "Sport", slug: "sports" },
  { name: "Puzzle", slug: "puzzle" },
];

function demoGame(n: number, i: number, released: string): Game {
  return {
    id: n * 1000 + i,
    slug: `demo-${n}-${i}`,
    name: `${DEMO_WORDS[0][n % 10]} ${DEMO_WORDS[1][(n * 7 + i) % 10]}`,
    released,
    image: null,
    rating: ((n * 17) % 50) / 10,
    genres: [DEMO_GENRES[n % 8], DEMO_GENRES[(n + 3) % 8]],
  };
}

function demoNewGames(platform: Platform, period: Period, from: string, to: string): Game[] {
  const count = { jour: 3, semaine: 9, mois: 18 }[period];
  const seed = platform.slug.length * 7 + platform.rawgIds[0];
  const start = new Date(from).getTime();
  const span = new Date(to).getTime() - start;
  return Array.from({ length: count }, (_, i) =>
    demoGame(seed + i * 13, i, isoDate(new Date(start + (span * ((i * 37) % 100)) / 100))),
  );
}

function demoCatalog(): Game[] {
  // 60 jeux aux noms tous différents
  return Array.from({ length: 60 }, (_, i) => ({
    ...demoGame(500 + i * 11, i, "2025-06-01"),
    name: `${DEMO_WORDS[0][i % 10]} ${DEMO_WORDS[1][(i + Math.floor(i / 10)) % 10]}`,
  }));
}
