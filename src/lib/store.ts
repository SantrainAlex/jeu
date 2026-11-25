"use client";

/**
 * Les données du joueur (profil, notes, collection), gardées dans le navigateur.
 * Quand tu es connecté, elles sont en plus synchronisées avec ton compte (voir cloud.ts).
 */
import { useSyncExternalStore } from "react";
import { VITRAIL_TOTAL, availablePacks, localDay, openPack, type Card, type PulledCard } from "./cards";
import { EMPTY, normalize, type Data, type Profile, type Rating } from "./data";

export type { Collection, Data, Profile, Rating } from "./data";

const KEY = "jeu:v1";
const EVENT = "jeu:store";

let cachedRaw: string | null = null;
let cachedData: Data = EMPTY;

export function read(): Data {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cachedData;
  }
  if (raw === cachedRaw) return cachedData;
  cachedRaw = raw;
  try {
    cachedData = raw ? normalize(JSON.parse(raw)) : EMPTY;
  } catch {
    cachedData = EMPTY;
  }
  return cachedData;
}

function save(next: Data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible (navigation privée) : on garde au moins en mémoire
    cachedData = next;
  }
  window.dispatchEvent(new Event(EVENT));
}

const changeListeners = new Set<(d: Data) => void>();

/** Être prévenu de chaque modification faite par le joueur (sert à l'envoyer vers son compte). */
export function onUserChange(listener: (d: Data) => void) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function write(update: (d: Data) => Data) {
  const next = update(read());
  save(next);
  changeListeners.forEach((l) => l(next));
}

/** Remplace toutes les données (après la synchronisation avec le compte). */
export function replaceAll(next: Data) {
  save(next);
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

/** Stock de vitraux en ligne (quand tu es connecté) : combien il en reste et comment en réserver un. */
export type VitrailStock = { left: number; claim: () => Promise<number | null> };

let opening = false;

/**
 * Ouvre un booster si tu en as un : le gratuit du jour d'abord, sinon un bonus gagné en notant des jeux.
 * Renvoie les 5 cartes tirées, ou null s'il n'y a plus de booster.
 */
export async function openBooster(pool: Card[], onlineStock?: VitrailStock): Promise<PulledCard[] | null> {
  if (opening || pool.length === 0) return null;
  const before = read();
  const ratingsCount = Object.keys(before.ratings).length;
  if (availablePacks(before.collection, ratingsCount).total === 0) return null;

  opening = true;
  try {
    const localLeft = Math.max(0, VITRAIL_TOTAL - before.collection.vitrailsGiven);
    const { cards, vitrailUsed } = openPack(pool, {
      vitrailsLeft: onlineStock ? onlineStock.left : localLeft,
      nextVitrailNumber: before.collection.vitrailsGiven + 1,
    });

    let localVitrail = false;
    if (vitrailUsed) {
      const i = cards.findIndex((c) => c.vitrail);
      if (onlineStock) {
        // numéro réservé dans le stock partagé ; s'il n'en reste plus, la carte reste une carte normale
        const n = await onlineStock.claim().catch(() => null);
        if (n) cards[i] = { ...cards[i], vitrail: n };
        else delete cards[i].vitrail;
      } else {
        localVitrail = true;
      }
    }

    const now = new Date().toISOString();
    write((d) => {
      const c = d.collection;
      const today = localDay();
      const packs = availablePacks(c, Object.keys(d.ratings).length, today);
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
          vitrailsGiven: c.vitrailsGiven + (localVitrail ? 1 : 0),
        },
      };
    });
    return cards;
  } finally {
    opening = false;
  }
}
