/**
 * L'atelier : ce qu'on peut faire avec ses doublons (sans dépendance au navigateur, donc testable).
 * - recycler des doublons en pièces ;
 * - fabriquer une carte qui manque avec ses pièces ;
 * - échanger plusieurs doublons d'une rareté contre une carte au hasard de la rareté au-dessus ;
 * - passer une carte en finition argent puis or ;
 * - acheter un booster avec ses pièces.
 * Règle d'or : ton dernier exemplaire d'une carte n'est jamais utilisé.
 */
import { RARITIES, type Card, type Rarity } from "./cards";
import { coins, copies, type Collection, type Finish, type OwnedCard } from "./data";

/** Pièces rapportées par un doublon recyclé, selon sa rareté. */
export const RECYCLE_VALUE: Record<Rarity, number> = {
  commune: 5,
  rare: 20,
  epique: 100,
  legendaire: 400,
  mythique: 2000,
};

/** Prix pour fabriquer une carte : 8 doublons de la même rareté. */
export const CRAFT_PRICE: Record<Rarity, number> = Object.fromEntries(
  Object.entries(RECYCLE_VALUE).map(([r, v]) => [r, v * 8]),
) as Record<Rarity, number>;

/** Prix d'un booster acheté avec ses pièces. */
export const BOOSTER_PRICE = 150;

/**
 * Achète un booster : retire les pièces et ajoute un booster en plus (il s'ajoute à la réserve, sans limite).
 * Renvoie null s'il n'y a pas assez de pièces.
 */
export function buyBooster(c: Collection): Collection | null {
  if (coins(c) < BOOSTER_PRICE) return null;
  return { ...c, coinsSpent: c.coinsSpent + BOOSTER_PRICE, extraPacks: (c.extraPacks ?? 0) + 1 };
}

/** Nombre de doublons d'une rareté à donner pour une carte de la rareté au-dessus. */
export const TRADE_UP_COUNT = 5;

/** Finitions : exemplaires qu'il faut avoir en main, et combien sont utilisés. */
export const FINISHES: { id: Finish; label: string; need: number; cost: number; from?: Finish }[] = [
  { id: "argent", label: "Argent", need: 5, cost: 4 },
  { id: "or", label: "Or", need: 6, cost: 5, from: "argent" },
];

export const nextRarity = (r: Rarity): Rarity | null => {
  const i = RARITIES.findIndex((x) => x.id === r);
  return RARITIES[i + 1]?.id ?? null;
};

/** Doublons d'une carte : tous les exemplaires en main sauf `keep` (au moins 1). */
export const duplicates = (o: OwnedCard, keep = 1) => Math.max(0, copies(o) - Math.max(1, keep));

const spend = (o: OwnedCard, n: number): OwnedCard => ({ ...o, used: (o.used ?? 0) + n });

function receive(c: Collection, card: Card, now: string): Collection {
  const prev = c.cards[card.id];
  return {
    ...c,
    cards: {
      ...c.cards,
      [card.id]: prev ? { ...prev, count: prev.count + 1 } : { card, count: 1, firstAt: now },
    },
  };
}

// ---------- Recyclage ----------

/** Ce que rapporterait le recyclage de tous les doublons en gardant `keep` exemplaires de chaque carte. */
export function recyclePreview(c: Collection, keep = 1) {
  const byRarity = RARITIES.map((r) => ({ ...r, cards: 0, coins: 0 }));
  for (const o of Object.values(c.cards)) {
    const n = duplicates(o, keep);
    if (!n) continue;
    const row = byRarity.find((r) => r.id === o.card.rarity)!;
    row.cards += n;
    row.coins += n * RECYCLE_VALUE[o.card.rarity];
  }
  return {
    byRarity,
    cards: byRarity.reduce((s, r) => s + r.cards, 0),
    coins: byRarity.reduce((s, r) => s + r.coins, 0),
  };
}

export function recycleAll(c: Collection, keep = 1): { collection: Collection; coins: number; cards: number } {
  const cards = { ...c.cards };
  let gained = 0;
  let count = 0;
  for (const [id, o] of Object.entries(cards)) {
    const n = duplicates(o, keep);
    if (!n) continue;
    cards[id] = spend(o, n);
    gained += n * RECYCLE_VALUE[o.card.rarity];
    count += n;
  }
  return { collection: { ...c, cards, coinsEarned: c.coinsEarned + gained }, coins: gained, cards: count };
}

/** Recycle un seul doublon d'une carte précise. */
export function recycleOne(c: Collection, id: number): Collection | null {
  const o = c.cards[id];
  if (!o || duplicates(o) < 1) return null;
  return { ...c, cards: { ...c.cards, [id]: spend(o, 1) }, coinsEarned: c.coinsEarned + RECYCLE_VALUE[o.card.rarity] };
}

// ---------- Fabrication ----------

export function craft(c: Collection, card: Card, now = new Date().toISOString()): Collection | null {
  const price = CRAFT_PRICE[card.rarity];
  if (coins(c) < price) return null;
  return { ...receive(c, card, now), coinsSpent: c.coinsSpent + price };
}

// ---------- Échange de rareté ----------

/** Doublons disponibles pour un échange, par rareté (on garde toujours 1 exemplaire). */
export function tradeUpAvailable(c: Collection, rarity: Rarity) {
  return Object.values(c.cards)
    .filter((o) => o.card.rarity === rarity)
    .reduce((s, o) => s + duplicates(o), 0);
}

/**
 * Donne TRADE_UP_COUNT doublons de `rarity` (ceux dont tu as le plus d'exemplaires partent en premier)
 * et reçoit une carte au hasard de la rareté au-dessus.
 */
export function tradeUp(
  c: Collection,
  rarity: Rarity,
  pool: Card[],
  random: () => number = Math.random,
  now = new Date().toISOString(),
): { collection: Collection; card: Card } | null {
  const target = nextRarity(rarity);
  if (!target || tradeUpAvailable(c, rarity) < TRADE_UP_COUNT) return null;
  const candidates = pool.filter((p) => p.rarity === target);
  if (!candidates.length) return null;

  const cards = { ...c.cards };
  for (let left = TRADE_UP_COUNT; left > 0; left--) {
    // la carte avec le plus de doublons donne un exemplaire, puis on recommence
    const [id, o] = Object.entries(cards)
      .filter(([, o]) => o.card.rarity === rarity && duplicates(o) > 0)
      .sort(([, a], [, b]) => duplicates(b) - duplicates(a) || a.card.name.localeCompare(b.card.name))[0];
    cards[id] = spend(o, 1);
  }
  const card = candidates[Math.floor(random() * candidates.length)];
  return { collection: receive({ ...c, cards }, card, now), card };
}

// ---------- Finitions ----------

/** La prochaine finition possible pour cette carte (même si tu n'as pas encore assez d'exemplaires). */
export function nextFinish(o: OwnedCard) {
  return FINISHES.find((f) => (f.from ?? undefined) === o.finish) ?? null;
}

export function upgrade(c: Collection, id: number): Collection | null {
  const o = c.cards[id];
  const f = o && nextFinish(o);
  if (!o || !f || copies(o) < f.need) return null;
  return { ...c, cards: { ...c.cards, [id]: { ...spend(o, f.cost), finish: f.id } } };
}
