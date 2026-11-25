import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPlatform } from "./platforms";

// Réponses simulées : le même jeu est présent sur RAWG et IGDB
const rawgResponse = {
  results: [
    { id: 1, slug: "mario-kart-world", name: "Mario Kart World", released: "2025-06-05", background_image: null, rating: 4.3, genres: [{ slug: "racing", name: "Racing" }] },
    { id: 2, slug: "rawg-only", name: "Rawg Only", released: "2025-06-04", background_image: "r.jpg", rating: 3, genres: [] },
  ],
};
const igdbResponse = [
  { id: 900, slug: "mario-kart-world", name: "Mario Kart World™", first_release_date: 1749081600, total_rating: 86, genres: [{ id: 10, name: "Racing" }], artworks: [{ image_id: "abc" }] },
  { id: 901, slug: "igdb-only", name: "Igdb Only", first_release_date: 1749081600, genres: [{ id: 31, name: "Adventure" }] },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  const body = url.includes("id.twitch.tv")
    ? { access_token: "t", expires_in: 3600 }
    : url.includes("igdb.com")
      ? igdbResponse
      : rawgResponse;
  return new Response(JSON.stringify(body), { status: 200 });
});

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RAWG_API_KEY", "k");
  vi.stubEnv("IGDB_CLIENT_ID", "id");
  vi.stubEnv("IGDB_CLIENT_SECRET", "secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getNewGames", () => {
  it("combine RAWG et IGDB sans doublon", async () => {
    const { getNewGames } = await import("./games");
    const result = await getNewGames(getPlatform("switch")!, "semaine");

    expect(result.demo).toBe(false);
    expect(result.sources).toEqual(["rawg", "igdb"]);
    expect(result.games.map((g) => g.name)).toEqual(["Mario Kart World", "Rawg Only", "Igdb Only"]);
    const mk = result.games[0];
    expect(mk.sources).toEqual(["rawg", "igdb"]);
    expect(mk.image).toBe("https://images.igdb.com/igdb/image/upload/t_screenshot_big/abc.jpg");
    expect(result.games[2].genres).toEqual([{ slug: "adventure", name: "Aventure" }]);

    const igdbCall = fetchMock.mock.calls.find(([u]) => String(u).includes("api.igdb.com"))!;
    expect(String(igdbCall[1]?.body)).toContain("platforms = (130)");
  });

  it("affiche quand même RAWG si IGDB est en panne", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(rawgResponse)));
    fetchMock.mockImplementationOnce(async () => new Response("erreur", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getNewGames } = await import("./games");
    const result = await getNewGames(getPlatform("pc")!, "jour");
    expect(result.sources).toEqual(["rawg"]);
    expect(result.games).toHaveLength(2);
  });

  it("utilise les jeux d'exemple sans aucune clé", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("RAWG_API_KEY", "");
    vi.stubEnv("IGDB_CLIENT_ID", "");
    vi.stubEnv("IGDB_CLIENT_SECRET", "");
    const { getNewGames } = await import("./games");
    const result = await getNewGames(getPlatform("ps5")!, "mois");
    expect(result.demo).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
