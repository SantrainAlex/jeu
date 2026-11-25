import { describe, expect, it } from "vitest";
import { applyFilters, computeTastes, DEFAULT_FILTERS, isStrongMatch, onlyOnMyPlatforms, platformsFor, rankGames } from "./reco";
import type { Game } from "./types";

const g = (id: number, genres: string[], platforms?: string[], rating = 4, released = "2025-01-01"): Game => ({
  id,
  slug: `g${id}`,
  name: `Jeu ${id}`,
  released,
  image: null,
  rating,
  genres: genres.map((s) => ({ slug: s, name: s })),
  sources: [],
  platforms,
});

const profile = { owned: ["switch", "pc"], interested: ["switch-2", "pc"] };
const tastes = computeTastes([
  { id: 100, stars: 5, genres: [{ slug: "racing", name: "Course" }] },
  { id: 101, stars: 5, genres: [{ slug: "racing", name: "Course" }, { slug: "action", name: "Action" }] },
  { id: 102, stars: 4, genres: [{ slug: "puzzle", name: "Puzzle" }] },
]);

describe("onlyOnMyPlatforms", () => {
  it("retire les jeux hors de tes plateformes et ceux sans plateforme connue", () => {
    const games = [g(1, ["racing"], ["switch", "ps5"]), g(2, ["racing"], ["ps5"]), g(3, ["racing"])];
    const kept = onlyOnMyPlatforms(games, ["switch", "switch-2"]);
    expect(kept.map((x) => x.id)).toEqual([1]);
    expect(kept[0].platforms).toEqual(["switch"]);
  });
});

describe("platformsFor", () => {
  it("sépare les consoles que j'ai de celles qui m'intéressent (sans doublon)", () => {
    expect(platformsFor("jai", profile)).toEqual(["switch", "pc"]);
    expect(platformsFor("interesse", profile)).toEqual(["switch-2"]);
    expect(platformsFor("toutes", profile)).toEqual(["switch", "pc", "switch-2"]);
    expect(platformsFor("switch-2", profile)).toEqual(["switch-2"]);
    expect(platformsFor("ps5", profile)).toEqual([]);
  });
});

describe("applyFilters", () => {
  const recos = rankGames(
    [
      g(1, ["racing", "action"], ["switch"], 3.5, "2024-05-01"),
      g(2, ["puzzle"], ["switch-2"], 4.8, "2025-09-01"),
      g(3, ["racing"], ["pc", "switch-2"], 4.0, "2023-01-01"),
    ],
    tastes,
    new Set(),
  );

  it("par défaut, garde tout et classe « pour moi »", () => {
    expect(applyFilters(recos, DEFAULT_FILTERS, profile, tastes).map((r) => r.id)).toEqual([1, 3, 2]);
  });
  it("filtre par console", () => {
    expect(applyFilters(recos, { ...DEFAULT_FILTERS, platform: "interesse" }, profile, tastes).map((r) => r.id)).toEqual([3, 2]);
    expect(applyFilters(recos, { ...DEFAULT_FILTERS, platform: "switch" }, profile, tastes).map((r) => r.id)).toEqual([1]);
  });
  it("filtre par genre", () => {
    expect(applyFilters(recos, { ...DEFAULT_FILTERS, genre: "puzzle" }, profile, tastes).map((r) => r.id)).toEqual([2]);
  });
  it("trie par note ou par date", () => {
    expect(applyFilters(recos, { ...DEFAULT_FILTERS, sort: "notes" }, profile, tastes).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(applyFilters(recos, { ...DEFAULT_FILTERS, sort: "recents" }, profile, tastes).map((r) => r.id)).toEqual([2, 1, 3]);
  });
  it("« coups de cœur » : seulement les jeux qui collent vraiment à tes goûts", () => {
    expect(recos.filter((r) => isStrongMatch(r, tastes)).map((r) => r.id)).toEqual([1, 3]);
    expect(applyFilters(recos, { ...DEFAULT_FILTERS, strongOnly: true }, profile, tastes).map((r) => r.id)).toEqual([1, 3]);
  });
});
