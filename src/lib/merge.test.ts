import { describe, expect, it } from "vitest";
import { isSameGame, mergeGames, normalizeTitle } from "./merge";
import type { Game } from "./types";

const game = (over: Partial<Game>): Game => ({
  id: 1,
  slug: "x",
  name: "X",
  released: "2025-03-01",
  image: null,
  rating: 0,
  genres: [],
  sources: ["rawg"],
  ...over,
});

describe("normalizeTitle", () => {
  it("ignore majuscules, accents, symboles et mentions d'édition", () => {
    expect(normalizeTitle("Pokémon™ Légendes : Z-A – Deluxe Edition")).toBe("pokemon legendes z a");
    expect(normalizeTitle("The Witcher 3: Wild Hunt - Game of the Year Edition")).toBe("witcher 3 wild hunt");
    expect(normalizeTitle("Ratchet & Clank")).toBe(normalizeTitle("Ratchet and Clank"));
  });

  it("garde les mots qui changent vraiment le jeu", () => {
    expect(normalizeTitle("Resident Evil 4 Remake")).not.toBe(normalizeTitle("Resident Evil 4"));
    expect(normalizeTitle("Zelda 2")).not.toBe(normalizeTitle("Zelda"));
  });
});

describe("isSameGame", () => {
  it("accepte un an d'écart (sorties régionales) mais pas plus", () => {
    const a = game({ name: "Doom", released: "2016-05-13" });
    expect(isSameGame(a, game({ name: "DOOM", released: "2017-01-01" }))).toBe(true);
    expect(isSameGame(a, game({ name: "Doom", released: "1993-12-10" }))).toBe(false);
    expect(isSameGame(a, game({ name: "Doom", released: null }))).toBe(true);
  });
});

describe("mergeGames", () => {
  it("fusionne les doublons RAWG/IGDB en gardant l'identifiant RAWG", () => {
    const rawg = [
      game({ id: 10, name: "Hollow Knight: Silksong", rating: 4.6, genres: [{ slug: "platformer", name: "Plateforme" }] }),
      game({ id: 11, name: "Seulement RAWG" }),
    ];
    const igdb = [
      game({
        id: -500,
        name: "Hollow Knight: Silksong",
        released: "2025-02-28",
        image: "https://images.igdb.com/x.jpg",
        rating: 4.4,
        genres: [{ slug: "platformer", name: "Plateforme" }, { slug: "indie", name: "Indé" }],
        sources: ["igdb"],
      }),
      game({ id: -501, name: "Seulement IGDB", sources: ["igdb"] }),
    ];

    const merged = mergeGames(rawg, igdb);
    expect(merged.map((g) => g.name)).toEqual(["Hollow Knight: Silksong", "Seulement RAWG", "Seulement IGDB"]);
    const silksong = merged[0];
    expect(silksong.id).toBe(10);
    expect(silksong.sources).toEqual(["rawg", "igdb"]);
    expect(silksong.image).toBe("https://images.igdb.com/x.jpg");
    expect(silksong.rating).toBe(4.5);
    expect(silksong.released).toBe("2025-02-28");
    expect(silksong.genres.map((g) => g.slug)).toEqual(["platformer", "indie"]);
  });
});
