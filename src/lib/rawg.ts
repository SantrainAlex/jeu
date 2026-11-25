import { genre } from "./genres";
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
