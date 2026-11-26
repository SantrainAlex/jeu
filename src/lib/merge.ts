import type { Game } from "./types";

/** Mentions d'édition ignorées pour comparer deux titres. */
const EDITION_WORDS =
  /\b(deluxe|ultimate|complete|definitive|standard|gold|premium|digital|collector'?s?|game of the year|goty|launch|day one)\s+edition\b/g;

/**
 * Met un titre sous une forme comparable :
 * « Pokémon™ Légendes : Z-A – Deluxe Edition » → « pokemon legendes z a »
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[™®©]/g, "")
    .replace(/&/g, " and ")
    .replace(EDITION_WORDS, " ")
    .replace(/\bgoty\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the /, "")
    .trim();
}

const year = (g: Game) => (g.released ? Number(g.released.slice(0, 4)) : null);

/** Deux fiches décrivent le même jeu : même titre normalisé et année de sortie proche (±1 an, ou inconnue). */
export function isSameGame(a: Game, b: Game): boolean {
  if (normalizeTitle(a.name) !== normalizeTitle(b.name)) return false;
  const ya = year(a);
  const yb = year(b);
  return ya === null || yb === null || Math.abs(ya - yb) <= 1;
}

function combine(a: Game, b: Game): Game {
  const genres = [...a.genres];
  for (const g of b.genres) if (!genres.some((x) => x.slug === g.slug)) genres.push(g);
  const ratings = [a.rating, b.rating].filter((r) => r > 0);
  const platforms = [...new Set([...(a.platforms ?? []), ...(b.platforms ?? [])])];
  const dates = [a.released, b.released].filter((d): d is string => Boolean(d)).sort();
  return {
    // on garde l'identifiant RAWG (positif) en priorité pour que les notes restent attachées au même jeu
    id: a.id > 0 ? a.id : b.id,
    slug: a.id > 0 ? a.slug : b.slug,
    name: a.name,
    released: dates[0] ?? null,
    image: a.image ?? b.image,
    rating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : 0,
    genres,
    sources: [...new Set([...a.sources, ...b.sources])],
    ...(platforms.length ? { platforms } : {}),
  };
}

/**
 * Fusionne plusieurs listes de jeux en supprimant les doublons.
 * L'ordre de la première liste est conservé ; les jeux nouveaux des listes suivantes sont ajoutés à la fin.
 */
export function mergeGames(...lists: Game[][]): Game[] {
  const result: Game[] = [];
  for (const list of lists) {
    for (const game of list) {
      const index = result.findIndex((g) => isSameGame(g, game));
      if (index === -1) result.push(game);
      else result[index] = combine(result[index], game);
    }
  }
  return result;
}

/**
 * Range les résultats d'une recherche : d'abord le titre exact, puis les titres qui commencent par la recherche,
 * puis ceux qui contiennent tous ses mots, puis le reste (l'ordre des sources est gardé à égalité).
 */
export function rankByTitle(games: Game[], search: string): Game[] {
  const wanted = normalizeTitle(search);
  const words = wanted.split(" ").filter(Boolean);
  const score = (g: Game) => {
    const name = normalizeTitle(g.name);
    if (name === wanted) return 0;
    if (name.startsWith(`${wanted} `)) return 1;
    const own = new Set(name.split(" "));
    return words.every((w) => own.has(w)) ? 2 : 3;
  };
  return games
    .map((game, index) => ({ game, index, score: score(game) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((x) => x.game);
}

/**
 * Classe les suggestions de la barre de recherche pendant qu'on tape (« ins » → « Inside ») :
 * d'abord le titre exact, puis les titres qui commencent par le texte tapé,
 * puis ceux dont un mot commence par ce texte, puis le reste (dans l'ordre des sources).
 */
export function rankSuggestions(games: Game[], typed: string): Game[] {
  const wanted = normalizeTitle(typed);
  const score = (g: Game) => {
    const name = normalizeTitle(g.name);
    if (name === wanted) return 0;
    if (name.startsWith(wanted)) return 1;
    if (name.split(" ").some((w) => w.startsWith(wanted)) || name.includes(` ${wanted}`)) return 2;
    return 3;
  };
  return games
    .map((game, index) => ({ game, index, score: score(game) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((x) => x.game);
}
