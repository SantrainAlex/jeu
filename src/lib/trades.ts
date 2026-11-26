/**
 * Les échanges de cartes entre joueurs (sans dépendance au navigateur ni à la base, donc testable).
 * Un joueur propose « je te donne ces cartes » contre « tu me donnes celles-là » ; l'autre accepte, refuse,
 * ou celui qui propose annule. Seuls les doublons s'échangent : ton dernier exemplaire d'une carte reste toujours à toi.
 * Le serveur revérifie tout au moment d'accepter : si l'un des deux n'a plus les cartes, l'échange est refusé.
 */
import type { Card } from "./cards";
import type { Collection } from "./data";
import { duplicates } from "./workshop";

export const TRADE_LIMITS = {
  /** cartes différentes de chaque côté */
  cardsPerSide: 5,
  /** exemplaires au total de chaque côté */
  copiesPerSide: 10,
  /** offres en attente que tu peux avoir envoyées en même temps */
  openSent: 10,
  /** offres en attente vers le même joueur */
  openToSamePlayer: 3,
  /** offres en attente qu'un joueur peut recevoir (au-delà, il faut qu'il en traite) */
  openReceived: 30,
  /** une offre sans réponse expire au bout de ce nombre de jours */
  expireDays: 7,
} as const;

export const EXPIRE_MS = TRADE_LIMITS.expireDays * 24 * 60 * 60 * 1000;

export type TradeLine = { id: number; n: number };
/** Une ligne d'offre telle qu'on l'affiche : la carte et le nombre d'exemplaires. */
export type TradeItem = TradeLine & { card: Card };

export type TradeStatus = "pending" | "accepted" | "refused" | "cancelled" | "expired";

export type TradeAction =
  | { type: "propose"; to: string; give: TradeLine[]; want: TradeLine[] }
  | { type: "accept" | "refuse" | "cancel"; id: string };

const isId = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const USERNAME = /^[\p{L}\p{N}_.-]{3,20}$/u;

/** Vérifie une liste de cartes envoyée par le navigateur (et regroupe une même carte écrite deux fois). */
export function parseLines(raw: unknown): TradeLine[] | null {
  if (!Array.isArray(raw) || raw.length > TRADE_LIMITS.cardsPerSide * 2) return null;
  const byId = new Map<number, number>();
  for (const x of raw) {
    if (!x || typeof x !== "object") return null;
    const { id, n } = x as Record<string, unknown>;
    if (!isId(id) || !isId(n) || n < 1) return null;
    byId.set(id, (byId.get(id) ?? 0) + n);
  }
  const lines = [...byId].map(([id, n]) => ({ id, n }));
  if (lines.length < 1 || lines.length > TRADE_LIMITS.cardsPerSide) return null;
  if (lines.reduce((s, l) => s + l.n, 0) > TRADE_LIMITS.copiesPerSide) return null;
  return lines;
}

/** Vérifie une demande venue de l'extérieur : tout ce qui n'a pas la forme attendue est refusé. */
export function parseTradeAction(raw: unknown): TradeAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.type === "propose") {
    if (typeof a.to !== "string" || !USERNAME.test(a.to.trim())) return null;
    const give = parseLines(a.give);
    const want = parseLines(a.want);
    return give && want ? { type: "propose", to: a.to.trim(), give, want } : null;
  }
  if (a.type === "accept" || a.type === "refuse" || a.type === "cancel") {
    return typeof a.id === "string" && UUID.test(a.id) ? { type: a.type, id: a.id } : null;
  }
  return null;
}

/** Les doublons d'une collection qu'on peut proposer à l'échange, les plus rares d'abord. */
export function tradableCards(c: Collection): TradeItem[] {
  const order = ["mythique", "legendaire", "epique", "rare", "commune"];
  return Object.values(c.cards)
    .map((o) => ({ id: o.card.id, n: duplicates(o), card: o.card }))
    .filter((x) => x.n > 0)
    .sort((a, b) => order.indexOf(a.card.rarity) - order.indexOf(b.card.rarity) || a.card.name.localeCompare(b.card.name, "fr"));
}

/** Les cartes d'une offre, avec leurs infos, si le joueur les a bien en doublon ; sinon null. */
export function itemsFrom(c: Collection, lines: TradeLine[]): TradeItem[] | null {
  const items: TradeItem[] = [];
  for (const l of lines) {
    const o = c.cards[l.id];
    if (!o || duplicates(o) < l.n) return null;
    // la carte reçue est une carte normale : la finition argent ou or reste chez celui qui la donne
    items.push({ ...l, card: o.card });
  }
  return items;
}

function take(c: Collection, items: TradeItem[]): Collection {
  const cards = { ...c.cards };
  for (const it of items) {
    const o = cards[it.id];
    cards[it.id] = { ...o, count: o.count - it.n };
  }
  return { ...c, cards };
}

function give(c: Collection, items: TradeItem[], at: string): Collection {
  const cards = { ...c.cards };
  for (const it of items) {
    const prev = cards[it.id];
    const { id, name, image, cover, rarity, released } = it.card;
    cards[it.id] = prev
      ? { ...prev, count: prev.count + it.n }
      : { card: { id, name, image, cover, rarity, released }, count: it.n, firstAt: at };
  }
  return { ...c, cards };
}

/**
 * Fait l'échange : `from` donne `give` à `to`, et `to` donne `want` à `from`.
 * Revérifie que chacun a encore les doublons (sinon null, et rien ne change).
 */
export function applyTrade(
  from: Collection,
  to: Collection,
  lines: { give: TradeLine[]; want: TradeLine[] },
  now = Date.now(),
): { from: Collection; to: Collection } | null {
  const given = itemsFrom(from, lines.give);
  const wanted = itemsFrom(to, lines.want);
  if (!given || !wanted) return null;
  const at = new Date(now).toISOString();
  return {
    from: give(take(from, given), wanted, at),
    to: give(take(to, wanted), given, at),
  };
}

/** Une offre telle que le navigateur l'affiche (jamais l'identifiant ni l'e-mail des joueurs, seulement leur nom). */
export type TradeView = {
  id: string;
  /** true = c'est toi qui as proposé */
  sent: boolean;
  /** le nom de l'autre joueur */
  other: string;
  /** ce que donne celui qui propose */
  give: TradeItem[];
  /** ce qu'il demande en échange */
  want: TradeItem[];
  status: TradeStatus;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string;
};

export type TradesList = { username: string | null; received: TradeView[]; sent: TradeView[]; history: TradeView[] };

/** Une offre en attente depuis trop longtemps est expirée. */
export const isExpired = (createdAt: string, now = Date.now()) => now - Date.parse(createdAt) > EXPIRE_MS;
