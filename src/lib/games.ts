import { combineDetails, parseGameKey, type GameDetails } from "./details";
import { demoCandidates, demoCatalogPage, demoDetails, demoReleases } from "./demo";
import {
  hasIgdb,
  igdbByGenres,
  igdbCatalog,
  igdbDetails,
  igdbExactTitle,
  igdbFind,
  igdbPlatformId,
  igdbReleases,
} from "./igdb";
import { mergeGames, rankByTitle } from "./merge";
import { PERIODS, type Period, type Platform } from "./platforms";
import {
  hasRawg,
  rawgByGenres,
  rawgCatalog,
  rawgDetails,
  rawgExactTitle,
  rawgFind,
  rawgPlatformId,
  rawgReleases,
  type CatalogSort,
} from "./rawg";
import type { Game, GamesResult, Source } from "./types";

export type { Game, GamesResult, Genre } from "./types";
export type { CatalogSort } from "./rawg";

function dateRange(period: Period) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (PERIODS[period].days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Identifiants d'une plateforme dans une source. Si la plateforme a un `lookupName`, on demande d'abord
 * à la source son identifiant (en cas d'échec, on garde ceux écrits dans platforms.ts).
 */
async function idsIn(source: "rawg" | "igdb", platform: Platform): Promise<number[]> {
  const known = source === "rawg" ? platform.rawgIds : platform.igdbIds;
  if (!platform.lookupName) return known;
  try {
    const id = await (source === "rawg" ? rawgPlatformId : igdbPlatformId)(platform.lookupName);
    return id === null ? known : [id];
  } catch {
    return known;
  }
}

/**
 * Appelle `run` avec les identifiants des plateformes dans la source.
 * Si la source ne connaît aucune des plateformes demandées, elle ne renvoie rien
 * (sans ça, une liste vide voudrait dire « toutes les plateformes »).
 */
async function onPlatforms(source: "rawg" | "igdb", platforms: Platform[], run: (ids: number[]) => Promise<Game[]>) {
  const ids = (await Promise.all(platforms.map((p) => idsIn(source, p)))).flat();
  if (platforms.length > 0 && ids.length === 0) return [];
  return run(ids);
}

/** Temps maximum d'attente d'une source, en millisecondes. */
const MAX_WAIT = 5000;
/** Une fois qu'une source a répondu, temps supplémentaire laissé à l'autre. */
const GRACE = 1500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Interroge RAWG et IGDB en même temps, puis fusionne sans doublons.
 * - Si une source tombe en panne, on affiche quand même les résultats de l'autre.
 * - Si une source est trop lente, on ne l'attend pas : au plus 5 s, et seulement 1,5 s de plus
 *   que la première source qui a répondu. (Sa réponse finit quand même dans le cache pour la prochaine fois.)
 */
async function fromBothSources(rawg: (() => Promise<Game[]>) | null, igdb: (() => Promise<Game[]>) | null) {
  const calls: [Source, () => Promise<Game[]>][] = [];
  if (rawg) calls.push(["rawg", rawg]);
  if (igdb) calls.push(["igdb", igdb]);

  let markFirst: () => void = () => {};
  const firstAnswered = new Promise<void>((resolve) => (markFirst = resolve));

  const settled = await Promise.allSettled(
    calls.map(([source, call]) => {
      const request = call();
      request.then(markFirst, () => {});
      const limit = Promise.race([sleep(MAX_WAIT), firstAnswered.then(() => sleep(GRACE))]).then(() => {
        throw new Error(`${source} trop lent, ignoré pour cette fois`);
      });
      return Promise.race([request, limit]);
    }),
  );

  const ok: Source[] = [];
  const lists: Game[][] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(calls[i][0]);
      lists.push(r.value);
    } else {
      console.error(`[jeu] ${calls[i][0]} indisponible :`, (r.reason as Error).message);
    }
  });
  if (ok.length === 0) throw new Error("Aucune source de jeux ne répond pour le moment.");
  return { games: mergeGames(...lists), sources: ok, demo: false };
}

/** Les sorties d'une plateforme sur une période (jour, semaine, mois). */
export async function getNewGames(platform: Platform, period: Period): Promise<GamesResult> {
  const { from, to } = dateRange(period);
  if (!hasRawg() && !hasIgdb()) {
    const count = { jour: 3, semaine: 9, mois: 18 }[period];
    const seed = platform.slug.length * 7 + (platform.rawgIds[0] ?? platform.igdbIds[0]);
    return { games: demoReleases(seed, count, from, to), demo: true, sources: [] };
  }
  return fromBothSources(
    hasRawg() ? () => onPlatforms("rawg", [platform], (ids) => rawgReleases(ids, from, to)) : null,
    hasIgdb() ? () => onPlatforms("igdb", [platform], (ids) => igdbReleases(ids, from, to)) : null,
  );
}

/**
 * Jeux candidats pour les recommandations : les mieux notés des genres aimés, sur TES plateformes uniquement.
 * Chaque plateforme est cherchée séparément, et chaque jeu reçoit la liste des plateformes où on l'a trouvé
 * (`platforms`). Sans plateforme, on ne renvoie rien : on ne propose jamais un jeu « toutes plateformes ».
 */
