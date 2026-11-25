"use client";

/**
 * Stockage local (dans le navigateur) du profil et des notes.
 * Pour l'instant le site est utilisé par une seule personne : tout reste sur ton ordinateur.
 * Quand on ouvrira le site aux amis (étape 4), on remplacera ce fichier par des comptes en ligne.
 */
import { useSyncExternalStore } from "react";
import { VITRAIL_TOTAL, availablePacks, localDay, openPack, type Card, type PulledCard } from "./cards";
import type { Genre } from "./types";

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

export type Collection = {
  /** cartes possédées : identifiant du jeu → carte et nombre d'exemplaires */
  cards: Record<string, { card: Card; count: number; firstAt: string }>;
  /** vitraux numérotés obtenus */
  vitraux: { card: Card; number: number; at: string }[];
  /** dernier jour où le booster gratuit a été ouvert */
  lastFreeDay: string | null;
  /** nombre de boosters bonus (gagnés en notant) déjà ouverts */
  bonusClaimed: number;
  packsOpened: number;
  /**
   * Vitraux déjà distribués. Pour l'instant compté sur ton navigateur ;
   * avec les comptes en ligne (étape 4), ce stock sera partagé entre tous les joueurs.
   */
  vitrailsGiven: number;
};

type Data = { profile: Profile; ratings: Record<string, Rating>; collection: Collection };

const KEY = "jeu:v1";
const EVENT = "jeu:store";
const EMPTY_COLLECTION: Collection = {
  cards: {},
  vitraux: [],
  lastFreeDay: null,
  bonusClaimed: 0,
  packsOpened: 0,
  vitrailsGiven: 0,
};
const EMPTY: Data = { profile: { owned: [], interested: [] }, ratings: {}, collection: EMPTY_COLLECTION };

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
      collection: { ...EMPTY_COLLECTION, ...parsed.collection },
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

/**
 * Ouvre un booster si tu en as un : le gratuit du jour d'abord, sinon un bonus gagné en notant des jeux.
 * Renvoie les 5 cartes tirées, ou null s'il n'y a plus de booster.
 */
export function openBooster(pool: Card[]): PulledCard[] | null {
  let pulled: PulledCard[] | null = null;
  write((d) => {
    const c = d.collection;
    const today = localDay();
    const packs = availablePacks(c, Object.keys(d.ratings).length, today);
    if (packs.total === 0 || pool.length === 0) return d;

    const vitrailsLeft = Math.max(0, VITRAIL_TOTAL - c.vitrailsGiven);
    const { cards, vitrailUsed } = openPack(pool, { vitrailsLeft, nextVitrailNumber: c.vitrailsGiven + 1 });
    pulled = cards;

    const now = new Date().toISOString();
    const owned = { ...c.cards };
    const vitraux = [...c.vitraux];
    for (const card of cards) {
      const { vitrail, ...base } = card;
      if (vitrail) {
        vitraux.push({ card: base, number: vitrail, at: now });
      } else {
        const prev = owned[base.id];
        owned[base.id] = { card: base, count: (prev?.count ?? 0) + 1, firstAt: prev?.firstAt ?? now };
      }
    }

    return {
      ...d,
      collection: {
        cards: owned,
        vitraux,
        lastFreeDay: packs.free ? today : c.lastFreeDay,
        bonusClaimed: packs.free ? c.bonusClaimed : c.bonusClaimed + 1,
        packsOpened: c.packsOpened + 1,
        vitrailsGiven: c.vitrailsGiven + (vitrailUsed ? 1 : 0),
      },
    };
  });
  return pulled;
}
