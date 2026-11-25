import { genre } from "./genres";
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
