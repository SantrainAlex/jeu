"use client";

/**
 * Stockage local (dans le navigateur) du profil et des notes.
 * Pour l'instant le site est utilisé par une seule personne : tout reste sur ton ordinateur.
 * Quand on ouvrira le site aux amis (étape 4), on remplacera ce fichier par des comptes en ligne.
 */
import { useSyncExternalStore } from "react";
import type { Genre } from "./rawg";

export type Profile = {
  /** plateformes que tu possèdes */
  owned: string[];
  /** plateformes qui t'intéressent */
  interested: string[];
};

export type Rating = {
  id: number;
  slug: string;
  name: string;
  image: string | null;
  released: string | null;
  genres: Genre[];
  /** note de 1 à 5 */
  stars: number;
  ratedAt: string;
};

type Data = { profile: Profile; ratings: Record<string, Rating> };

const KEY = "jeu:v1";
const EVENT = "jeu:store";
const EMPTY: Data = { profile: { owned: [], interested: [] }, ratings: {} };

let cachedRaw: string | null = null;
let cachedData: Data = EMPTY;

function read(): Data {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cachedData;
  }
  if (raw === cachedRaw) return cachedData;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Data>) : {};
    cachedData = {
      profile: { ...EMPTY.profile, ...parsed.profile },
      ratings: parsed.ratings ?? {},
    };
  } catch {
    cachedData = EMPTY;
  }
  return cachedData;
}

function write(update: (d: Data) => Data) {
  const next = update(read());
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible (navigation privée) : on garde au moins en mémoire
    cachedData = next;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback); // autres onglets
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Renvoie [données, chargé] ; "chargé" est faux pendant le rendu côté serveur. */
export function useStore(): [Data, boolean] {
  const data = useSyncExternalStore(subscribe, read, () => EMPTY);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return [data, ready];
}

export function togglePlatform(list: keyof Profile, slug: string) {
  write((d) => {
    const current = d.profile[list];
    const nextList = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    return { ...d, profile: { ...d.profile, [list]: nextList } };
  });
}

export function rateGame(game: Omit<Rating, "stars" | "ratedAt">, stars: number) {
  write((d) => ({
    ...d,
    ratings: { ...d.ratings, [game.id]: { ...game, stars, ratedAt: new Date().toISOString() } },
  }));
}

export function removeRating(id: number) {
  write((d) => {
    const ratings = { ...d.ratings };
    delete ratings[id];
    return { ...d, ratings };
  });
}
