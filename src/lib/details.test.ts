import { describe, expect, it } from "vitest";
import { cleanDescription, combineDetails, gameHref, parseGameKey } from "./details";
import { igdbToDetails } from "./igdb";
import { rawgToDetails } from "./rawg";

describe("adresse d'une fiche", () => {
  it("un jeu RAWG a une adresse simple, un jeu IGDB est préfixé", () => {
    expect(gameHref({ id: 3498 })).toBe("/jeu/3498");
    expect(gameHref({ id: -1942 })).toBe("/jeu/igdb-1942");
  });
  it("relit l'adresse et refuse les adresses bizarres", () => {
    expect(parseGameKey("3498")).toEqual({ source: "rawg", id: 3498 });
    expect(parseGameKey("igdb-1942")).toEqual({ source: "igdb", id: 1942 });
    expect(parseGameKey("0")).toBeNull();
    expect(parseGameKey("-5")).toBeNull();
    expect(parseGameKey("abc")).toBeNull();
    expect(parseGameKey("12;drop")).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("enlève le HTML et la traduction espagnole ajoutée à la fin", () => {
    expect(cleanDescription("<p>Un jeu &amp; une aventure.</p><p>Suite</p>\nEspañol\nUn juego")).toBe(
      "Un jeu & une aventure.\n\nSuite",
    );
    expect(cleanDescription("   ")).toBeNull();
    expect(cleanDescription(undefined)).toBeNull();
  });
});

const rawg = rawgToDetails(
  {
    id: 3498,
    slug: "gta-v",
    name: "Grand Theft Auto V",
    released: "2013-09-17",
    background_image: "https://media.rawg.io/media/games/bg.jpg",
    rating: 4.47,
    ratings_count: 7000,
    metacritic: 92,
    playtime: 74,
    genres: [{ slug: "action", name: "Action" }],
    platforms: [{ platform: { name: "PC" } }, { platform: { name: "PlayStation 5" } }],
    developers: [{ name: "Rockstar North" }],
    publishers: [{ name: "Rockstar Games" }],
    esrb_rating: { name: "Mature" },
    tags: [{ slug: "singleplayer", name: "Singleplayer" }, { slug: "open-world", name: "Open World" }],
    description_raw: "Rockstar Games went bigger.\nEspañol\nRockstar fue más grande.",
    website: "http://www.rockstargames.com/V/",
  },
  [{ image: "https://media.rawg.io/media/games/bg.jpg" }, { image: "https://media.rawg.io/media/screenshots/a.jpg" }],
  [{ name: "Trailer", preview: "https://media.rawg.io/media/movies/p.jpg", data: { "480": "https://steamcdn/480.mp4", max: "https://steamcdn/max.mp4" } }],
);

describe("rawgToDetails", () => {
  it("traduit les infos RAWG pour la fiche", () => {
    expect(rawg.ageRating).toBe("17 ans et plus (ESRB M)");
    expect(rawg.modes).toEqual(["Solo"]);
    expect(rawg.description).toBe("Rockstar Games went bigger.");
    expect(rawg.platforms).toEqual(["PC", "PlayStation 5"]);
    expect(rawg.videos).toEqual([{ kind: "mp4", src: "https://steamcdn/480.mp4", poster: "https://media.rawg.io/media/movies/p.jpg", name: "Trailer" }]);
  });
  it("n'affiche pas deux fois l'image de fond et réduit les captures", () => {
    expect(rawg.screenshots).toEqual([
      {
        thumb: "https://media.rawg.io/media/resize/640/-/screenshots/a.jpg",
        full: "https://media.rawg.io/media/resize/1280/-/screenshots/a.jpg",
      },
    ]);
  });
});

const igdb = igdbToDetails({
  id: 1020,
  slug: "grand-theft-auto-v",
  name: "Grand Theft Auto V",
  first_release_date: 1379376000,
  total_rating: 90,
  total_rating_count: 3000,
  aggregated_rating: 96.4,
  summary: "Los Santos is a sprawling sun-soaked metropolis full of self-help gurus, starlets and fading celebrities, once the envy of the Western world, now struggling to stay afloat in an era of economic uncertainty.",
  genres: [{ id: 5, name: "Shooter" }],
  platforms: [{ name: "PC (Microsoft Windows)" }],
  cover: { image_id: "co1" },
  screenshots: [{ image_id: "sc1" }],
  videos: [{ video_id: "QkkoHAzjnUs", name: "Trailer" }],
  involved_companies: [
    { company: { name: "Rockstar North" }, developer: true, publisher: false },
    { company: { name: "Take-Two Interactive" }, developer: false, publisher: true },
  ],
  game_modes: [{ name: "Single player" }, { name: "Multiplayer" }],
  url: "https://www.igdb.com/games/grand-theft-auto-v",
});

describe("igdbToDetails", () => {
  it("traduit les infos IGDB pour la fiche", () => {
    expect(igdb.id).toBe(-1020);
    expect(igdb.cover).toBe("https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg");
    expect(igdb.platforms).toEqual(["PC"]);
    expect(igdb.developers).toEqual(["Rockstar North"]);
    expect(igdb.publishers).toEqual(["Take-Two Interactive"]);
    expect(igdb.modes).toEqual(["Solo", "Multijoueur"]);
    expect(igdb.press).toBe(96);
    expect(igdb.videos).toEqual([{ kind: "youtube", id: "QkkoHAzjnUs", name: "Trailer" }]);
  });
});

describe("combineDetails", () => {
  const both = combineDetails(rawg, igdb);
  it("garde l'identifiant de l'adresse et réunit les deux sources", () => {
    expect(both.id).toBe(3498);
    expect(both.igdbId).toBe(1020); // pour trouver les lives Twitch
    expect(both.sources).toEqual(["rawg", "igdb"]);
    expect(both.cover).toBe(igdb.cover);
    expect(both.press).toBe(92);
    expect(both.publishers).toEqual(["Rockstar Games", "Take-Two Interactive"]);
    expect(both.developers).toEqual(["Rockstar North"]);
    expect(both.screenshots).toHaveLength(2);
    expect(both.links.map((l) => l.source)).toEqual(["rawg", "igdb"]);
  });
  it("met les bandes-annonces YouTube en premier", () => {
    expect(both.videos.map((v) => v.kind)).toEqual(["youtube", "mp4"]);
  });
  it("préfère un vrai résumé à un très long texte", () => {
    // le texte RAWG fait moins de 150 caractères : trop court pour être un résumé, on garde celui d'IGDB
    expect(both.description).toBe(igdb.description);
    const longRawg = { ...rawg, description: "x ".repeat(800) };
    expect(combineDetails(longRawg, igdb).description).toBe(igdb.description);
  });
  it("sans deuxième source, la fiche reste la même", () => {
    expect(combineDetails(rawg, null)).toBe(rawg);
  });
});
