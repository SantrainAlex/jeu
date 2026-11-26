import { describe, expect, it } from "vitest";
import type { PulledCard } from "./cards";
import { EMPTY_COLLECTION, type Collection } from "./data";
import {
  QUESTS_PER_PERIOD,
  claimQuest,
  msUntilPeriodEnd,
  msUntilReset,
  parisDay,
  periodKey,
  questsFor,
  ratedIn,
  questBoard,
  questsForDay,
  ratedToday,
  recordBooster,
  recordWorkshop,
  withLegacyBonus,
} from "./quests";

// 26 novembre 2026, 12 h à Paris (11 h UTC en hiver)
const NOON = new Date("2026-11-26T11:00:00Z").getTime();
const H = 3_600_000;
const card = (id: number, rarity: PulledCard["rarity"] = "commune", isNew = true): PulledCard => ({
  id,
  name: `Jeu ${id}`,
  image: null,
  released: null,
  rarity,
  isNew,
});

describe("jour et minuit à l'heure de Paris", () => {
  it("change de jour à minuit à Paris, pas à minuit UTC", () => {
    expect(parisDay(new Date("2026-11-26T22:59:00Z"))).toBe("2026-11-26");
    expect(parisDay(new Date("2026-11-26T23:00:00Z"))).toBe("2026-11-27");
    // en été (UTC+2)
    expect(parisDay(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
  });
  it("compte le temps jusqu'à minuit", () => {
    expect(msUntilReset(NOON)).toBe(12 * H);
    expect(msUntilReset(new Date("2026-11-26T22:30:00Z").getTime())).toBe(H / 2);
  });
});

describe("quêtes qui changent chaque jour", () => {
  it("toujours les mêmes pour un jour donné, 3 + « toutes les quêtes »", () => {
    const a = questsForDay("2026-11-26");
    expect(questsForDay("2026-11-26")).toEqual(a);
    expect(a).toHaveLength(QUESTS_PER_PERIOD + 1);
    expect(new Set(a.map((q) => q.id)).size).toBe(a.length);
    expect(a.at(-1)!.id).toBe("all");
  });
  it("ne sont pas les mêmes tous les jours", () => {
    const days = Array.from({ length: 14 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`);
    const sets = new Set(days.map((d) => questsForDay(d).map((q) => `${q.id}:${q.goal}`).join(",")));
    expect(sets.size).toBeGreaterThan(5);
  });
});

describe("avancement et récompenses", () => {
  it("compte les jeux différents notés aujourd'hui seulement", () => {
    const ratings = {
      1: { stars: 4, ratedAt: "2026-11-26T08:00:00Z" },
      2: { stars: 5, ratedAt: "2026-11-25T22:30:00Z" }, // 23 h 30 à Paris la veille
      3: { stars: 9, ratedAt: "2026-11-26T08:00:00Z" }, // note invalide
      4: { stars: 2, ratedAt: "2026-11-25T23:30:00Z" }, // 0 h 30 à Paris : aujourd'hui
    };
    expect(ratedToday(ratings, NOON)).toBe(2);
  });

  it("compte boosters, cartes rares, nouvelles cartes et atelier, et repart de zéro le lendemain", () => {
    let c: Collection = recordBooster(EMPTY_COLLECTION, [card(1), card(2, "rare"), card(3, "commune", false)], NOON);
    c = recordWorkshop(c, 4, NOON);
    expect(c.quests).toEqual({ day: "2026-11-26", counts: { opened: 1, rare: 1, fresh: 2, workshop: 1, recycled: 4 }, claimed: [] });
    expect(questBoard(c, 0, NOON + 13 * H).every((q) => q.progress === 0)).toBe(true);
  });

  it("une récompense par quête et par jour, seulement si elle est finie", () => {
    let c: Collection = EMPTY_COLLECTION;
    // tout faire pour finir n'importe quelle quête du jour
    for (let i = 0; i < 5; i++) c = recordBooster(c, [card(i * 10 + 1, "epique"), card(i * 10 + 2, "rare")], NOON);
    c = recordWorkshop(c, 10, NOON);
    const board = questBoard(c, 5, NOON);
    expect(board.every((q) => q.done)).toBe(true);
    expect(claimQuest(EMPTY_COLLECTION, board[0].id, 0, NOON)).toBeNull();

    let coins = 0;
    let packs = 0;
    for (const q of board) {
      const r = claimQuest(c, q.id, 5, NOON)!;
      expect(r).not.toBeNull();
      c = r.collection;
      coins += q.reward.coins ?? 0;
      packs += q.reward.packs ?? 0;
      expect(claimQuest(c, q.id, 5, NOON)).toBeNull();
    }
    expect(c.coinsEarned).toBe(coins);
    expect(c.extraPacks).toBe(packs);
    // le lendemain, les quêtes sont nouvelles mais il faut tout refaire
    expect(questBoard(c, 0, NOON + 24 * H).some((q) => q.claimed || q.done)).toBe(false);
  });

  it("refuse une quête qui n'est pas au programme du jour", () => {
    const ids = questsForDay("2026-11-26").map((q) => q.id);
    const other = (["rated", "opened", "rare", "fresh", "workshop", "recycled"] as const).find((id) => !ids.includes(id))!;
    let c: Collection = EMPTY_COLLECTION;
    for (let i = 0; i < 5; i++) c = recordBooster(c, [card(i, "rare")], NOON);
    c = recordWorkshop(c, 10, NOON);
    expect(claimQuest(c, other, 10, NOON)).toBeNull();
  });
});

describe("passage depuis l'ancien bonus « tous les 3 jeux notés »", () => {
  it("garde les boosters pas encore ouverts, 3 au plus, une seule fois", () => {
    expect(withLegacyBonus({ ...EMPTY_COLLECTION, bonusClaimed: 1 }, 7).extraPacks).toBe(1);
    expect(withLegacyBonus(EMPTY_COLLECTION, 90).extraPacks).toBe(3);
    expect(withLegacyBonus({ ...EMPTY_COLLECTION, extraPacks: 0 }, 90).extraPacks).toBe(0);
  });
});

describe("quêtes de la semaine et du mois", () => {
  it("la semaine commence le lundi, le mois le 1er (heure de Paris)", () => {
    // jeudi 26 novembre 2026
    expect(periodKey("week", NOON)).toBe("2026-11-23");
    expect(periodKey("month", NOON)).toBe("2026-11");
    // dimanche 29 à 23 h 30 à Paris : encore la même semaine ; lundi 0 h 30 : nouvelle semaine
    expect(periodKey("week", new Date("2026-11-29T22:30:00Z"))).toBe("2026-11-23");
    expect(periodKey("week", new Date("2026-11-29T23:30:00Z"))).toBe("2026-11-30");
    // 30 novembre 23 h 30 UTC = 1er décembre 0 h 30 à Paris
    expect(periodKey("month", new Date("2026-11-30T23:30:00Z"))).toBe("2026-12");
  });

  it("compte le temps jusqu'à lundi et jusqu'au 1er", () => {
    // jeudi midi → lundi minuit : 3 jours et 12 h
    expect(msUntilPeriodEnd("week", NOON)).toBe(3 * 24 * H + 12 * H);
    // 26 novembre midi → 1er décembre minuit : 4 jours et 12 h
    expect(msUntilPeriodEnd("month", NOON)).toBe(4 * 24 * H + 12 * H);
  });

  it("des objectifs plus grands que ceux du jour, et un tirage différent chaque semaine", () => {
    const day = questsFor("day", "2026-11-26");
    const week = questsFor("week", "2026-11-23");
    const month = questsFor("month", "2026-11");
    const goal = (list: typeof day) => list.filter((q) => q.id !== "all").reduce((s, q) => s + q.goal, 0);
    expect(goal(week)).toBeGreaterThan(goal(day));
    expect(goal(month)).toBeGreaterThan(goal(week));
    const weeks = new Set(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"].map((w) =>
      questsFor("week", w).map((q) => `${q.id}:${q.goal}`).join(),
    ));
    expect(weeks.size).toBeGreaterThan(2);
  });

  it("chaque booster compte pour le jour, la semaine et le mois ; une récompense par période", () => {
    let c: Collection = EMPTY_COLLECTION;
    for (let i = 0; i < 100; i++) c = recordBooster(c, [card(i * 10 + 1, "epique"), card(i * 10 + 2, "rare")], NOON);
    c = recordWorkshop(c, 200, NOON);
    for (let i = 0; i < 20; i++) c = recordWorkshop(c, 0, NOON);
    expect(c.questsWeek?.counts.opened).toBe(100);
    expect(c.questsMonth?.counts.recycled).toBe(200);

    const week = questBoard(c, 60, NOON, "week");
    expect(week.every((q) => q.done)).toBe(true);
    let packs = 0;
    for (const q of week) {
      const r = claimQuest(c, q.id, 60, NOON, "week")!;
      c = r.collection;
      packs += q.reward.packs ?? 0;
      expect(claimQuest(c, q.id, 60, NOON, "week")).toBeNull();
    }
    expect(c.extraPacks).toBe(packs);
    // les quêtes du mois et du jour ne sont pas touchées
    expect(questBoard(c, 60, NOON, "month").some((q) => q.claimed)).toBe(false);
    expect(questBoard(c, 60, NOON, "day").some((q) => q.claimed)).toBe(false);
    // le lundi suivant, nouvelle semaine
    expect(questBoard(c, 0, NOON + 4 * 24 * H, "week").some((q) => q.claimed || q.done)).toBe(false);
  });

  it("compte les jeux notés dans la semaine", () => {
    const ratings = {
      1: { stars: 4, ratedAt: "2026-11-23T08:00:00Z" }, // lundi
      2: { stars: 5, ratedAt: "2026-11-22T20:00:00Z" }, // dimanche d'avant
      3: { stars: 3, ratedAt: "2026-11-02T08:00:00Z" }, // ce mois-ci
    };
    expect(ratedIn(ratings, "week", NOON)).toBe(1);
    expect(ratedIn(ratings, "month", NOON)).toBe(3);
  });
});
