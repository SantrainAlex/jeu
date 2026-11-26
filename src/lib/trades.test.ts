import { describe, expect, it } from "vitest";
import type { Card } from "./cards";
import { EMPTY_COLLECTION, copies, type Collection } from "./data";
import { applyTrade, itemsFrom, parseLines, parseTradeAction, tradableCards } from "./trades";

const card = (id: number, rarity: Card["rarity"] = "commune"): Card => ({ id, name: `Jeu ${id}`, image: null, rarity, released: null });
const coll = (cards: [number, number, number?][]): Collection => ({
  ...EMPTY_COLLECTION,
  cards: Object.fromEntries(cards.map(([id, count, used]) => [id, { card: card(id), count, used, firstAt: "2026-01-01" }])),
});

describe("parseTradeAction", () => {
  it("accepte une offre valide et regroupe une carte écrite deux fois", () => {
    const a = parseTradeAction({ type: "propose", to: " Alex_1 ", give: [{ id: 1, n: 1 }, { id: 1, n: 1 }], want: [{ id: 2, n: 1 }] });
    expect(a).toEqual({ type: "propose", to: "Alex_1", give: [{ id: 1, n: 2 }], want: [{ id: 2, n: 1 }] });
  });
  it("refuse les offres vides, trop grosses ou mal formées", () => {
    expect(parseTradeAction({ type: "propose", to: "bob", give: [], want: [{ id: 2, n: 1 }] })).toBeNull();
    expect(parseTradeAction({ type: "propose", to: "bob", give: [{ id: 1, n: 0 }], want: [{ id: 2, n: 1 }] })).toBeNull();
    expect(parseTradeAction({ type: "propose", to: "bob", give: [{ id: 1, n: 11 }], want: [{ id: 2, n: 1 }] })).toBeNull();
    expect(parseLines([1, 2, 3, 4, 5, 6].map((id) => ({ id, n: 1 })))).toBeNull();
    expect(parseTradeAction({ type: "propose", to: "a", give: [{ id: 1, n: 1 }], want: [{ id: 2, n: 1 }] })).toBeNull();
    expect(parseTradeAction({ type: "accept", id: "pas-un-id" })).toBeNull();
    expect(parseTradeAction({ type: "accept", id: "0b6c3c1e-1f7e-4d55-9a57-2b7a52d3c8f1" })).not.toBeNull();
  });
});

describe("échanges", () => {
  it("seuls les doublons sont échangeables", () => {
    const c = coll([[1, 3], [2, 1], [3, 4, 2]]);
    expect(tradableCards(c).map((x) => [x.id, x.n])).toEqual([[1, 2], [3, 1]]);
    expect(itemsFrom(c, [{ id: 2, n: 1 }])).toBeNull();
    expect(itemsFrom(c, [{ id: 1, n: 3 }])).toBeNull();
    expect(itemsFrom(c, [{ id: 1, n: 2 }])).not.toBeNull();
  });

  it("échange les cartes des deux côtés sans en créer ni en perdre", () => {
    const a = coll([[1, 3]]);
    const b = coll([[2, 2], [1, 1]]);
    const r = applyTrade(a, b, { give: [{ id: 1, n: 2 }], want: [{ id: 2, n: 1 }] })!;
    expect(copies(r.from.cards[1])).toBe(1);
    expect(copies(r.from.cards[2])).toBe(1);
    expect(copies(r.to.cards[1])).toBe(3);
    expect(copies(r.to.cards[2])).toBe(1);
    const sum = (id: number) => [r.from, r.to].reduce((s, c) => s + (c.cards[id] ? copies(c.cards[id]) : 0), 0);
    expect(sum(1)).toBe(4);
    expect(sum(2)).toBe(2);
  });

  it("refuse si l'un des deux n'a plus ses doublons", () => {
    const a = coll([[1, 2]]);
    const b = coll([[2, 1]]);
    expect(applyTrade(a, b, { give: [{ id: 1, n: 1 }], want: [{ id: 2, n: 1 }] })).toBeNull();
  });

  it("la finition reste chez celui qui donne", () => {
    const a = coll([[1, 8, 4]]);
    a.cards[1].finish = "argent";
    const r = applyTrade(a, coll([[2, 2]]), { give: [{ id: 1, n: 1 }], want: [{ id: 2, n: 1 }] })!;
    expect(r.from.cards[1].finish).toBe("argent");
    expect(r.to.cards[1].finish).toBeUndefined();
  });
});
