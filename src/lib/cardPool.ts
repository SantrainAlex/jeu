import { CARD_POOL_SIZE, rarityForRank, type Card } from "./cards";
import { demoCardGames } from "./demo";
import { hasIgdb, igdbPopular } from "./igdb";
import { rankByPopularity } from "./popularity";
import { hasRawg, rawgPopular } from "./rawg";
import type { Game } from "./types";

/**
 * Les cartes disponibles dans les boosters : les jeux les plus populaires (RAWG + IGDB, sans doublons).
 * Plus un jeu est populaire, plus sa carte est rare : les 20 premiers sont Mythiques, puis Légendaires, etc.
 * La popularité mélange les deux bases : voir rankByPopularity.
 */
export async function getCardPool(): Promise<{ cards: Card[]; demo: boolean }> {
  let games: Game[];
  let demo = false;

  if (!hasRawg() && !hasIgdb()) {
    games = demoCardGames();
    demo = true;
  } else {
    // Une liste par source, dans l'ordre de popularité. Si une page manque, on écarte la source entière
    // pour ne pas fausser les places. Beaucoup de jeux sont dans les deux bases : on en demande plus que nécessaire.
    const sources: Promise<Game[]>[] = [];
    // RAWG : 10 pages de 40 = 400 jeux (on ne va pas plus loin pour garder le quota gratuit de RAWG)
    if (hasRawg()) sources.push(Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rawgPopular)).then((p) => p.flat()));
    // IGDB : 2 x 500 = 1 000 jeux (IGDB n'a pas de quota mensuel)
    if (hasIgdb()) sources.push(Promise.all([0, 500].map(igdbPopular)).then((p) => p.flat()));
    const settled = await Promise.allSettled(sources);
    const lists = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (lists.length === 0) throw new Error("Aucune source de jeux ne répond pour le moment.");
    games = rankByPopularity(lists).filter((g) => g.image).slice(0, CARD_POOL_SIZE);
  }

  return {
    demo,
    cards: games.map((g, i) => ({
      id: g.id,
      name: g.name,
      image: g.image,
      ...(g.cover ? { cover: g.cover } : {}),
      released: g.released,
      rarity: rarityForRank(i + 1),
    })),
  };
}
