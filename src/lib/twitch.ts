import { getToken, hasIgdb } from "./igdb";

/**
 * Lives Twitch d'un jeu. On utilise les mêmes identifiants Twitch que pour IGDB
 * (IGDB_CLIENT_ID et IGDB_CLIENT_SECRET) : rien de plus à configurer.
 */

export type Stream = {
  /** identifiant de la chaîne dans l'adresse twitch.tv/… */
  channel: string;
  name: string;
  title: string;
  viewers: number;
  /** code de langue (fr, en…) */
  language: string;
  thumbnail: string;
  startedAt: string;
};

export type Lives = {
  /** nom du jeu chez Twitch (pour le lien vers sa page) ; null si Twitch ne connaît pas le jeu */
  twitchGame: string | null;
  streams: Stream[];
};

type HelixStream = {
  user_login: string;
  user_name: string;
  title: string;
  viewer_count: number;
  language: string;
  thumbnail_url: string;
  started_at: string;
};

export const hasTwitch = hasIgdb;

async function helix<T>(path: string): Promise<T[]> {
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: { "Client-ID": process.env.IGDB_CLIENT_ID ?? "", Authorization: `Bearer ${await getToken()}` },
    next: { revalidate: 120 }, // les lives changent vite : on redemande toutes les 2 minutes au plus
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Twitch a répondu ${res.status}`);
  return ((await res.json()) as { data: T[] }).data;
}

/** Transforme un live Twitch pour le site. */
export function toStream(s: HelixStream): Stream {
  return {
    channel: s.user_login,
    name: s.user_name,
    title: s.title,
    viewers: s.viewer_count,
    language: s.language,
    thumbnail: s.thumbnail_url.replace("{width}", "440").replace("{height}", "248"),
    startedAt: s.started_at,
  };
}

/**
 * Les lives en français d'abord (les plus regardés en premier), puis les autres langues, sans doublon.
 */
export function sortStreams(french: Stream[], all: Stream[], max = 12): Stream[] {
  const seen = new Set<string>();
  const sorted = [...french, ...all].filter((s) => !seen.has(s.channel) && seen.add(s.channel));
  return sorted.slice(0, max);
}

/** Les lives en cours sur un jeu (trouvé par son identifiant IGDB, sinon par son nom exact). */
export async function getLives(game: { igdbId: number | null; name: string }): Promise<Lives> {
  let found: { id: string; name: string }[] = [];
  if (game.igdbId) found = await helix(`games?igdb_id=${game.igdbId}`);
  if (found.length === 0) found = await helix(`games?name=${encodeURIComponent(game.name)}`);
  if (found.length === 0) return { twitchGame: null, streams: [] };

  const id = found[0].id;
  const [french, all] = await Promise.all([
    helix<HelixStream>(`streams?game_id=${id}&language=fr&first=8&type=live`),
    helix<HelixStream>(`streams?game_id=${id}&first=20&type=live`),
  ]);
  return { twitchGame: found[0].name, streams: sortStreams(french.map(toStream), all.map(toStream)) };
}
