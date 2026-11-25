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
async function defaultFetch(url: string, _init?: RequestInit) {
  const body = url.includes("id.twitch.tv")
    ? { access_token: "t", expires_in: 3600 }
    : url.includes("igdb.com")
      ? igdbResponse
      : rawgResponse;
  return new Response(JSON.stringify(body), { status: 200 });
}
const fetchMock = vi.fn(defaultFetch);

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  fetchMock.mockImplementation(defaultFetch);
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

describe("Switch 2", () => {
  // RAWG et IGDB renvoient l'identifiant de la console quand on le leur demande par son nom
  function switch2Fetch(rawgKnowsIt: boolean) {
    return async (url: string, init?: RequestInit) => {
      if (url.includes("api.rawg.io/api/platforms")) {
        const results = [{ id: 7, name: "Nintendo Switch" }, ...(rawgKnowsIt ? [{ id: 999, name: "Nintendo Switch 2" }] : [])];
        return new Response(JSON.stringify({ results }));
      }
      if (url.includes("api.igdb.com/v4/platforms")) return new Response(JSON.stringify([{ id: 508 }]));
      return defaultFetch(url, init);
    };
  }

  it("utilise les identifiants trouvés par nom dans RAWG et IGDB", async () => {
    fetchMock.mockImplementation(switch2Fetch(true));
    const { getNewGames } = await import("./games");
    const result = await getNewGames(getPlatform("switch-2")!, "semaine");
    expect(result.sources).toEqual(["rawg", "igdb"]);
    const rawgCall = fetchMock.mock.calls.find(([u]) => String(u).includes("api.rawg.io/api/games"))!;
    expect(String(rawgCall[0])).toContain("platforms=999");
    const igdbCall = fetchMock.mock.calls.find(([u]) => String(u).includes("api.igdb.com/v4/games"))!;
    expect(String(igdbCall[1]?.body)).toContain("platforms = (508)");
  });

  it("n'affiche pas tous les jeux RAWG si RAWG ne connaît pas encore la Switch 2", async () => {
    fetchMock.mockImplementation(switch2Fetch(false));
    const { getNewGames } = await import("./games");
    const result = await getNewGames(getPlatform("switch-2")!, "semaine");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("api.rawg.io/api/games"))).toBe(false);
    expect(result.games.map((g) => g.name)).toEqual(["Mario Kart World™", "Igdb Only"]);
  });
});

describe("getCatalog", () => {
  it("cherche sur les deux sources et fusionne les doublons", async () => {
    const { getCatalog } = await import("./games");
    const result = await getCatalog(getPlatform("switch")!, { query: 'Mario "Kart"', sort: "populaires", page: 2 });

    expect(result.games.map((g) => g.name)).toEqual(["Mario Kart World", "Rawg Only", "Igdb Only"]);
    expect(result.hasMore).toBe(false);

    const rawgUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes("rawg.io"))![0]);
    expect(rawgUrl).toContain("search=Mario");
    expect(rawgUrl).toContain("page=2");
    const igdbBody = String(fetchMock.mock.calls.find(([u]) => String(u).includes("api.igdb.com"))![1]?.body);
    expect(igdbBody).toContain('search "Mario  Kart";');
    expect(igdbBody).toContain("offset 24;");
  });
});

describe("sources lentes", () => {
  it("n'attend pas IGDB plus de 1,5 s après la réponse de RAWG", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("rawg.io")) return new Response(JSON.stringify(rawgResponse));
      return new Promise<Response>(() => {}); // IGDB ne répond jamais
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getNewGames } = await import("./games");
    const pending = getNewGames(getPlatform("pc")!, "jour");
    await vi.advanceTimersByTimeAsync(1600);
    const result = await pending;
    expect(result.sources).toEqual(["rawg"]);
    expect(result.games).toHaveLength(2);
    vi.useRealTimers();
  });
});
