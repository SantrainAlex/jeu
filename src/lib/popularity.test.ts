import { describe, expect, it } from "vitest";
import { rankByPopularity } from "./popularity";
import type { Game } from "./types";

const game = (name: string, id: number, source: "rawg" | "igdb"): Game => ({
  id,
  slug: name.toLowerCase(),
  name,
  released: "2020-01-01",
  image: null,
  rating: 0,
  genres: [],
  sources: [source],
});

const rawg = (...names: string[]) => names.map((n, i) => game(n, i + 1, "rawg"));
const igdb = (...names: string[]) => names.map((n, i) => game(n, -(i + 100), "igdb"));

describe("rankByPopularity", () => {
  it("fait passer devant un jeu bien placé dans les deux bases", () => {
    // A : 1er RAWG mais absent d'IGDB ; B : 2e dans les deux
    const order = rankByPopularity([rawg("A", "B", "C"), igdb("D", "B", "C")]).map((g) => g.name);
    expect(order[0]).toBe("B");
  });

  it("un jeu très populaire sur IGDB seulement ne finit plus tout en bas", () => {
    const r = rawg("A", "B", "C", "D", "E");
    const order = rankByPopularity([r, igdb("Zelda", "A", "B", "C", "D")]).map((g) => g.name);
    // avant, Zelda arrivait 6e (après toute la liste RAWG)
    expect(order.indexOf("Zelda")).toBeLessThan(order.indexOf("E"));
  });

  it("fusionne les doublons en gardant l'identifiant RAWG", () => {
    const games = rankByPopularity([rawg("Doom"), igdb("DOOM")]);
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe(1);
    expect(games[0].sources).toEqual(["rawg", "igdb"]);
  });

  it("garde l'ordre d'une seule source", () => {
    expect(rankByPopularity([rawg("A", "B", "C")]).map((g) => g.name)).toEqual(["A", "B", "C"]);
  });
});
