import { GENRE_NAMES } from "./genres";
import type { Game, Genre } from "./types";

/** Ce qu'il faut savoir d'une note pour calculer des goûts (sans dépendre du stockage). */
export type RatedGame = { id: number; stars: number; genres: Genre[] };

export type Taste = { slug: string; name: string; weight: number };

/**
 * Calcule tes goûts par genre : 5★ = +2, 4★ = +1, 3★ = 0, 2★ = -1, 1★ = -2,
 * additionnés pour chaque genre du jeu noté.
 */
export function computeTastes(ratings: RatedGame[]): Taste[] {
  const map = new Map<string, Taste>();
  for (const r of ratings) {
    for (const g of r.genres) {
      const t = map.get(g.slug) ?? { slug: g.slug, name: GENRE_NAMES[g.slug] ?? g.name, weight: 0 };
      t.weight += r.stars - 3;
      map.set(g.slug, t);
    }
  }
  return [...map.values()].sort((a, b) => b.weight - a.weight);
}

export type Recommendation = Game & { score: number; reasons: string[] };

/** Classe les jeux candidats selon tes goûts, en retirant ceux que tu as déjà notés. */
export function rankGames(candidates: Game[], tastes: Taste[], ratedIds: Set<number>): Recommendation[] {
  const weights = new Map(tastes.map((t) => [t.slug, t]));
  const seen = new Set<number>();
  const result: Recommendation[] = [];

  for (const game of candidates) {
    if (ratedIds.has(game.id) || seen.has(game.id)) continue;
    seen.add(game.id);
    let score = 0;
    const reasons: string[] = [];
    for (const g of game.genres) {
      const t = weights.get(g.slug);
      if (!t) continue;
      score += t.weight;
      if (t.weight > 0) reasons.push(t.name);
    }
    if (score <= 0) continue;
    // petit bonus pour les jeux bien notés par la communauté RAWG
    score += game.rating / 5;
    result.push({ ...game, score, reasons });
  }

  return result.sort((a, b) => b.score - a.score);
}

// ---------- Plateformes et filtres de la page « Pour toi » ----------

/**
 * Garde seulement les jeux trouvés sur au moins une de tes plateformes, et ne leur laisse que celles-là.
 * Sécurité en plus du serveur : un jeu sans plateforme connue n'est jamais proposé.
 */
export function onlyOnMyPlatforms<T extends Game>(games: T[], mine: string[]): T[] {
  const allowed = new Set(mine);
  return games.flatMap((g) => {
    const platforms = (g.platforms ?? []).filter((p) => allowed.has(p));
    return platforms.length ? [{ ...g, platforms }] : [];
  });
}

/** « Coup de cœur probable » : le jeu touche au moins 2 genres que tu aimes, ou un genre que tu adores (poids ≥ 4). */
export function isStrongMatch(reco: Recommendation, tastes: Taste[]): boolean {
  if (reco.reasons.length >= 2) return true;
  const liked = new Map(tastes.map((t) => [t.slug, t.weight]));
  return reco.genres.some((g) => (liked.get(g.slug) ?? 0) >= 4);
}

/** "toutes" | "jai" (consoles que j'ai) | "interesse" (qui m'intéressent) | slug d'une plateforme */
export type PlatformFilter = string;
export type RecoSort = "pour-moi" | "notes" | "recents";
export type RecoFilters = {
  platform: PlatformFilter;
  /** "tous" ou slug d'un genre */
  genre: string;
  sort: RecoSort;
  /** seulement les coups de cœur probables */
  strongOnly: boolean;
};

export const DEFAULT_FILTERS: RecoFilters = { platform: "toutes", genre: "tous", sort: "pour-moi", strongOnly: false };

/** Plateformes correspondant au filtre choisi. */
export function platformsFor(filter: PlatformFilter, profile: { owned: string[]; interested: string[] }): string[] {
  if (filter === "jai") return profile.owned;
  if (filter === "interesse") return profile.interested.filter((p) => !profile.owned.includes(p));
  const all = [...new Set([...profile.owned, ...profile.interested])];
  return filter === "toutes" ? all : all.filter((p) => p === filter);
}

/** Applique les filtres et le tri choisis sur la page « Pour toi ». */
export function applyFilters(
  recos: Recommendation[],
  filters: RecoFilters,
  profile: { owned: string[]; interested: string[] },
  tastes: Taste[],
): Recommendation[] {
  const wanted = new Set(platformsFor(filters.platform, profile));
  const list = recos.filter(
    (r) =>
      (r.platforms ?? []).some((p) => wanted.has(p)) &&
      (filters.genre === "tous" || r.genres.some((g) => g.slug === filters.genre)) &&
      (!filters.strongOnly || isStrongMatch(r, tastes)),
  );
  if (filters.sort === "notes") return [...list].sort((a, b) => b.rating - a.rating);
  if (filters.sort === "recents") return [...list].sort((a, b) => (b.released ?? "").localeCompare(a.released ?? ""));
  return list; // déjà classés « pour moi » par rankGames
}
