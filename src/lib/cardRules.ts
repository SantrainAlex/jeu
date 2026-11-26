/**
 * Les actions sur la collection de cartes (ouvrir un booster, atelier), sans dépendance au navigateur.
 * Quand les comptes sont activés, elles sont exécutées UNIQUEMENT par le serveur (/api/cartes/action) :
 * le navigateur ne fait que les demander, il ne peut pas écrire sa collection lui-même.
 */
import { RARITIES, consumePack, type Card, type PulledCard, type Rarity } from "./cards";
import type { Collection } from "./data";
import { QUEST_IDS, claimQuest, recordBooster, recordWorkshop, type QuestId, type Reward } from "./quests";
import { craft, recycleAll, recycleOne, tradeUp, upgrade } from "./workshop";

export type CardAction =
  | { type: "booster" }
  | { type: "recycleAll"; keep: number }
  | { type: "recycleOne"; id: number }
  | { type: "craft"; id: number }
  | { type: "tradeUp"; rarity: Rarity }
  | { type: "upgrade"; id: number }
  | { type: "claimQuest"; id: QuestId };

export type WorkshopAction = Exclude<CardAction, { type: "booster" } | { type: "claimQuest" }>;

/** Résultat renvoyé au navigateur après une action. */
export type CardActionResult = {
  collection: Collection;
  /** cartes du booster ouvert */
  pulled?: PulledCard[];
  /** carte reçue (échange de rareté, fabrication) */
  card?: Card;
  /** recyclage : pièces gagnées et cartes recyclées */
  coins?: number;
  cards?: number;
  /** quête : récompense reçue */
  reward?: Reward;
};

const isId = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x);

/** Vérifie une demande venue de l'extérieur : tout ce qui n'a pas la forme attendue est refusé. */
export function parseAction(raw: unknown): CardAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case "booster":
      return { type: "booster" };
    case "recycleAll":
      return isId(a.keep) && a.keep >= 1 && a.keep <= 100 ? { type: "recycleAll", keep: a.keep } : null;
    case "recycleOne":
    case "craft":
    case "upgrade":
      return isId(a.id) ? { type: a.type, id: a.id } : null;
    case "claimQuest":
      return QUEST_IDS.includes(a.id as QuestId) ? { type: "claimQuest", id: a.id as QuestId } : null;
    case "tradeUp":
      return RARITIES.some((r) => r.id === a.rarity) ? { type: "tradeUp", rarity: a.rarity as Rarity } : null;
    default:
      return null;
  }
}

/**
 * Range les cartes d'un booster dans la collection et retire un booster de la réserve.
 * Compte aussi le booster pour les quêtes du jour.
 * Renvoie null s'il n'y a pas de booster disponible (dans ce cas rien ne change).
 */
export function addPack(
  c: Collection,
  pulled: PulledCard[],
  now = Date.now(),
  opts: { countLocalVitrail?: boolean } = {},
): { collection: Collection; pulled: PulledCard[] } | null {
  const packs = consumePack(c, now);
  if (!packs) return null;
  const at = new Date(now).toISOString();
  const owned = { ...c.cards };
  const vitraux = [...c.vitraux];
  const cards = pulled.map((card) => {
    const { vitrail, isNew: _ignored, ...base } = card;
    void _ignored;
    if (vitrail) {
      vitraux.push({ card: base, number: vitrail, at });
      return { ...card, isNew: true };
    }
    const prev = owned[base.id];
    // « Nouvelle ! » si tu ne l'avais pas avant ce booster (la 2e du même booster est un doublon)
    owned[base.id] = prev ? { ...prev, count: prev.count + 1 } : { card: base, count: 1, firstAt: at };
    return { ...card, isNew: !prev };
  });
  const gotVitrail = cards.some((x) => x.vitrail);
  const collection: Collection = {
    ...c,
    cards: owned,
    vitraux,
    stock: packs.stock,
    stockAt: packs.stockAt,
    extraPacks: packs.extraPacks,
    packsOpened: c.packsOpened + 1,
    vitrailsGiven: c.vitrailsGiven + (opts.countLocalVitrail && gotVitrail ? 1 : 0),
  };
  return { pulled: cards, collection: recordBooster(collection, cards, now) };
}

/** Récupère la récompense d'une quête du jour (`rated` = jeux différents notés aujourd'hui). */
export function applyClaim(c: Collection, id: QuestId, rated: number, now = Date.now()): CardActionResult | null {
  const r = claimQuest(c, id, rated, now);
  return r && { collection: r.collection, reward: r.reward };
}

/**
 * Applique une action de l'atelier. Les cartes viennent toujours de `pool` (la liste officielle),
 * jamais de ce qu'envoie le navigateur. Renvoie null si l'action n'est pas permise.
 */
export function applyWorkshop(
  c: Collection,
  action: WorkshopAction,
  pool: Card[],
  random: () => number = Math.random,
  now = Date.now(),
): CardActionResult | null {
  const r = workshopStep(c, action, pool, random);
  if (!r) return null;
  // compte l'action pour les quêtes du jour
  const recycled = action.type === "recycleAll" ? (r.cards ?? 0) : action.type === "recycleOne" ? 1 : 0;
  return { ...r, collection: recordWorkshop(r.collection, recycled, now) };
}

function workshopStep(c: Collection, action: WorkshopAction, pool: Card[], random: () => number): CardActionResult | null {
  switch (action.type) {
    case "recycleAll": {
      const r = recycleAll(c, action.keep);
      return r.cards ? r : null;
    }
    case "recycleOne": {
      const next = recycleOne(c, action.id);
      return next && { collection: next };
    }
    case "craft": {
      const card = pool.find((p) => p.id === action.id);
      if (!card) return null;
      const next = craft(c, card);
      return next && { collection: next, card };
    }
    case "tradeUp":
      return tradeUp(c, action.rarity, pool, random);
    case "upgrade": {
      const next = upgrade(c, action.id);
      return next && { collection: next };
    }
  }
}
