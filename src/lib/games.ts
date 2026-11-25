import { demoCatalog, demoCatalogPage, demoReleases } from "./demo";
import { hasIgdb, igdbByGenres, igdbCatalog, igdbReleases } from "./igdb";
import { mergeGames } from "./merge";
import { PERIODS, type Period, type Platform } from "./platforms";
import { hasRawg, rawgByGenres, rawgCatalog, rawgReleases, type CatalogSort } from "./rawg";
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
 * Interroge RAWG et IGDB en même temps, puis fusionne sans doublons.
 * Si une source tombe en panne, on affiche quand même les résultats de l'autre.
 */
async function fromBothSources(rawg: (() => Promise<Game[]>) | null, igdb: (() => Promise<Game[]>) | null) {
  const calls: [Source, () => Promise<Game[]>][] = [];
  if (rawg) calls.push(["rawg", rawg]);
  if (igdb) calls.push(["igdb", igdb]);

  const settled = await Promise.allSettled(calls.map(([, call]) => call()));
  const ok: Source[] = [];
  const lists: Game[][] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(calls[i][0]);
      lists.push(r.value);
    } else {
      console.error(`[jeu] ${calls[i][0]} indisponible :`, r.reason);
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
    const seed = platform.slug.length * 7 + platform.rawgIds[0];
    return { games: demoReleases(seed, count, from, to), demo: true, sources: [] };
  }
  return fromBothSources(
    hasRawg() ? () => rawgReleases(platform.rawgIds, from, to) : null,
    hasIgdb() ? () => igdbReleases(platform.igdbIds, from, to) : null,
  );
}

/** Jeux candidats pour les recommandations : les mieux notés des genres aimés, sur tes plateformes. */
export async function getCandidates(platforms: Platform[], genreSlugs: string[]): Promise<GamesResult> {
  if (!hasRawg() && !hasIgdb()) {
    return {
      games: demoCatalog().filter((g) => g.genres.some((x) => genreSlugs.includes(x.slug))),
      demo: true,
      sources: [],
    };
  }
  return fromBothSources(
    hasRawg() ? () => rawgByGenres(platforms.flatMap((p) => p.rawgIds), genreSlugs) : null,
    hasIgdb() ? () => igdbByGenres(platforms.flatMap((p) => p.igdbIds), genreSlugs) : null,
  );
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
  const result = await fromBothSources(
    hasRawg() ? () => rawgCatalog(platform.rawgIds, o).then(track) : null,
    hasIgdb() ? () => igdbCatalog(platform.igdbIds, o).then(track) : null,
  );
  return { ...result, hasMore: full };
}
