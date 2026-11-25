import type { Card } from "./cards";
import type { Genre } from "./types";

/** Toutes les données d'un joueur : profil, notes et collection de cartes. */

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
  /** vitraux distribués sur ce navigateur quand on n'est pas connecté (le stock en ligne est partagé) */
  vitrailsGiven: number;
};

export type Data = { profile: Profile; ratings: Record<string, Rating>; collection: Collection };

export const EMPTY_COLLECTION: Collection = {
  cards: {},
  vitraux: [],
  lastFreeDay: null,
  bonusClaimed: 0,
  packsOpened: 0,
  vitrailsGiven: 0,
};

export const EMPTY: Data = { profile: { owned: [], interested: [] }, ratings: {}, collection: EMPTY_COLLECTION };

/** Complète des données partielles (anciennes versions, données en ligne vides…). */
export function normalize(raw: unknown): Data {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<Data>;
  return {
    profile: { ...EMPTY.profile, ...d.profile },
    ratings: d.ratings ?? {},
    collection: { ...EMPTY_COLLECTION, ...d.collection },
  };
}

export function isEmpty(d: Data) {
  return (
    d.profile.owned.length === 0 &&
    d.profile.interested.length === 0 &&
    Object.keys(d.ratings).length === 0 &&
    d.collection.packsOpened === 0
  );
}
