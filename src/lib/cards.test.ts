import { describe, expect, it } from "vitest";
import {
  RARITIES,
  VITRAIL_CHANCE,
  availablePacks,
  oddsTable,
  openPack,
  rarityForRank,
  rollRarity,
  type Card,
} from "./cards";

describe("chances", () => {
  it("les chances par carte font exactement 100 %", () => {
    expect(RARITIES.reduce((s, r) => s + r.chance, 0)).toBeCloseTo(1, 10);
  });

  it("retrouve les chiffres du tableau « Chances par pack »", () => {
    const t = Object.fromEntries(oddsTable().map((r) => [r.id, r]));
    expect(t.commune.onePackIn).toBeNull(); // presque tous les packs
    expect(t.rare.pack).toBeCloseTo(0.4, 2);
    expect(t.rare.onePackIn).toBe(2.5);
    expect(t.epique.pack).toBeCloseTo(0.049, 3); // ≈ 5 %, 1 pack sur 20
    expect(t.epique.onePackIn).toBe(20);
    expect(t.legendaire.pack).toBeCloseTo(0.016, 3); // 1 pack sur 63
    expect(t.legendaire.onePackIn).toBe(63);
    expect(t.mythique.pack).toBeCloseTo(0.001, 4); // 1 pack sur 1000
    expect(t.mythique.onePackIn).toBe(1000);
  });

  it("le tirage respecte les chances (simulation de 200 000 cartes)", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const counts: Record<string, number> = {};
    const n = 200_000;
    for (let i = 0; i < n; i++) {
      const r = rollRarity(random);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts.commune / n).toBeCloseTo(0.8896, 2);
    expect(counts.rare / n).toBeCloseTo(0.097, 2);
    expect(counts.epique / n).toBeCloseTo(0.01, 2);
  });
});

const pool: Card[] = Array.from({ length: 150 }, (_, i) => ({
  id: i + 1,
  name: `Jeu ${i + 1}`,
  image: null,
  released: null,
  rarity: rarityForRank(i + 1),
}));

describe("openPack", () => {
  it("donne 5 cartes, les plus rares à la fin", () => {
    const { cards, vitrailUsed } = openPack(pool, { vitrailsLeft: 10, nextVitrailNumber: 1, random: () => 0.5 });
    expect(cards).toHaveLength(5);
    expect(vitrailUsed).toBe(false);
  });

  it("peut contenir un vitrail numéroté tant qu'il en reste", () => {
    const low = () => VITRAIL_CHANCE / 2; // tirage chanceux
    const withStock = openPack(pool, { vitrailsLeft: 3, nextVitrailNumber: 298, random: low });
    expect(withStock.vitrailUsed).toBe(true);
    expect(withStock.cards[4].vitrail).toBe(298);
    expect(["epique", "legendaire", "mythique"]).toContain(withStock.cards[4].rarity);

    const empty = openPack(pool, { vitrailsLeft: 0, nextVitrailNumber: 301, random: low });
    expect(empty.vitrailUsed).toBe(false);
    expect(empty.cards.some((c) => c.vitrail)).toBe(false);
  });

  it("se débrouille si une rareté n'a aucune carte", () => {
    const small = pool.filter((c) => c.rarity === "commune").slice(0, 3);
    const { cards } = openPack(small, { vitrailsLeft: 0, nextVitrailNumber: 1, random: () => 0 });
    expect(cards.every((c) => c.rarity === "commune")).toBe(true);
  });
});

describe("boosters disponibles", () => {
  it("1 gratuit par jour + 1 tous les 3 jeux notés", () => {
    expect(availablePacks({ lastFreeDay: null, bonusClaimed: 0 }, 0, "2026-11-25").total).toBe(1);
    expect(availablePacks({ lastFreeDay: "2026-11-25", bonusClaimed: 0 }, 7, "2026-11-25")).toEqual({ free: 0, bonus: 2, total: 2 });
    expect(availablePacks({ lastFreeDay: "2026-11-25", bonusClaimed: 2 }, 7, "2026-11-26")).toEqual({ free: 1, bonus: 0, total: 1 });
  });
});
