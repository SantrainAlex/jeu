import { describe, expect, it } from "vitest";
import type { Card, Rarity } from "./cards";
import { EMPTY_COLLECTION, coins, copies, type Collection } from "./data";
import { BOOSTER_PRICE, CRAFT_PRICE, RECYCLE_VALUE, buyBooster, craft, recycleAll, recycleOne, recyclePreview, tradeUp, upgrade } from "./workshop";

const card = (id: number, rarity: Rarity = "commune"): Card => ({ id, name: `Jeu ${id}`, image: null, released: null, rarity });

function withCards(list: [Card, number][], extra: Partial<Collection> = {}): Collection {
  return {
    ...EMPTY_COLLECTION,
    ...extra,
    cards: Object.fromEntries(list.map(([c, n]) => [c.id, { card: c, count: n, firstAt: "t" }])),
  };
}

describe("atelier", () => {
  it("recycle les doublons et garde toujours le dernier exemplaire", () => {
    const c = withCards([[card(1), 4], [card(2, "rare"), 2], [card(3), 1]]);
    expect(recyclePreview(c).cards).toBe(4);
    const r = recycleAll(c);
    expect(r.coins).toBe(3 * RECYCLE_VALUE.commune + RECYCLE_VALUE.rare);
    expect(Object.values(r.collection.cards).map(copies)).toEqual([1, 1, 1]);
    expect(coins(r.collection)).toBe(r.coins);
    // plus rien à recycler
    expect(recycleAll(r.collection).cards).toBe(0);
    expect(recycleOne(r.collection, 1)).toBeNull();
  });

  it("peut garder plusieurs exemplaires de chaque carte", () => {
    const c = withCards([[card(1), 7], [card(2), 3]]);
    expect(recyclePreview(c, 5).cards).toBe(2);
    expect(recyclePreview(c, 2).cards).toBe(6);
  });

  it("fabrique une carte seulement avec assez de pièces", () => {
    const c = withCards([], { coinsEarned: CRAFT_PRICE.rare - 1 });
    expect(craft(c, card(5, "rare"))).toBeNull();
    const rich = { ...c, coinsEarned: CRAFT_PRICE.rare };
    const after = craft(rich, card(5, "rare"))!;
    expect(coins(after)).toBe(0);
    expect(copies(after.cards[5])).toBe(1);
  });

  it("échange 5 doublons contre une carte de la rareté au-dessus, les plus nombreux d'abord", () => {
    const c = withCards([[card(1), 5], [card(2), 2], [card(3), 1]]);
    const pool = [card(10, "rare"), card(11, "rare"), card(20, "epique")];
    const r = tradeUp(c, "commune", pool, () => 0.6)!;
    expect(r.card.id).toBe(11);
    expect(copies(r.collection.cards[1])).toBe(1); // 4 doublons donnés
    expect(copies(r.collection.cards[2])).toBe(1); // 1 doublon donné
    expect(copies(r.collection.cards[3])).toBe(1);
    expect(copies(r.collection.cards[11])).toBe(1);
    // plus assez de doublons
    expect(tradeUp(r.collection, "commune", pool)).toBeNull();
  });

  it("passe une carte en argent (5 exemplaires) puis en or (5 de plus)", () => {
    let c = withCards([[card(1), 4]]);
    expect(upgrade(c, 1)).toBeNull();
    c = withCards([[card(1), 10]]);
    c = upgrade(c, 1)!;
    expect(c.cards[1].finish).toBe("argent");
    expect(copies(c.cards[1])).toBe(6);
    c = upgrade(c, 1)!;
    expect(c.cards[1].finish).toBe("or");
    expect(copies(c.cards[1])).toBe(1);
    expect(upgrade(c, 1)).toBeNull();
  });
});

describe("acheter un booster", () => {
  it("refuse s'il manque des pièces", () => {
    expect(buyBooster(withCards([], { coinsEarned: BOOSTER_PRICE - 1 }))).toBeNull();
  });
  it("retire 150 pièces et ajoute un booster en plus", () => {
    const next = buyBooster(withCards([], { coinsEarned: BOOSTER_PRICE + 10, extraPacks: 2 }))!;
    expect(coins(next)).toBe(10);
    expect(next.extraPacks).toBe(3);
    expect(buyBooster(next)).toBeNull();
  });
});
