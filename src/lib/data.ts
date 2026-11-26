import type { Card } from "./cards";
import type { QuestState } from "./quests";
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

/** Finition d'une carte, débloquée à l'atelier avec des doublons. */
export type Finish = "argent" | "or";

export type OwnedCard = {
  card: Card;
  /** nombre total d'exemplaires reçus (boosters, fabrication, échanges) */
  count: number;
  firstAt: string;
  /** exemplaires utilisés à l'atelier (recyclage, échange de rareté, finitions) */
  used?: number;
  finish?: Finish;
};

export type Collection = {
  /** cartes possédées : identifiant du jeu → carte et nombre d'exemplaires */
  cards: Record<string, OwnedCard>;
  /** vitraux numérotés obtenus */
  vitraux: { card: Card; number: number; at: string }[];
  /** ancien système (1 booster par jour), gardé pour les anciennes données */
  lastFreeDay: string | null;
  /** boosters en réserve (1 toutes les 30 min, 5 maximum) au moment `stockAt` ; null = réserve pleine */
  stock?: number;
  stockAt?: string | null;
  /** ancien système (1 booster tous les 3 jeux notés) : nombre de ces boosters déjà ouverts */
  bonusClaimed: number;
  /** boosters gagnés avec les quêtes du jour, pas encore ouverts (absent = pas encore passé aux quêtes) */
  extraPacks?: number;
  /** avancement des quêtes du jour */
  quests?: QuestState;
  packsOpened: number;
  /** vitraux distribués sur ce navigateur quand on n'est pas connecté (le stock en ligne est partagé) */
  vitrailsGiven: number;
  /** pièces gagnées en recyclant des doublons, et pièces dépensées à l'atelier (solde = gagnées - dépensées) */
  coinsEarned: number;
  coinsSpent: number;
};

export type Data = { profile: Profile; ratings: Record<string, Rating>; collection: Collection };

export const EMPTY_COLLECTION: Collection = {
  cards: {},
  vitraux: [],
  lastFreeDay: null,
  bonusClaimed: 0,
  packsOpened: 0,
  vitrailsGiven: 0,
  coinsEarned: 0,
  coinsSpent: 0,
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

/** Nombre d'exemplaires que tu as encore en main. */
export const copies = (o: OwnedCard) => o.count - (o.used ?? 0);

/** Ton solde de pièces. */
export const coins = (c: Collection) => c.coinsEarned - c.coinsSpent;
