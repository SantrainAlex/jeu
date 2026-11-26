import { describe, expect, it } from "vitest";
import {
  CARD_POOL_SIZE,
  RARITIES,
  VITRAIL_CHANCE,
  availablePacks,
  consumePack,
  type PackState,
  oddsTable,
  openPack,
  rarityForRank,
  rollRarity,
  withPoolArt,
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

const pool: Card[] = Array.from({ length: CARD_POOL_SIZE }, (_, i) => ({
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
  const T0 = new Date("2026-11-25T12:00:00Z").getTime();
  const MIN = 60 * 1000;

  it("réserve pleine (5) au départ, + 1 tous les 3 jeux notés", () => {
    expect(availablePacks({ bonusClaimed: 0 }, 0, T0)).toEqual({ timed: 5, bonus: 0, total: 5, nextIn: null });
    expect(availablePacks({ bonusClaimed: 0 }, 7, T0).total).toBe(7);
  });

  it("à 5, ouvrir un booster relance la recharge : +1 toutes les 30 min", () => {
    const s1 = consumePack({ bonusClaimed: 0 }, 0, T0)!;
    expect(availablePacks(s1, 0, T0)).toMatchObject({ timed: 4, nextIn: 30 * MIN });
    expect(availablePacks(s1, 0, T0 + 10 * MIN).nextIn).toBe(20 * MIN);
    expect(availablePacks(s1, 0, T0 + 30 * MIN)).toMatchObject({ timed: 5, nextIn: null });
  });

  it("ne dépasse jamais 5, et garde l'avancement de la recharge en cours", () => {
    let s: PackState = { bonusClaimed: 0 };
    for (let i = 0; i < 5; i++) s = consumePack(s, 0, T0)!;
    expect(availablePacks(s, 0, T0).timed).toBe(0);
    expect(consumePack(s, 0, T0)).toBeNull();
    // 75 min plus tard : 2 boosters, le 3e dans 15 min
    expect(availablePacks(s, 0, T0 + 75 * MIN)).toMatchObject({ timed: 2, nextIn: 15 * MIN });
    s = consumePack(s, 0, T0 + 75 * MIN)!;
    expect(availablePacks(s, 0, T0 + 90 * MIN)).toMatchObject({ timed: 2, nextIn: 30 * MIN });
    // une journée plus tard : plafonné à 5
    expect(availablePacks(s, 0, T0 + 24 * 60 * MIN).timed).toBe(5);
  });

  it("utilise un bonus quand la réserve est vide", () => {
    let s: PackState = { bonusClaimed: 0 };
    for (let i = 0; i < 5; i++) s = consumePack(s, 3, T0)!;
    s = consumePack(s, 3, T0)!;
    expect(s.bonusClaimed).toBe(1);
    expect(consumePack(s, 3, T0)).toBeNull();
  });
});

describe("rareté selon la popularité (1 000 cartes)", () => {
  it("répartit les paliers : 20 Mythiques, 60 Légendaires, 120 Épiques, 240 Rares, 560 Communes", () => {
    const counts: Record<string, number> = {};
    for (let rank = 1; rank <= 1000; rank++) {
      const r = rarityForRank(rank);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts).toEqual({ mythique: 20, legendaire: 60, epique: 120, rare: 240, commune: 560 });
  });
});

describe("withPoolArt", () => {
  const old: Card = { id: 7, name: "Dark Souls", image: "wide.jpg", rarity: "epique", released: "2011-09-22" };
  it("prend la jaquette de la collection actuelle pour une carte déjà possédée", () => {
    const pool = new Map([[7, { ...old, image: "wide2.jpg", cover: "cover.jpg" }]]);
    expect(withPoolArt(old, pool)).toMatchObject({ image: "wide2.jpg", cover: "cover.jpg", rarity: "epique" });
  });
  it("laisse la carte telle quelle si le jeu n'est plus dans la collection", () => {
    expect(withPoolArt(old, new Map())).toBe(old);
    expect(withPoolArt(old, null)).toBe(old);
  });
});
