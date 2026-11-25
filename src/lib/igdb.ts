import { genreFromIgdb, igdbIdsForGenres } from "./genres";
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

async function getToken(): Promise<string> {
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

async function query(body: string): Promise<Game[]> {
  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": process.env.IGDB_CLIENT_ID ?? "",
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "text/plain",
    },
    body: FIELDS + body,
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`IGDB a répondu ${res.status}`);
  return ((await res.json()) as IgdbGame[]).map(toGame);
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
