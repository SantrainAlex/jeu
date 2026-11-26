import { describe, expect, it } from "vitest";
import { MAX_STOCK, type Card } from "./cards";
import { addPack, applyWorkshop, parseAction } from "./cardRules";
import { EMPTY_COLLECTION, type Collection } from "./data";

const card = (id: number, rarity: Card["rarity"] = "commune"): Card => ({ id, name: `Jeu ${id}`, image: null, released: null, rarity });
const T0 = Date.parse("2026-11-26T08:00:00Z");

describe("parseAction (demandes venues du navigateur)", () => {
  it("refuse tout ce qui n'a pas la forme attendue", () => {
    expect(parseAction(null)).toBeNull();
    expect(parseAction({ type: "donne-moi-des-mythiques" })).toBeNull();
    expect(parseAction({ type: "craft", id: "1" })).toBeNull();
    expect(parseAction({ type: "recycleAll", keep: 0 })).toBeNull();
    expect(parseAction({ type: "tradeUp", rarity: "divine" })).toBeNull();
  });
  it("ne garde que les champs utiles", () => {
    expect(parseAction({ type: "booster", cards: [card(1, "mythique")] })).toEqual({ type: "booster" });
    expect(parseAction({ type: "craft", id: 3, card: card(3, "commune") })).toEqual({ type: "craft", id: 3 });
  });
});

describe("addPack", () => {
  it("refuse d'ouvrir un booster quand la réserve est vide", () => {
    let c: Collection = EMPTY_COLLECTION;
    for (let i = 0; i < MAX_STOCK; i++) c = addPack(c, [card(i)], 0, T0)!.collection;
    expect(addPack(c, [card(99)], 0, T0)).toBeNull();
    // 30 minutes plus tard, un booster est revenu
    expect(addPack(c, [card(99)], 0, T0 + 30 * 60 * 1000)).not.toBeNull();
  });
  it("marque les nouvelles cartes et compte les doublons", () => {
    const r = addPack(EMPTY_COLLECTION, [card(1), card(1), card(2)], 0, T0)!;
    expect(r.pulled.map((c) => c.isNew)).toEqual([true, false, true]);
    expect(r.collection.cards[1].count).toBe(2);
    expect(r.collection.packsOpened).toBe(1);
  });
});

describe("applyWorkshop", () => {
  it("fabrique la carte de la liste officielle, pas celle envoyée par le navigateur", () => {
    const pool = [card(5, "mythique")];
    const rich = { ...EMPTY_COLLECTION, coinsEarned: 100 };
    // une mythique coûte 16 000 pièces : impossible avec 100, même si un tricheur prétend qu'elle est commune
    expect(applyWorkshop(rich, { type: "craft", id: 5 }, pool)).toBeNull();
    expect(applyWorkshop({ ...rich, coinsEarned: 1e9 }, { type: "craft", id: 404 }, pool)).toBeNull();
  });
  it("refuse de recycler quand il n'y a pas de doublon", () => {
    const c = { ...EMPTY_COLLECTION, cards: { 1: { card: card(1), count: 1, firstAt: "x" } } };
    expect(applyWorkshop(c, { type: "recycleAll", keep: 1 }, [])).toBeNull();
    expect(applyWorkshop(c, { type: "recycleOne", id: 1 }, [])).toBeNull();
  });
});
