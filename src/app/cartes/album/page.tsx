"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CardTabs } from "@/components/CardTabs";
import { useCardViewer } from "@/components/CardViewer";
import { TradingCard } from "@/components/TradingCard";
import { RARITIES, withPoolArt, type Card, type Rarity } from "@/lib/cards";
import { coins, copies } from "@/lib/data";
import { useStore } from "@/lib/store";

type Sort = "rarete" | "doublons" | "nom" | "recent";
const SORTS: { id: Sort; label: string }[] = [
  { id: "rarete", label: "Rareté" },
  { id: "doublons", label: "Doublons d'abord" },
  { id: "recent", label: "Plus récentes" },
  { id: "nom", label: "Nom" },
];

export default function AlbumPage() {
  const [{ collection }, ready] = useStore();
  const [pool, setPool] = useState<Card[] | null>(null);
  const [filter, setFilter] = useState<Rarity | "tout">("tout");
  const [onlyDups, setOnlyDups] = useState(false);
  const [sort, setSort] = useState<Sort>("rarete");
  const viewer = useCardViewer();

  useEffect(() => {
    fetch("/api/cartes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { cards: Card[] }) => setPool(d.cards))
      .catch(() => setPool([]));
  }, []);

  const poolById = useMemo(() => (pool ? new Map(pool.map((c) => [c.id, c])) : null), [pool]);
  // les cartes déjà possédées prennent l'image actuelle (jaquette verticale quand elle existe)
  const owned = useMemo(
    () => Object.values(collection.cards).map((o) => ({ ...o, card: withPoolArt(o.card, poolById) })),
    [collection.cards, poolById],
  );
  const vitraux = collection.vitraux.map((v) => ({ ...v, card: withPoolArt(v.card, poolById) }));
  const byRarity = (r: Rarity) => ({
    owned: owned.filter((o) => o.card.rarity === r).length,
    total: pool?.filter((c) => c.rarity === r).length ?? 0,
  });
  const order = RARITIES.map((r) => r.id).reverse(); // les plus rares d'abord
  const byRarityOrder = (a: (typeof owned)[number], b: (typeof owned)[number]) =>
    order.indexOf(a.card.rarity) - order.indexOf(b.card.rarity);
  const dupCount = owned.reduce((s, o) => s + copies(o) - 1, 0);
  const shown = owned
    .filter((o) => (filter === "tout" || o.card.rarity === filter) && (!onlyDups || copies(o) > 1))
    .sort(
      (a, b) =>
        (sort === "doublons"
          ? copies(b) - copies(a)
          : sort === "recent"
            ? b.firstAt.localeCompare(a.firstAt)
            : sort === "nom"
              ? 0
              : byRarityOrder(a, b)) ||
        byRarityOrder(a, b) ||
        a.card.name.localeCompare(b.card.name),
    );

  if (!ready) return <h1>Mon album</h1>;

  return (
    <>
      <h1>Mon album</h1>
      <CardTabs active="album" />
      <p className="muted">
        {owned.length} carte{owned.length > 1 ? "s" : ""} différente{owned.length > 1 ? "s" : ""}
        {pool?.length ? ` sur ${pool.length}` : ""} · {collection.packsOpened} booster{collection.packsOpened > 1 ? "s" : ""}{" "}
        ouvert{collection.packsOpened > 1 ? "s" : ""} · <Link href="/cartes">Ouvrir un booster</Link>
      </p>
      <p className="muted">
        <span className="mono">{dupCount}</span> doublon{dupCount > 1 ? "s" : ""} ·{" "}
        <span className="mono">{coins(collection)}</span> pièce{coins(collection) > 1 ? "s" : ""} ·{" "}
        <Link href="/cartes/atelier">Aller à l&apos;atelier</Link>
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
        <button
          type="button"
          className={onlyDups ? "chip active" : "chip"}
          onClick={() => setOnlyDups(!onlyDups)}
          aria-pressed={onlyDups}
        >
          Doublons seulement
        </button>
        <label className="sort-select">
          <span className="muted">Trier par</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {collection.vitraux.length > 0 && filter === "tout" && !onlyDups && (
        <>
          <h2>Vitraux numérotés</h2>
          <div className="card-grid">
            {vitraux.map((v) => (
              <TradingCard
                key={v.number}
                card={v.card}
                vitrail={v.number}
                onOpen={() => viewer.open({ card: v.card, vitrail: v.number })}
              />
            ))}
          </div>
          <h2>Cartes</h2>
        </>
      )}

      {shown.length === 0 ? (
        <p className="muted">
          {owned.length === 0
            ? "Ton album est vide pour l'instant. "
            : onlyDups
              ? "Aucun doublon ici pour l'instant. "
              : "Aucune carte de cette rareté pour l'instant. "}
          <Link href="/cartes">Ouvre un booster</Link> !
        </p>
      ) : (
        <div className="card-grid">
          {shown.map((o) => (
            <TradingCard
              key={o.card.id}
              card={o.card}
              count={copies(o)}
              finish={o.finish}
              onOpen={() => viewer.open({ card: o.card, count: copies(o), finish: o.finish })}
            />
          ))}
        </div>
      )}
      {viewer.element}
    </>
  );
}
