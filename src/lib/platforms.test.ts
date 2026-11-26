import { describe, expect, it } from "vitest";
import { gamePlatforms, matchPlatform } from "./platforms";

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
