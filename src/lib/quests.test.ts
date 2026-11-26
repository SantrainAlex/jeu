import { describe, expect, it } from "vitest";
import type { PulledCard } from "./cards";
import { EMPTY_COLLECTION, type Collection } from "./data";
import {
  QUESTS_PER_DAY,
  claimQuest,
  msUntilReset,
  parisDay,
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
    expect(a).toHaveLength(QUESTS_PER_DAY + 1);
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
