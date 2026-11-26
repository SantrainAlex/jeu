"use client";

/**
 * Les données du joueur (profil, notes, collection), gardées dans le navigateur.
 * Quand tu es connecté, elles sont en plus synchronisées avec ton compte (voir cloud.ts).
 */
import { useSyncExternalStore } from "react";
import { VITRAIL_TOTAL, availablePacks, openPack, type Card, type PulledCard } from "./cards";
import { addPack, applyClaim } from "./cardRules";
import { ratedToday, withLegacyBonus, type QuestId, type Reward } from "./quests";
import { EMPTY, normalize, type Collection, type Data, type Profile, type Rating } from "./data";

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

/**
 * Ouvre un booster SANS compte (site lancé sans Supabase) : tout se passe dans ce navigateur.
 * Avec les comptes, c'est le serveur qui ouvre les boosters (voir serverCardAction dans cloud.ts).
 * Renvoie les 5 cartes tirées, ou null s'il n'y a plus de booster.
 */
export function openLocalBooster(pool: Card[]): PulledCard[] | null {
  if (pool.length === 0) return null;
  const before = read();
  const collection = withLegacyBonus(before.collection, Object.keys(before.ratings).length);
  if (availablePacks(collection).total === 0) return null;
  const { cards } = openPack(pool, {
    vitrailsLeft: Math.max(0, VITRAIL_TOTAL - before.collection.vitrailsGiven),
    nextVitrailNumber: before.collection.vitrailsGiven + 1,
  });
  const result = addPack(collection, cards, Date.now(), { countLocalVitrail: true });
  if (!result) return null;
  write((d) => ({ ...d, collection: result.collection }));
  return result.pulled;
}

/** Récupère la récompense d'une quête du jour SANS compte (avec les comptes, c'est le serveur qui le fait). */
export function claimLocalQuest(id: QuestId): Reward | null {
  const d = read();
  const result = applyClaim(withLegacyBonus(d.collection, Object.keys(d.ratings).length), id, ratedToday(d.ratings));
  if (!result) return null;
  write((x) => ({ ...x, collection: result.collection }));
  return result.reward ?? null;
}

/** Remplace la collection par celle renvoyée par le serveur (sans la renvoyer au compte). */
export function setCollection(collection: Collection) {
  save({ ...read(), collection });
}

/**
 * Applique une action de l'atelier (recycler, fabriquer, échanger, améliorer) à la collection, SANS compte.
 * `action` renvoie null si elle n'est pas possible ; dans ce cas rien ne change.
 */
export function updateCollection<T extends Collection | { collection: Collection }>(
  action: (c: Collection) => T | null,
): T | null {
  const result = action(read().collection);
  if (!result) return null;
  const next = "collection" in result ? (result as { collection: Collection }).collection : (result as Collection);
  write((d) => ({ ...d, collection: next }));
  return result;
}