export async function getCandidates(platforms: Platform[], genreSlugs: string[]): Promise<GamesResult> {
  if (platforms.length === 0) return { games: [], demo: !hasRawg() && !hasIgdb(), sources: [] };
  if (!hasRawg() && !hasIgdb()) {
    return {
      games: demoCandidates(
        platforms.map((p) => p.slug),
        genreSlugs,
      ),
      demo: true,
      sources: [],
    };
  }
  const perPlatform = await Promise.allSettled(
    platforms.map((p) =>
      fromBothSources(
        hasRawg() ? () => onPlatforms("rawg", [p], (ids) => rawgByGenres(ids, genreSlugs)) : null,
        hasIgdb() ? () => onPlatforms("igdb", [p], (ids) => igdbByGenres(ids, genreSlugs)) : null,
      ).then((r) => ({ ...r, games: tagPlatform(r.games, p.slug) })),
    ),
  );
  const ok = perPlatform.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (ok.length === 0) throw new Error("Aucune source de jeux ne répond pour le moment.");
  return {
    games: mergeGames(...ok.map((r) => r.games)),
    sources: [...new Set(ok.flatMap((r) => r.sources))],
    demo: false,
  };
}

/** Indique sur chaque jeu la plateforme sur laquelle on l'a trouvé. */
export function tagPlatform(games: Game[], slug: string): Game[] {
  return games.map((g) => ({ ...g, platforms: [slug] }));
}

export const CATALOG_PAGE_SIZE = 24;

/**
 * Une page du catalogue d'une plateforme (tous les jeux déjà sortis), pour retrouver et noter ses anciens jeux.
 * Chaque source renvoie sa page ; les doublons de la page sont fusionnés.
 */
export async function getCatalog(
  platform: Platform,
  opts: { query?: string; sort: CatalogSort; page: number },
): Promise<GamesResult & { hasMore: boolean }> {
  const o = { ...opts, pageSize: CATALOG_PAGE_SIZE };
  if (!hasRawg() && !hasIgdb()) return { ...demoCatalogPage(o), demo: true, sources: [] };

  let full = false; // au moins une source a renvoyé une page pleine : il y a sans doute une page suivante
  const track = (games: Game[]) => {
    if (games.length >= CATALOG_PAGE_SIZE) full = true;
    return games;
  };
  // En page 1 d'une recherche, on demande aussi à chaque source le jeu qui porte exactement ce titre :
  // la recherche « floue » des sources peut le noyer ou l'oublier (ex. « Find the Needle »).
  const exact = opts.page === 1 && opts.query ? opts.query : null;
  const withExact = (page: Promise<Game[]>, find: () => Promise<Game[]>) =>
    exact
      ? Promise.all([page.then(track), find().catch(() => [] as Game[])]).then(([games, same]) => [...same, ...games])
      : page.then(track);
  const result = await fromBothSources(
    hasRawg()
      ? () => onPlatforms("rawg", [platform], (ids) => withExact(rawgCatalog(ids, o), () => rawgExactTitle(ids, exact!)))
      : null,
    hasIgdb()
      ? () => onPlatforms("igdb", [platform], (ids) => withExact(igdbCatalog(ids, o), () => igdbExactTitle(ids, exact!)))
      : null,
  );
  const games = opts.query ? rankByTitle(result.games, opts.query) : result.games;
  return { ...result, games, hasMore: full };
}

/** Attend une promesse au plus `ms` millisecondes ; au-delà (ou en cas d'erreur) renvoie null. */
function atMost<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  return Promise.race([promise.catch(() => null), sleep(ms).then(() => null)]);
}

/**
 * La fiche d'un jeu, à partir de son adresse (/jeu/123 ou /jeu/igdb-123).
 * On lit la fiche chez la source de l'adresse, puis on cherche le même jeu chez l'autre source
 * pour compléter (vidéos YouTube d'IGDB, captures et infos de RAWG…). null = jeu introuvable.
 */
export async function getGameDetails(key: string): Promise<{ details: GameDetails; demo: boolean } | null> {
  const parsed = parseGameKey(key);
  if (!parsed) return null;
  if (!hasRawg() && !hasIgdb()) {
    const details = parsed.source === "rawg" ? demoDetails(parsed.id) : null;
    return details && { details, demo: true };
  }

  if (parsed.source === "rawg") {
    if (!hasRawg()) return null;
    const main = await rawgDetails(parsed.id);
    if (!main) return null;
    const other = hasIgdb() ? await atMost(igdbFind(main.name, main.released), 4000) : null;
    return { details: combineDetails(main, other), demo: false };
  }

  if (!hasIgdb()) return null;
  const main = await igdbDetails(parsed.id);
  if (!main) return null;
  const other = hasRawg()
    ? await atMost(
        rawgFind(main.name, main.released).then((id) => (id ? rawgDetails(id) : null)),
        4000,
      )
    : null;
  return { details: combineDetails(main, other), demo: false };
}
