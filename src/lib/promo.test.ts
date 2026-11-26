import { describe, expect, it } from "vitest";
import { EMPTY_COLLECTION, coins } from "./data";
import { normalizeCode, redeemCode } from "./promo";

const base = { ...EMPTY_COLLECTION, extraPacks: 0 };

describe("codes promo", () => {
  it("ne tient pas compte des majuscules, accents et espaces", () => {
    expect(normalizeCode("Bienvenue")).toBe("BIENVENUE");
    expect(normalizeCode("  bien venüe ")).toBe("BIENVENUE");
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });

  it("« Bienvenue » donne 1 booster et 100 pièces", () => {
    const r = redeemCode(base, "bienvenue");
    if ("error" in r) throw new Error(r.error);
    expect(r.reward).toEqual({ packs: 1, coins: 100 });
    expect(r.collection.extraPacks).toBe(1);
    expect(coins(r.collection)).toBe(100);
    expect(r.collection.promoCodes).toEqual(["BIENVENUE"]);
  });

  it("une seule fois par compte", () => {
    const r = redeemCode(base, "Bienvenue");
    if ("error" in r) throw new Error(r.error);
    expect(redeemCode(r.collection, "BIENVENUE")).toEqual({ error: "Tu as déjà utilisé ce code." });
  });

  it("refuse un code inconnu, désactivé ou expiré", () => {
    expect("error" in redeemCode(base, "FAUXCODE")).toBe(true);
    expect("error" in redeemCode(base, "bienvenue", [{ code: "Bienvenue", reward: { coins: 5 }, active: false }])).toBe(true);
    const now = Date.parse("2026-12-01T00:00:00Z");
    const noel = [{ code: "NOEL", reward: { packs: 3 }, expiresAt: "2026-11-30T23:00:00Z" }];
    expect(redeemCode(base, "noel", noel, now)).toEqual({ error: "Ce code n'est plus valable." });
  });

  it("utilise les codes ajoutés dans la table", () => {
    const r = redeemCode(base, "noel", [{ code: "NOEL", reward: { packs: 3 } }]);
    if ("error" in r) throw new Error(r.error);
    expect(r.collection.extraPacks).toBe(3);
    expect(coins(r.collection)).toBe(0);
  });
});
