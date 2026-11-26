import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/lib/cards";
import { EMPTY_COLLECTION, type Collection } from "@/lib/data";

// Une fausse base en mémoire à la place de Supabase, pour vérifier les règles du serveur.
const db = vi.hoisted(() => ({
  row: { collection: {} as unknown, version: 0 },
  ratings: 0,
  user: "u1" as string | null,
  /** simule une autre demande qui modifie la collection juste avant l'enregistrement */
  racing: 0,
}));

vi.mock("@/lib/cardPool", () => ({
  getCardPool: async () => ({
    demo: false,
    cards: [1, 2, 3, 4, 5, 6].map((id): Card => ({ id, name: `Jeu ${id}`, image: null, released: null, rarity: id > 5 ? "mythique" : "commune" })),
  }),
}));

vi.mock("@/lib/server/cardsServer", () => ({
  adminClient: () => ({}),
  userFromRequest: async () => db.user,
  loadCards: async () => structuredClone(db.row),
  ratingsCount: async () => db.ratings,
  vitrailsLeft: async () => 0,
  claimVitrail: async () => null,
  saveCards: async (_sb: unknown, _u: string, row: { version: number }, next: Collection) => {
    if (db.racing > 0) {
      db.racing--;
      db.row = { collection: { ...(db.row.collection as Collection), stock: 0, stockAt: new Date().toISOString() }, version: db.row.version + 1 };
    }
    if (row.version !== db.row.version) return false;
    db.row = { collection: next, version: row.version + 1 };
    return true;
  },
}));

const { POST } = await import("./route");
const call = (body: unknown) => POST(new Request("http://x/api/cartes/action", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  db.row = { collection: EMPTY_COLLECTION, version: 0 };
  db.ratings = 0;
  db.user = "u1";
  db.racing = 0;
});

describe("POST /api/cartes/action", () => {
  it("refuse sans connexion", async () => {
    db.user = null;
    expect((await call({ type: "booster" })).status).toBe(401);
  });

  it("ouvre au plus 5 boosters, puis refuse", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await call({ type: "booster" });
      expect(res.status).toBe(200);
      expect((await res.json()).pulled).toHaveLength(5);
    }
    expect((await call({ type: "booster" })).status).toBe(409);
    expect((db.row.collection as Collection).packsOpened).toBe(5);
  });

  it("ignore les cartes envoyées par le navigateur", async () => {
    const res = await call({ type: "booster", pulled: [{ id: 6, rarity: "mythique" }] });
    const body = await res.json();
    expect(body.pulled).toHaveLength(5);
  });

  it("deux demandes en même temps ne donnent pas deux boosters de trop", async () => {
    // la réserve tombe à 0 pendant la demande : le serveur revérifie et refuse
    db.racing = 1;
    expect((await call({ type: "booster" })).status).toBe(409);
  });

  it("refuse une fabrication sans assez de pièces", async () => {
    expect((await call({ type: "craft", id: 6 })).status).toBe(409);
  });
});
