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
      const t = map.get(g.slug) ?? { slug: g.slug, name: g.name, weight: 0 };
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
