import { mergeGames, normalizeTitle, isSameGame } from "./merge";
import type { Game } from "./types";

/**
 * Classe les jeux par popularité en mélangeant plusieurs sources (RAWG et IGDB).
 *
 * Chaque liste est déjà triée du plus populaire au moins populaire :
 * - RAWG : nombre de joueurs qui ont ajouté le jeu à leur bibliothèque ;
 * - IGDB : nombre d'avis laissés sur le jeu.
 *
 * Pour chaque jeu, on fait la moyenne de sa place dans chaque liste.
 * Un jeu absent d'une liste compte comme s'il était juste après le dernier de cette liste.
 * Ainsi, un jeu bien placé dans les deux bases passe devant un jeu populaire dans une seule.
 */
export function rankByPopularity(lists: Game[][]): Game[] {
  type Entry = { game: Game; places: number[]; firstSeen: number };
  const entries: Entry[] = [];
  const byTitle = new Map<string, Entry[]>();

  lists.forEach((list, source) => {
    list.forEach((game, index) => {
      const key = normalizeTitle(game.name);
      const sameTitle = byTitle.get(key) ?? [];
      let entry = sameTitle.find((e) => isSameGame(e.game, game));
      if (!entry) {
        entry = { game, places: lists.map(() => Infinity), firstSeen: entries.length };
        sameTitle.push(entry);
        byTitle.set(key, sameTitle);
        entries.push(entry);
      } else {
        entry.game = mergeGames([entry.game], [game])[0];
      }
      entry.places[source] = Math.min(entry.places[source], index + 1);
    });
  });

  const score = (e: Entry) =>
    e.places.reduce((sum, place, source) => sum + Math.min(place, lists[source].length + 1), 0) / lists.length;

  return entries
    .map((e) => ({ e, s: score(e) }))
    .sort((a, b) => a.s - b.s || a.e.firstSeen - b.e.firstSeen)
    .map(({ e }) => e.game);
}
