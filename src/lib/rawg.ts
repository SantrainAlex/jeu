import { cleanDescription, type GameDetails } from "./details";
import { genre } from "./genres";
import { isSameGame } from "./merge";
import type { Game, Genre } from "./types";

const API = "https://api.rawg.io/api";

type RawgGame = {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  genres?: Genre[];
};

export function hasRawg() {
  return Boolean(process.env.RAWG_API_KEY);
}

async function query(params: Record<string, string>): Promise<Game[]> {
  const search = new URLSearchParams({ key: process.env.RAWG_API_KEY ?? "", page_size: "40", ...params });
  const res = await fetch(`${API}/games?${search}`, {
    // On garde la réponse en cache 1 heure pour ne pas épuiser le quota RAWG
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`RAWG a répondu ${res.status}`);
  const data = (await res.json()) as { results: RawgGame[] };
  return data.results.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    released: g.released,
    image: g.background_image,
    rating: g.rating,
    genres: (g.genres ?? []).map((x) => genre(x.slug, x.name)),
    sources: ["rawg"],
  }));
}

/** Identifiant RAWG d'une plateforme d'après son nom exact (null si RAWG ne la connaît pas). Mis en cache 1 jour. */
export async function rawgPlatformId(name: string): Promise<number | null> {
  const search = new URLSearchParams({ key: process.env.RAWG_API_KEY ?? "", page_size: "100" });
  const res = await fetch(`${API}/platforms?${search}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`RAWG a répondu ${res.status}`);
  const data = (await res.json()) as { results: { id: number; name: string }[] };
  const wanted = name.toLowerCase();
  return data.results.find((p) => p.name.toLowerCase() === wanted)?.id ?? null;
}

/** Sorties entre deux dates (AAAA-MM-JJ) sur des plateformes RAWG. */
export function rawgReleases(platformIds: number[], from: string, to: string) {
  return query({ platforms: platformIds.join(","), dates: `${from},${to}`, ordering: "-added" });
}

/** Jeux bien notés de certains genres, éventuellement limités à des plateformes. */
export function rawgByGenres(platformIds: number[], genreSlugs: string[]) {
  const params: Record<string, string> = { genres: genreSlugs.join(","), ordering: "-added", metacritic: "70,100" };
  if (platformIds.length) params.platforms = platformIds.join(",");
  return query(params);
}

export type CatalogSort = "populaires" | "notes" | "recents";

/** Une page du catalogue d'une plateforme RAWG (recherche facultative). */
export function rawgCatalog(platformIds: number[], opts: { query?: string; sort: CatalogSort; page: number; pageSize: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const ordering = { populaires: "-added", notes: "-metacritic", recents: "-released" }[opts.sort];
  const params: Record<string, string> = {
    platforms: platformIds.join(","),
    page: String(opts.page),
    page_size: String(opts.pageSize),
    dates: `1970-01-01,${today}`, // seulement les jeux déjà sortis
  };
  if (opts.query) {
    params.search = opts.query;
    params.search_precise = "true";
  } else {
    params.ordering = ordering;
  }
  return query(params);
}

/** Les jeux les plus populaires toutes plateformes confondues (pour les cartes à collectionner). */
export function rawgPopular(page: number) {
  return query({ ordering: "-added", page: String(page), page_size: "40" });
}

// ---------- Fiche détaillée d'un jeu ----------

type RawgDetail = RawgGame & {
  description_raw?: string;
  description?: string;
  background_image_additional?: string | null;
  website?: string;
  ratings_count?: number;
  metacritic?: number | null;
  playtime?: number;
  platforms?: { platform: { name: string } }[] | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  esrb_rating?: { name: string } | null;
  tags?: { slug: string; name: string; language?: string }[];
};
type RawgShot = { image: string };
type RawgMovie = { name: string; preview: string | null; data: { "480"?: string; max?: string } };

/** Classification ESRB en français. */
const ESRB: Record<string, string> = {
  Everyone: "Tout public (ESRB E)",
  "Everyone 10+": "10 ans et plus (ESRB E10+)",
  Teen: "13 ans et plus (ESRB T)",
  Mature: "17 ans et plus (ESRB M)",
  "Adults Only": "Adultes seulement (ESRB AO)",
};

/** Modes de jeu reconnus parmi les étiquettes RAWG. */
const RAWG_MODES: Record<string, string> = {
  singleplayer: "Solo",
  multiplayer: "Multijoueur",
  "online-multiplayer": "Multijoueur en ligne",
  "local-multiplayer": "Multijoueur local",
  "split-screen": "Écran partagé",
  "co-op": "Coopération",
  "online-co-op": "Coopération en ligne",
  "local-co-op": "Coopération locale",
  mmo: "MMO",
};

/** Image RAWG redimensionnée (le site d'images de RAWG sait le faire tout seul). */
export function rawgResize(url: string, width: 420 | 640 | 1280) {
  return url.replace("media.rawg.io/media/", `media.rawg.io/media/resize/${width}/-/`);
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}${path.includes("?") ? "&" : "?"}key=${process.env.RAWG_API_KEY ?? ""}`, {
    next: { revalidate: 86400 }, // une fiche change peu : 1 jour de cache
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RAWG a répondu ${res.status}`);
  return (await res.json()) as T;
}

/** Transforme les réponses RAWG (fiche, captures, vidéos) en fiche du site. */
export function rawgToDetails(g: RawgDetail, shots: RawgShot[], movies: RawgMovie[]): GameDetails {
  const images = shots.map((s) => s.image).filter((u) => u && u !== g.background_image);
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    released: g.released,
    image: g.background_image,
    cover: null,
    rating: g.rating ?? 0,
    ratingCount: g.ratings_count ?? 0,
    press: g.metacritic ?? null,
    genres: (g.genres ?? []).map((x) => genre(x.slug, x.name)),
    platforms: (g.platforms ?? []).map((p) => p.platform.name),
    developers: (g.developers ?? []).map((d) => d.name),
    publishers: (g.publishers ?? []).map((d) => d.name),
    modes: (g.tags ?? []).flatMap((t) => (RAWG_MODES[t.slug] ? [RAWG_MODES[t.slug]] : [])),
    playtime: g.playtime ?? 0,
    ageRating: g.esrb_rating ? (ESRB[g.esrb_rating.name] ?? g.esrb_rating.name) : null,
    description: cleanDescription(g.description_raw ?? g.description),
    website: g.website || null,
    videos: movies.flatMap((m) => {
      const src = m.data["480"] ?? m.data.max;
      return src ? [{ kind: "mp4" as const, src, poster: m.preview, name: m.name }] : [];
    }),
    screenshots: images.map((u) => ({ thumb: rawgResize(u, 640), full: rawgResize(u, 1280) })),
    sources: ["rawg"],
    links: [{ source: "rawg", url: `https://rawg.io/games/${g.slug}` }],
  };
}

/** La fiche complète d'un jeu RAWG (null s'il n'existe pas). */
export async function rawgDetails(id: number): Promise<GameDetails | null> {
  const [game, shots, movies] = await Promise.all([
    getJson<RawgDetail>(`/games/${id}`),
    // captures et vidéos sont un plus : si elles échouent, on affiche quand même la fiche
    getJson<{ results: RawgShot[] }>(`/games/${id}/screenshots?page_size=12`).catch(() => null),
    getJson<{ results: RawgMovie[] }>(`/games/${id}/movies`).catch(() => null),
  ]);
  if (!game) return null;
  return rawgToDetails(game, shots?.results ?? [], movies?.results ?? []);
}

/** Cherche sur RAWG le même jeu qu'un jeu IGDB (même titre et année proche). */
export async function rawgFind(name: string, released: string | null): Promise<number | null> {
  const found = await getJson<{ results: RawgGame[] }>(
    `/games?${new URLSearchParams({ search: name, search_precise: "true", page_size: "5" })}`,
  );
  const target = { id: 0, slug: "", name, released, image: null, rating: 0, genres: [], sources: [] } as Game;
  const match = found?.results.find((g) => isSameGame(target, { ...target, name: g.name, released: g.released }));
  return match?.id ?? null;
}
