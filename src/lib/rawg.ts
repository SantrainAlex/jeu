import { PERIODS, type Period, type Platform } from "./platforms";

export type Game = {
  id: number;
  name: string;
  released: string | null;
  image: string | null;
  rating: number; // note RAWG sur 5
  genres: string[];
  slug: string;
};

export type GamesResult = {
  games: Game[];
  /** true si les données sont des exemples (pas de clé RAWG configurée) */
  demo: boolean;
  from: string;
  to: string;
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
  genres?: { name: string }[];
};

export async function getNewGames(platform: Platform, period: Period): Promise<GamesResult> {
  const { from, to } = dateRange(period);
  const key = process.env.RAWG_API_KEY;

  if (!key) {
    return { games: demoGames(platform, period, from, to), demo: true, from, to };
  }

  const params = new URLSearchParams({
    key,
    platforms: platform.rawgIds.join(","),
    dates: `${from},${to}`,
    ordering: "-added",
    page_size: "40",
  });

  const res = await fetch(`${API}/games?${params}`, {
    // On garde la réponse en cache 1 heure pour ne pas épuiser le quota RAWG
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`RAWG a répondu ${res.status}`);
  }
  const data = (await res.json()) as { results: RawgGame[] };

  return {
    demo: false,
    from,
    to,
    games: data.results.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: g.name,
      released: g.released,
      image: g.background_image,
      rating: g.rating,
      genres: (g.genres ?? []).map((x) => x.name),
    })),
  };
}

// ---------- Données d'exemple (utilisées tant qu'il n'y a pas de clé RAWG) ----------

const DEMO_WORDS = [
  ["Pixel", "Neon", "Star", "Shadow", "Crystal", "Turbo", "Lunar", "Iron", "Mystic", "Retro"],
  ["Quest", "Racers", "Legends", "Odyssey", "Tactics", "Arena", "Garden", "Drift", "Saga", "Rush"],
];
const DEMO_GENRES = ["Action", "Aventure", "RPG", "Course", "Plateforme", "Stratégie", "Sport", "Puzzle"];

function demoGames(platform: Platform, period: Period, from: string, to: string): Game[] {
  const count = { jour: 3, semaine: 9, mois: 18 }[period];
  const seed = platform.slug.length * 7 + platform.rawgIds[0];
  const start = new Date(from).getTime();
  const span = new Date(to).getTime() - start;

  return Array.from({ length: count }, (_, i) => {
    const n = seed + i * 13;
    const released = new Date(start + (span * ((i * 37) % 100)) / 100);
    return {
      id: n * 1000 + i,
      slug: `demo-${platform.slug}-${i}`,
      name: `${DEMO_WORDS[0][n % 10]} ${DEMO_WORDS[1][(seed + i * 7) % 10]}`,
      released: isoDate(released),
      image: null,
      rating: Math.round(((n * 17) % 50) + 0) / 10,
      genres: [DEMO_GENRES[n % 8], DEMO_GENRES[(n + 3) % 8]],
    };
  });
}
