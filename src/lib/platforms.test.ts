import { describe, expect, it } from "vitest";
import { ALL_PLATFORMS, gamePlatforms, matchPlatform, PLATFORMS } from "./platforms";

describe("plateformes d'un jeu", () => {
  it("reconnaît les noms RAWG et IGDB", () => {
    expect(matchPlatform("PC (Microsoft Windows)")?.slug).toBe("pc");
    expect(matchPlatform("Xbox Series S/X")?.slug).toBe("xbox");
    expect(matchPlatform("Xbox Series X|S")?.slug).toBe("xbox");
    expect(matchPlatform("Nintendo Switch 2")?.slug).toBe("switch-2");
    expect(matchPlatform("Nintendo Switch")?.slug).toBe("switch");
    expect(matchPlatform("PlayStation 4")?.slug).toBe("ps4");
    expect(matchPlatform("macOS")).toBeUndefined();
  });
  it("range les plateformes dans l'ordre du site, sans doublon, et garde les autres à part", () => {
    const { known, others } = gamePlatforms(["PlayStation 5", "PC", "iOS", "Android", "macOS", "Nintendo Switch"]);
    expect(known.map((p) => p.slug)).toEqual(["switch", "pc", "ps5", "mobile"]);
    expect(others).toEqual(["macOS"]);
  });
});

describe("recherche sur toutes les plateformes", () => {
  it("réunit les identifiants de toutes les consoles du site, sans doublon", () => {
    for (const p of PLATFORMS) {
      for (const id of p.rawgIds) expect(ALL_PLATFORMS.rawgIds).toContain(id);
      for (const id of p.igdbIds) expect(ALL_PLATFORMS.igdbIds).toContain(id);
    }
    expect(new Set(ALL_PLATFORMS.igdbIds).size).toBe(ALL_PLATFORMS.igdbIds.length);
    expect(ALL_PLATFORMS.hideGamesOnlyOn).toBeUndefined();
  });

  it("n'apparaît pas dans la liste des consoles", () => {
    expect(PLATFORMS).not.toContain(ALL_PLATFORMS);
  });
});
