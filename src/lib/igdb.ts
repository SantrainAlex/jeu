import { genreFromIgdb, igdbIdsForGenres } from "./genres";
import { cleanDescription, type GameDetails } from "./details";
import { isSameGame, normalizeTitle } from "./merge";
import type { Game } from "./types";

/**
 * IGDB (Twitch) : il faut un Client ID et un Client Secret créés sur https://dev.twitch.tv/console
 * (variables IGDB_CLIENT_ID et IGDB_CLIENT_SECRET dans .env.local).
 */

type IgdbGame = {
  id: number;
  slug: string;
  name: string;
  first_release_date?: number; // secondes depuis 1970
  total_rating?: number; // sur 100
  genres?: { id: number; name: string }[];
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
};

export function hasIgdb() {
  return Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET);
}

let token: { value: string; expiresAt: number } | null = null;

/** Jeton d'accès Twitch : il sert pour IGDB et pour l'API des lives Twitch (mêmes identifiants). */
export async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const params = new URLSearchParams({
    client_id: process.env.IGDB_CLIENT_ID ?? "",
    client_secret: process.env.IGDB_CLIENT_SECRET ?? "",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`Twitch (connexion IGDB) a répondu ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

const FIELDS =
  "fields name,slug,first_release_date,total_rating,genres.name,cover.image_id,artworks.image_id,screenshots.image_id;";

async function post<T>(body: string, revalidate = 3600, timeout?: number, endpoint = "games"): Promise<T[]> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID ?? "",
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "text/plain",
    },
    body,
    next: { revalidate },
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  });
  if (!res.ok) throw new Error(`IGDB a répondu ${res.status}`);
  return (await res.json()) as T[];
}

async function query(body: string): Promise<Game[]> {
  return (await post<IgdbGame>(FIELDS + body)).map(toGame);
}

function imageUrl(g: IgdbGame): string | null {
  const wide = g.artworks?.[0] ?? g.screenshots?.[0];
  if (wide) return `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${wide.image_id}.jpg`;
  if (g.cover) return `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`;
  return null;
}

function toGame(g: IgdbGame): Game {
  const genres = (g.genres ?? []).map((x) => genreFromIgdb(x.id, x.name));
  return {
    id: -g.id,
    slug: g.slug,
    name: g.name,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    image: imageUrl(g),
    rating: g.total_rating ? Math.round(g.total_rating / 2) / 10 : 0,
    // un même genre commun peut venir de plusieurs genres IGDB (ex. stratégie)
    genres: genres.filter((x, i) => genres.findIndex((y) => y.slug === x.slug) === i),
    sources: ["igdb"],
  };
}

const unix = (isoDate: string, endOfDay = false) =>
  Math.floor(new Date(`${isoDate}T${endOfDay ? "23:59:59" : "00:00:00"}Z`).getTime() / 1000);

/** Sorties entre deux dates (AAAA-MM-JJ) sur des plateformes IGDB. */
export function igdbReleases(platformIds: number[], from: string, to: string) {
  return query(
    `where platforms = (${platformIds.join(",")}) & first_release_date >= ${unix(from)} & first_release_date <= ${unix(to, true)}` +
      ` & version_parent = null; sort hypes desc; limit 40;`,
  );
}

/** Jeux bien notés de certains genres, éventuellement limités à des plateformes. */
export function igdbByGenres(platformIds: number[], genreSlugs: string[]) {
  const genreIds = igdbIdsForGenres(genreSlugs);
  if (genreIds.length === 0) return Promise.resolve([]);
  const platforms = platformIds.length ? ` & platforms = (${platformIds.join(",")})` : "";
  return query(
    `where genres = (${genreIds.join(",")})${platforms} & total_rating >= 70 & total_rating_count >= 10` +
      ` & version_parent = null; sort total_rating_count desc; limit 40;`,
  );
}

/** Une page du catalogue d'une plateforme IGDB (recherche facultative). */
export function igdbCatalog(
  platformIds: number[],
  opts: { query?: string; sort: "populaires" | "notes" | "recents"; page: number; pageSize: number },
) {
  const now = Math.floor(Date.now() / 1000);
  const onPlatforms = `platforms = (${platformIds.join(",")}) & version_parent = null`;
  const base = `${onPlatforms} & first_release_date <= ${now}`;
  const paging = `limit ${opts.pageSize}; offset ${(opts.page - 1) * opts.pageSize};`;
  if (opts.query) {
    // IGDB ne permet pas de trier une recherche : elle est classée par pertinence.
    // Pas de filtre de date : un jeu sans date connue serait écarté.
    return query(`search "${clean(opts.query)}"; where ${onPlatforms}; ${paging}`);
  }
  const sort = {
    populaires: `where ${base} & total_rating_count >= 1; sort total_rating_count desc;`,
    notes: `where ${base} & total_rating_count >= 20; sort total_rating desc;`,
    recents: `where ${base}; sort first_release_date desc;`,
  }[opts.sort];
  return query(`${sort} ${paging}`);
}

/**
 * Jeux sortis (ou annoncés) sur les plateformes `on` mais sur aucune des plateformes `notOn`,
 * d'après IGDB. Ex. les jeux Switch 2 qui n'existent pas sur Switch. Mis en cache 1 jour.
 */
export async function igdbOnlyOn(on: number[], notOn: number[]): Promise<Game[]> {
  const where = `fields name,slug,first_release_date,platforms; where platforms = (${on.join(",")}) & version_parent = null;`;
  const lists = await Promise.all([
    post<IgdbGame & { platforms?: number[] }>(`${where} sort first_release_date desc; limit 500;`, 86400),
    post<IgdbGame & { platforms?: number[] }>(`${where} sort hypes desc; limit 500;`, 86400),
  ]);
  const seen = new Set<number>();
  return lists
    .flat()
    .filter((g) => !seen.has(g.id) && seen.add(g.id) && !(g.platforms ?? []).some((id) => notOn.includes(id)))
    .map(toGame);
}

const clean = (text: string) => text.replace(/["\\]/g, " ").trim();

/**
 * Les jeux qui portent exactement ce titre (sans tenir compte des majuscules), pour qu'une recherche
 * par nom complet les trouve toujours. Un jeu dont IGDB ne connaît pas les plateformes est gardé.
 */
export async function igdbExactTitle(platformIds: number[], title: string): Promise<Game[]> {
  const found = await post<IgdbGame & { platforms?: number[] }>(
    `${FIELDS.replace(";", ",platforms;")} where name ~ "${clean(title)}" & version_parent = null; limit 10;`,
  );
  const wanted = normalizeTitle(title);
  return found
    .filter((g) => normalizeTitle(g.name) === wanted)
    .filter((g) => !g.platforms?.length || g.platforms.some((p) => platformIds.includes(p)))
    .map(toGame);
}

/** Les jeux les plus populaires toutes plateformes confondues (pour les cartes à collectionner). */
export function igdbPopular(offset: number) {
  return query(
    `where version_parent = null & total_rating_count >= 20; sort total_rating_count desc; limit 500; offset ${offset};`,
  );
}

// ---------- Fiche détaillée d'un jeu ----------

type IgdbDetail = IgdbGame & {
  summary?: string;
  storyline?: string;
  total_rating_count?: number;
  aggregated_rating?: number;
  platforms?: { name: string }[];
  involved_companies?: { company: { name: string }; developer: boolean; publisher: boolean }[];
  game_modes?: { name: string }[];
  videos?: { video_id: string; name?: string }[];
  url?: string;
};

const DETAIL_FIELDS =
  "fields name,slug,first_release_date,total_rating,total_rating_count,aggregated_rating,summary,storyline,url," +
  "genres.name,platforms.name,cover.image_id,artworks.image_id,screenshots.image_id,videos.video_id,videos.name," +
  "involved_companies.company.name,involved_companies.developer,involved_companies.publisher,game_modes.name;";

/** Modes de jeu IGDB en français. */
const IGDB_MODES: Record<string, string> = {
  "Single player": "Solo",
  Multiplayer: "Multijoueur",
  "Co-operative": "Coopération",
  "Split screen": "Écran partagé",
  "Massively Multiplayer Online (MMO)": "MMO",
  "Battle Royale": "Battle royale",
};

/** Identifiant IGDB d'une plateforme d'après son nom exact (null si IGDB ne la connaît pas). Mis en cache 1 jour. */
export async function igdbPlatformId(name: string): Promise<number | null> {
  const rows = await post<{ id: number }>(`fields id; where name = "${name.replace(/"/g, "")}"; limit 1;`, 86400, 5000, "platforms");
  return rows[0]?.id ?? null;
}

