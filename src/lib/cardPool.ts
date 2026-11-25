import { rarityForRank, type Card } from "./cards";
import { demoCardGames } from "./demo";
import { hasIgdb, igdbPopular } from "./igdb";
import { mergeGames } from "./merge";
import { hasRawg, rawgPopular } from "./rawg";
import type { Game } from "./types";

/**
 * Les cartes disponibles dans les boosters : les jeux les plus populaires (RAWG + IGDB, sans doublons).
 * Plus un jeu est populaire, plus sa carte est rare : les 5 premiers sont Mythiques, puis Légendaires, etc.
 */
export async function getCardPool(): Promise<{ cards: Card[]; demo: boolean }> {
  let games: Game[];
  let demo = false;

  if (!hasRawg() && !hasIgdb()) {
    games = demoCardGames();
    demo = true;
  } else {
    const calls: Promise<Game[]>[] = [];
    if (hasRawg()) calls.push(...[1, 2, 3, 4].map(rawgPopular));
    if (hasIgdb()) calls.push(...[0, 50, 100].map(igdbPopular));
    const settled = await Promise.allSettled(calls);
    const lists = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (lists.length === 0) throw new Error("Aucune source de jeux ne répond pour le moment.");
    // RAWG d'abord (4 pages), puis IGDB : l'ordre sert de classement de popularité
    games = mergeGames(...lists).filter((g) => g.image);
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
