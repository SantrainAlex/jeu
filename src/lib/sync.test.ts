import { describe, expect, it } from "vitest";
import type { Card } from "./cards";
import { EMPTY, normalize, type Data } from "./data";
import { mergeData } from "./sync";

const card = (id: number): Card => ({ id, name: `Jeu ${id}`, image: null, released: null, rarity: "commune" });
const rating = (id: number, stars: number, ratedAt: string) => ({
  id, slug: `j${id}`, name: `Jeu ${id}`, image: null, released: null, genres: [], stars, ratedAt,
});

describe("mergeData", () => {
  it("garde toutes les notes, la plus récente en cas de conflit", () => {
    const local: Data = { ...EMPTY, ratings: { 1: rating(1, 5, "2026-11-25T10:00:00Z"), 2: rating(2, 3, "2026-11-25T09:00:00Z") } };
    const cloud: Data = { ...EMPTY, ratings: { 1: rating(1, 2, "2026-11-24T10:00:00Z"), 3: rating(3, 4, "2026-11-20T00:00:00Z") } };
    const m = mergeData(local, cloud);
    expect(Object.keys(m.ratings).sort()).toEqual(["1", "2", "3"]);
    expect(m.ratings[1].stars).toBe(5);
  });

  it("réunit les plateformes", () => {
    const m = mergeData(
      { ...EMPTY, profile: { owned: ["switch"], interested: ["pc"] } },
      { ...EMPTY, profile: { owned: ["switch", "ps5"], interested: [] } },
    );
    expect(m.profile.owned).toEqual(["switch", "ps5"]);
    expect(m.profile.interested).toEqual(["pc"]);
  });

  it("ne double pas les cartes déjà synchronisées et garde tous les vitraux", () => {
    const local = normalize({
      collection: {
        cards: { 1: { card: card(1), count: 3, firstAt: "2026-11-25" }, 2: { card: card(2), count: 1, firstAt: "2026-11-25" } },
        vitraux: [{ card: card(9), number: 12, at: "x" }],
        lastFreeDay: "2026-11-25", bonusClaimed: 1, packsOpened: 4,
      },
    });
    const cloud = normalize({
      collection: {
        cards: { 1: { card: card(1), count: 2, firstAt: "2026-11-20" } },
        vitraux: [{ card: card(9), number: 12, at: "x" }, { card: card(8), number: 40, at: "y" }],
        lastFreeDay: "2026-11-24", bonusClaimed: 2, packsOpened: 3,
      },
    });
    const m = mergeData(local, cloud).collection;
    expect(m.cards[1]).toEqual({ card: card(1), count: 3, firstAt: "2026-11-20" });
    expect(m.cards[2].count).toBe(1);
    expect(m.vitraux.map((v) => v.number).sort()).toEqual([12, 40]);
    expect(m.lastFreeDay).toBe("2026-11-25");
    expect(m.bonusClaimed).toBe(2);
    expect(m.packsOpened).toBe(4);
  });

  it("complète les données incomplètes", () => {
    expect(normalize(null)).toEqual(EMPTY);
    expect(normalize({ ratings: { 1: rating(1, 4, "t") } }).collection.packsOpened).toBe(0);
  });
  it("garde les exemplaires utilisés, la meilleure finition et les pièces les plus avancées", () => {
    const base = normalize({});
    const local = {
      ...base,
      collection: {
        ...base.collection,
        cards: { 1: { card: card(1), count: 10, firstAt: "a", used: 4, finish: "argent" as const } },
        coinsEarned: 50,
        coinsSpent: 0,
      },
    };
    const cloud = {
      ...base,
      collection: { ...base.collection, cards: { 1: { card: card(1), count: 8, firstAt: "a" } }, coinsEarned: 20, coinsSpent: 40 },
    };
    const m = mergeData(local, cloud).collection;
    expect(m.cards[1]).toMatchObject({ count: 10, used: 4, finish: "argent" });
    expect([m.coinsEarned, m.coinsSpent]).toEqual([50, 40]);
  });
});