/** Noms de plateformes IGDB raccourcis. */
const IGDB_PLATFORMS: Record<string, string> = {
  "PC (Microsoft Windows)": "PC",
  "Xbox Series X|S": "Xbox Series X|S",
  "Nintendo Switch 2": "Nintendo Switch 2",
};

const img = (size: string, id: string) => `https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg`;

/** Transforme une réponse IGDB en fiche du site. */
export function igdbToDetails(g: IgdbDetail): GameDetails {
  const base = toGame(g);
  const companies = g.involved_companies ?? [];
  const summary = [g.summary, g.storyline].filter(Boolean).join("\n\n");
  const shots = [...(g.screenshots ?? []), ...(g.artworks ?? [])];
  return {
    ...base,
    igdbId: g.id,
    cover: g.cover ? img("t_cover_big", g.cover.image_id) : null,
    image: g.artworks?.[0]
      ? img("t_1080p", g.artworks[0].image_id)
      : g.screenshots?.[0]
        ? img("t_1080p", g.screenshots[0].image_id)
        : base.image,
    ratingCount: g.total_rating_count ?? 0,
    press: g.aggregated_rating ? Math.round(g.aggregated_rating) : null,
    platforms: (g.platforms ?? []).map((p) => IGDB_PLATFORMS[p.name] ?? p.name),
    developers: companies.filter((c) => c.developer).map((c) => c.company.name),
    publishers: companies.filter((c) => c.publisher).map((c) => c.company.name),
    modes: (g.game_modes ?? []).map((m) => IGDB_MODES[m.name] ?? m.name),
    stores: [],
    freeToPlay: false,
    playtime: 0,
    ageRating: null,
    description: cleanDescription(summary),
    website: null,
    videos: (g.videos ?? []).map((v) => ({ kind: "youtube" as const, id: v.video_id, name: v.name ?? "Vidéo" })),
    screenshots: shots.map((s) => ({ thumb: img("t_screenshot_big", s.image_id), full: img("t_1080p", s.image_id) })),
    links: g.url ? [{ source: "igdb", url: g.url }] : [],
  };
}

/** La fiche complète d'un jeu IGDB (null s'il n'existe pas). */
export async function igdbDetails(id: number): Promise<GameDetails | null> {
  const [g] = await post<IgdbDetail>(`${DETAIL_FIELDS} where id = ${id};`, 86400, 6000);
  return g ? igdbToDetails(g) : null;
}

/** Cherche sur IGDB le même jeu qu'un jeu RAWG (même titre et année proche), avec sa fiche complète. */
export async function igdbFind(name: string, released: string | null): Promise<GameDetails | null> {
  const q = name.replace(/["\\]/g, " ").trim();
  const found = await post<IgdbDetail>(`${DETAIL_FIELDS} search "${q}"; where version_parent = null; limit 8;`, 86400, 6000);
  const target = { ...toGame({ id: 0, slug: "", name }), released };
  const match = found.find((g) => isSameGame(target, toGame(g)));
  return match ? igdbToDetails(match) : null;
}
