import { describe, expect, it } from "vitest";
import { shopLinks, toOffers } from "./shops";

describe("liens vers les boutiques", () => {
  it("sans code d'affiliation, les liens marchent quand même", () => {
    const [ig, amazon] = shopLinks("Zelda: Tears of the Kingdom", {});
    expect(ig.url).toBe("https://www.instant-gaming.com/fr/rechercher/?q=Zelda%3A%20Tears%20of%20the%20Kingdom");
    expect(ig.affiliate).toBe(false);
    expect(amazon.url).toContain("amazon.fr/s?k=Zelda");
    expect(amazon.url).not.toContain("tag=");
  });
  it("ajoute les codes d'affiliation configurés", () => {
    const [ig, amazon] = shopLinks("Hades", { INSTANT_GAMING_IGR: "gamer-abc", AMAZON_TAG: "jeu-21" });
    expect(ig.url).toBe("https://www.instant-gaming.com/fr/rechercher/?q=Hades&igr=gamer-abc");
    expect(amazon.url).toBe("https://www.amazon.fr/s?k=Hades&i=videogames&tag=jeu-21");
    expect(ig.affiliate && amazon.affiliate).toBe(true);
  });
});

describe("toOffers", () => {
  const deal = (shop: string, amount: number, cut = 0) => ({
    shop: { name: shop }, price: { amount, currency: "EUR" }, regular: { amount: 30 }, cut, url: `https://itad/${shop}`,
  });
  it("les moins chères d'abord, une seule offre par boutique", () => {
    const offers = toOffers([deal("Steam", 30), deal("GOG", 15, 50), deal("Steam", 20, 33), deal("Fanatical", 18, 40)]);
    expect(offers.map((o) => [o.shop, o.price])).toEqual([["GOG", 15], ["Fanatical", 18], ["Steam", 20]]);
    expect(offers[0]).toMatchObject({ cut: 50, regular: 30, currency: "EUR", url: "https://itad/GOG" });
  });
});
