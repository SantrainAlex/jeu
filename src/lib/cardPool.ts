import { CARD_POOL_SIZE, rarityForRank, type Card } from "./cards";
import { demoCardGames } from "./demo";
import { hasIgdb, igdbPopular } from "./igdb";
import { mergeGames } from "./merge";
import { hasRawg, rawgPopular } from "./rawg";
import type { Game } from "./types";

/**
 * Les cartes disponibles dans les boosters : les jeux les plus populaires (RAWG + IGDB, sans doublons).
 * Plus un jeu est populaire, plus sa carte est rare : les 20 premiers sont Mythiques, puis Légendaires, etc.
 */
export async function getCardPool(): Promise<{ cards: Card[]; demo: boolean }> {
  let games: Game[];
  let demo = false;

  if (!hasRawg() && !hasIgdb()) {
    games = demoCardGames();
    demo = true;
  } else {
    const calls: Promise<Game[]>[] = [];
    // Beaucoup de jeux sont dans les deux bases : on en demande plus que nécessaire, puis on coupe à CARD_POOL_SIZE
    // RAWG : 10 pages de 40 = 400 jeux (on ne va pas plus loin pour garder le quota gratuit de RAWG)
    if (hasRawg()) calls.push(...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rawgPopular));
    // IGDB : 2 x 500 = 1 000 jeux (IGDB n'a pas de quota mensuel)
    if (hasIgdb()) calls.push(...[0, 500].map(igdbPopular));
    const settled = await Promise.allSettled(calls);
    const lists = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (lists.length === 0) throw new Error("Aucune source de jeux ne répond pour le moment.");
    // RAWG d'abord, puis IGDB : l'ordre sert de classement de popularité
    games = mergeGames(...lists).filter((g) => g.image).slice(0, CARD_POOL_SIZE);
  }

  return {
    demo,
    cards: games.map((g, i) => ({
      id: g.id,
      name: g.name,
      image: g.image,
      released: g.released,
      rarity: rarityForRank(i + 1),
    })),
  };
}
