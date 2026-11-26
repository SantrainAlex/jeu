import { describe, expect, it } from "vitest";
import type { Card, Rarity } from "./cards";
import { EMPTY_COLLECTION, type Collection, type OwnedCard } from "./data";
import { collectionScore, usernameError } from "./score";

const card = (id: number, rarity: Rarity): Card => ({ id, name: `Jeu ${id}`, image: null, rarity, released: null });
const owned = (id: number, rarity: Rarity, extra: Partial<OwnedCard> = {}): OwnedCard => ({
  card: card(id, rarity),
  count: 1,
  firstAt: "2026-11-26T00:00:00Z",
  ...extra,
});
const coll = (list: OwnedCard[], vitraux = 0): Collection => ({
  ...EMPTY_COLLECTION,
  cards: Object.fromEntries(list.map((o) => [o.card.id, o])),
  vitraux: Array.from({ length: vitraux }, (_, i) => ({ card: card(900 + i, "epique"), number: i + 1, at: "" })),
});

describe("points de collection", () => {
  it("vaut 0 pour une collection vide", () => {
    expect(collectionScore(EMPTY_COLLECTION)).toBe(0);
  });

  it("compte chaque carte différente selon sa rareté", () => {
    const c = coll([owned(1, "commune"), owned(2, "rare"), owned(3, "epique"), owned(4, "legendaire"), owned(5, "mythique")]);
    expect(collectionScore(c)).toBe(1 + 3 + 10 + 25 + 100);
  });

  it("ne compte pas les doublons", () => {
    expect(collectionScore(coll([owned(1, "rare", { count: 7 })]))).toBe(3);
  });

  it("double en argent, triple en or", () => {
    expect(collectionScore(coll([owned(1, "epique", { count: 9, used: 4, finish: "argent" })]))).toBe(20);
    expect(collectionScore(coll([owned(1, "epique", { count: 15, used: 9, finish: "or" })]))).toBe(30);
  });

  it("ignore une carte dont il ne reste aucun exemplaire", () => {
    expect(collectionScore(coll([owned(1, "mythique", { count: 2, used: 2 })]))).toBe(0);
  });

  it("ajoute 150 points par vitrail", () => {
    expect(collectionScore(coll([owned(1, "commune")], 2))).toBe(301);
  });
});

describe("nom d'utilisateur", () => {
  it("accepte les noms simples", () => {
    for (const n of ["alex", "Zoé_42", "le.joueur", "Mega-Fan"]) expect(usernameError(n)).toBeNull();
  });
  it("refuse les noms trop courts, trop longs ou avec des espaces", () => {
    expect(usernameError("ab")).toMatch(/au moins 3/);
    expect(usernameError("a".repeat(21))).toMatch(/20 caractères/);
    expect(usernameError("mon nom")).toMatch(/pas d'espace/);
    expect(usernameError("<script>")).not.toBeNull();
  });
});
