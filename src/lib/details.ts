import type { Game, Genre, Source } from "./types";

/** Une vidéo du jeu : bande-annonce YouTube (IGDB) ou fichier vidéo (RAWG). */
export type Video =
  | { kind: "youtube"; id: string; name: string }
  | { kind: "mp4"; src: string; poster: string | null; name: string };

/** Une capture d'écran : petite image pour la galerie, grande pour l'affichage plein écran. */
export type Shot = { thumb: string; full: string };

/** Tout ce qu'on affiche sur la fiche d'un jeu. */
export type GameDetails = {
  /** identifiant utilisé pour les notes (le même que dans les listes) */
  id: number;
  slug: string;
  /** identifiant IGDB du jeu (sert à trouver ses lives Twitch), null si inconnu */
  igdbId: number | null;
  name: string;
  released: string | null;
  /** grande image de fond */
  image: string | null;
  /** jaquette (format portrait), si on l'a */
  cover: string | null;
  /** note de la communauté sur 5 (0 si inconnue) et nombre de votes */
  rating: number;
  ratingCount: number;
  /** note de la presse sur 100 (Metacritic ou IGDB), null si inconnue */
  press: number | null;
  genres: Genre[];
  platforms: string[];
  developers: string[];
  publishers: string[];
  modes: string[];
  /** temps de jeu moyen en heures (0 si inconnu) */
  playtime: number;
  ageRating: string | null;
  description: string | null;
  website: string | null;
  videos: Video[];
  screenshots: Shot[];
  sources: Source[];
  /** liens vers la fiche du jeu chez chaque source */
  links: { source: Source; url: string }[];
};

/** Adresse de la fiche d'un jeu : /jeu/123 pour RAWG, /jeu/igdb-123 pour un jeu connu seulement d'IGDB. */
export function gameHref(game: { id: number }) {
  return game.id > 0 ? `/jeu/${game.id}` : `/jeu/igdb-${-game.id}`;
}

/** Lit l'adresse d'une fiche : renvoie la source et l'identifiant chez elle, ou null si l'adresse est invalide. */
export function parseGameKey(key: string): { source: Source; id: number } | null {
  const m = /^(igdb-)?(\d{1,10})$/.exec(key);
  if (!m) return null;
  const id = Number(m[2]);
  if (!id) return null;
  return { source: m[1] ? "igdb" : "rawg", id };
}

/** Le même jeu sous forme de Game (pour les étoiles « ma note »). */
export function toGame(d: GameDetails): Game {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    released: d.released,
    image: d.image,
    rating: d.rating,
    genres: d.genres,
    sources: d.sources,
  };
}

const uniq = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase().trim();
    if (!x.trim() || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * Réunit les infos de deux sources sur le même jeu. La première (celle de l'adresse) garde son identifiant ;
 * pour chaque info on prend celle qui est renseignée, et on additionne vidéos et captures.
 */
export function combineDetails(a: GameDetails, b: GameDetails | null): GameDetails {
  if (!b) return a;
  const genres = [...a.genres];
  for (const g of b.genres) if (!genres.some((x) => x.slug === g.slug)) genres.push(g);
  const ratings = [a.rating, b.rating].filter((r) => r > 0);
  const counts = a.ratingCount + b.ratingCount;
  const dates = [a.released, b.released].filter((d): d is string => Boolean(d)).sort();
  const videoKey = (v: Video) => (v.kind === "youtube" ? v.id : v.src);
  const videos = [...a.videos, ...b.videos].filter((v, i, all) => all.findIndex((w) => videoKey(w) === videoKey(v)) === i);
  // les bandes-annonces YouTube d'abord : ce sont en général les officielles
  videos.sort((x, y) => Number(y.kind === "youtube") - Number(x.kind === "youtube"));
  return {
    ...a,
    igdbId: a.igdbId ?? b.igdbId,
    released: dates[0] ?? null,
    image: a.image ?? b.image,
    cover: a.cover ?? b.cover,
    rating: ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : 0,
    ratingCount: counts,
    press: a.press ?? b.press,
    genres,
    platforms: a.platforms.length ? a.platforms : b.platforms,
    developers: uniq([...a.developers, ...b.developers]),
    publishers: uniq([...a.publishers, ...b.publishers]),
    modes: uniq([...a.modes, ...b.modes]),
    playtime: a.playtime || b.playtime,
    ageRating: a.ageRating ?? b.ageRating,
    // la description la plus courte est en général un vrai résumé (IGDB), la plus longue un pavé (RAWG)
    description: pickDescription(a.description, b.description),
    website: a.website ?? b.website,
    videos: videos.slice(0, 8),
    screenshots: [...a.screenshots, ...b.screenshots].slice(0, 16),
    sources: [...new Set([...a.sources, ...b.sources])],
    links: [...a.links, ...b.links],
  };
}

function pickDescription(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  // un résumé court mais réel (plus de 150 caractères) est plus agréable à lire qu'un très long texte
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 150 ? short : long;
}

/**
 * Nettoie une description : enlève les éventuelles balises HTML, les traductions ajoutées à la fin
 * (fréquent sur RAWG : « Español … ») et les espaces en trop.
 */
export function cleanDescription(text: string | null | undefined): string | null {
  if (!text) return null;
  let t = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  const cut = t.search(/\n\s*(Español|Espanol|Deutsch|Français|Italiano|Português|Русский|日本語)\s*\n/);
  if (cut > 0) t = t.slice(0, cut);
  t = t.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t || null;
}
