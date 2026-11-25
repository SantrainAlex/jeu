"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TradingCard } from "@/components/TradingCard";
import { RARITIES, type Card, type Rarity } from "@/lib/cards";
import { useStore } from "@/lib/store";

export default function AlbumPage() {
  const [{ collection }, ready] = useStore();
  const [pool, setPool] = useState<Card[] | null>(null);
  const [filter, setFilter] = useState<Rarity | "tout">("tout");

  useEffect(() => {
    fetch("/api/cartes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { cards: Card[] }) => setPool(d.cards))
      .catch(() => setPool([]));
  }, []);

  const owned = useMemo(() => Object.values(collection.cards), [collection.cards]);
  const byRarity = (r: Rarity) => ({
    owned: owned.filter((o) => o.card.rarity === r).length,
    total: pool?.filter((c) => c.rarity === r).length ?? 0,
  });
  const order = RARITIES.map((r) => r.id).reverse(); // les plus rares d'abord
  const shown = owned
    .filter((o) => filter === "tout" || o.card.rarity === filter)
    .sort((a, b) => order.indexOf(a.card.rarity) - order.indexOf(b.card.rarity) || a.card.name.localeCompare(b.card.name));

  if (!ready) return <h1>Mon album</h1>;

  return (
    <>
      <h1>Mon album</h1>
      <p className="muted">
        {owned.length} carte{owned.length > 1 ? "s" : ""} différente{owned.length > 1 ? "s" : ""}
        {pool?.length ? ` sur ${pool.length}` : ""} · {collection.packsOpened} booster{collection.packsOpened > 1 ? "s" : ""}{" "}
        ouvert{collection.packsOpened > 1 ? "s" : ""} · <Link href="/cartes">Ouvrir un booster</Link>
      </p>

      <div className="sorts">
        <button type="button" className={filter === "tout" ? "chip active" : "chip"} onClick={() => setFilter("tout")}>
          Toutes
        </button>
        {[...RARITIES].reverse().map((r) => {
          const n = byRarity(r.id);
          return (
            <button
              key={r.id}
              type="button"
              className={filter === r.id ? "chip active" : "chip"}
              onClick={() => setFilter(r.id)}
              style={{ "--rarity": r.color } as React.CSSProperties}
            >
              <span className="dot" style={{ background: r.color }} />
              {r.label} {n.owned}
              {pool ? `/${n.total}` : ""}
            </button>
          );
        })}
      </div>

      {collection.vitraux.length > 0 && filter === "tout" && (
        <>
          <h2>Vitraux numérotés</h2>
          <div className="card-grid">
            {collection.vitraux.map((v) => (
              <TradingCard key={v.number} card={v.card} vitrail={v.number} />
            ))}
          </div>
          <h2>Cartes</h2>
        </>
      )}

      {shown.length === 0 ? (
        <p className="muted">
          {owned.length === 0 ? "Ton album est vide pour l'instant. " : "Aucune carte de cette rareté pour l'instant. "}
          <Link href="/cartes">Ouvre un booster</Link> !
        </p>
      ) : (
        <div className="card-grid">
          {shown.map((o) => (
            <TradingCard key={o.card.id} card={o.card} count={o.count} />
          ))}
        </div>
      )}
    </>
  );
}
