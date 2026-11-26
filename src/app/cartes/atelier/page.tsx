"use client";

import Link from "next/link";
import { RarityGlyph } from "@/components/RarityGlyph";
import { useEffect, useMemo, useState } from "react";
import { CardTabs } from "@/components/CardTabs";
import { useCardViewer } from "@/components/CardViewer";
import { TradingCard } from "@/components/TradingCard";
import { RARITIES, rarityInfo, withPoolArt, type Card, type Rarity } from "@/lib/cards";
import { coins, copies } from "@/lib/data";
import { runCardAction } from "@/lib/cardClient";
import type { CardAction, CardActionResult } from "@/lib/cardRules";
import { cloudEnabled, useCloud } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import {
  BOOSTER_PRICE,
  CRAFT_PRICE,
  FINISHES,
  RECYCLE_VALUE,
  TRADE_UP_COUNT,
  nextFinish,
  nextRarity,
  recyclePreview,
  tradeUpAvailable,
} from "@/lib/workshop";

const KEEP_OPTIONS = [
  { keep: 1, label: "1 exemplaire", hint: "Tous les doublons sont recyclés." },
  { keep: 2, label: "2 exemplaires", hint: "Un doublon de chaque carte est mis de côté." },
  { keep: 5, label: "5 (Argent)", hint: "Garde de quoi passer chaque carte en Argent." },
];

const n = (x: number) => x.toLocaleString("fr-FR");
const plural = (x: number, word: string) => `${n(x)} ${word}${x > 1 ? "s" : ""}`;

export default function WorkshopPage() {
  const [{ collection }, ready] = useStore();
  const [pool, setPool] = useState<Card[] | null>(null);
  const [keep, setKeep] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [gift, setGift] = useState<Card | null>(null);
  const [query, setQuery] = useState("");
  const [craftRarity, setCraftRarity] = useState<Rarity | null>(null);
  const viewer = useCardViewer();

  useEffect(() => {
    fetch("/api/cartes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { cards: Card[] }) => setPool(d.cards))
      .catch(() => setPool([]));
  }, []);

  const wallet = coins(collection);
  const preview = recyclePreview(collection, keep);
  const poolById = pool ? new Map(pool.map((c) => [c.id, c])) : null;
  // les cartes déjà possédées prennent l'image actuelle (jaquette verticale quand elle existe)
  const owned = Object.values(collection.cards).map((o) => ({ ...o, card: withPoolArt(o.card, poolById) }));

  const missing = useMemo(() => {
    if (!pool) return [];
    const q = query.trim().toLowerCase();
    if (q.length < 2 && !craftRarity) return [];
    return pool.filter(
      (c) =>
        !collection.cards[c.id] &&
        (!craftRarity || c.rarity === craftRarity) &&
        (q.length < 2 || c.name.toLowerCase().includes(q)),
    );
  }, [pool, query, craftRarity, collection.cards]);

  const upgradable = owned
    .map((o) => ({ o, f: nextFinish(o) }))
    .filter(({ o, f }) => f && copies(o) >= f.need)
    .sort((a, b) => copies(b.o) - copies(a.o));

  const done = (text: string) => {
    setMessage(text);
    setConfirming(false);
  };

  const cloud = useCloud();
  const [busy, setBusy] = useState(false);
  /** Envoie l'action (au serveur quand les comptes sont activés) et affiche le résultat ou l'erreur. */
  const act = async (action: CardAction, success: (r: CardActionResult) => string) => {
    if (busy) return;
    setBusy(true);
    const res = await runCardAction(action, pool ?? []);
    setBusy(false);
    if ("error" in res) done(res.error);
    else done(success(res));
  };

  if (!ready) return <h1>Atelier</h1>;
  if (cloudEnabled && cloud.status === "signedOut") {
    return (
      <>
        <h1>Atelier</h1>
        <CardTabs active="atelier" />
        <p className="notice">
          <Link href="/connexion">Connecte-toi</Link> pour utiliser l&apos;atelier : ta collection est gardée sur ton compte.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">Cartes · doublons</p>
      <h1>Atelier</h1>
      <CardTabs active="atelier" />
      <p className="muted">
        Tes doublons ne dorment plus : recycle-les en pièces, fabrique les cartes qui te manquent, échange-les contre une
        rareté supérieure ou fais briller tes cartes préférées. Ton dernier exemplaire d&apos;une carte n&apos;est jamais
        utilisé. <Link href="/cartes/album">Voir mon album</Link>
      </p>

      <div className="wallet">
        <span className="coin" aria-hidden="true" />
        <strong className="mono">{n(wallet)}</strong> pièce{wallet > 1 ? "s" : ""}
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {/* ---------- Recycler ---------- */}
      <section className="panel">
        <h2>Recycler mes doublons</h2>
        <p className="muted">Chaque doublon rapporte des pièces selon sa rareté.</p>
        <div className="sorts" role="group" aria-label="Exemplaires à garder">
          <span className="muted">Garder :</span>
          {KEEP_OPTIONS.map((k) => (
            <button
              key={k.keep}
              type="button"
              className={keep === k.keep ? "chip active" : "chip"}
              aria-pressed={keep === k.keep}
              onClick={() => {
                setKeep(k.keep);
                setConfirming(false);
              }}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="muted small">{KEEP_OPTIONS.find((k) => k.keep === keep)?.hint}</p>
        <table className="workshop-table">
          <thead>
            <tr>
              <th>Rareté</th>
              <th className="num">Par doublon</th>
              <th className="num">Doublons</th>
              <th className="num">Pièces</th>
            </tr>
          </thead>
          <tbody>
            {[...preview.byRarity].reverse().map((r) => (
              <tr key={r.id}>
                <td>
                  <RarityGlyph rarity={r.id} /> {r.label}
                </td>
                <td className="num mono">+{n(RECYCLE_VALUE[r.id])}</td>
                <td className="num mono">{n(r.cards)}</td>
                <td className="num mono strong">{r.coins ? `+${n(r.coins)}` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.cards === 0 ? (
          <p className="muted">Aucun doublon à recycler.</p>
        ) : confirming ? (
          <div className="row-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() =>
                act({ type: "recycleAll", keep }, (r) =>
                  `Recyclage terminé : ${plural(r.cards ?? 0, "carte")} → +${plural(r.coins ?? 0, "pièce")}.`,
                )
              }
            >
              Confirmer : {plural(preview.cards, "carte")} → +{n(preview.coins)}
            </button>
            <button type="button" className="button ghost" onClick={() => setConfirming(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" className="button" onClick={() => setConfirming(true)}>
            Recycler {plural(preview.cards, "doublon")} · +{n(preview.coins)}
          </button>
        )}
      </section>

      {/* ---------- Échange de rareté ---------- */}
      <section className="panel">
        <h2>Monter en rareté</h2>
        <p className="muted">
          Donne {TRADE_UP_COUNT} doublons d&apos;une rareté pour une carte au hasard de la rareté au-dessus. Les cartes que
          tu as en plus grand nombre partent en premier.
        </p>
        <div className="trade-list">
          {RARITIES.filter((r) => nextRarity(r.id)).map((r) => {
            const have = tradeUpAvailable(collection, r.id);
            const to = rarityInfo(nextRarity(r.id)!);
            return (
              <div key={r.id} className="trade-row">
                <span>
                  <RarityGlyph rarity={r.id} /> {TRADE_UP_COUNT} {r.label} →{" "}
                  <RarityGlyph rarity={to.id} /> 1 {to.label}
                </span>
                <span className="muted mono">
                  {n(have)} / {TRADE_UP_COUNT}
                </span>
                <button
                  type="button"
                  className="button ghost"
                  disabled={!pool || busy || have < TRADE_UP_COUNT}
                  onClick={() =>
                    act({ type: "tradeUp", rarity: r.id }, (res) => {
                      setGift(res.card ?? null);
                      if (res.card) viewer.open({ card: res.card, title: "Échange réussi ! Tu gagnes :", reveal: true });
                      return `Échange réussi : tu obtiens ${res.card?.name} (${to.label}) !`;
                    })
                  }
                >
                  Échanger
                </button>
              </div>
            );
          })}
        </div>
        {gift && (
          <div className="gift">
            <TradingCard
              key={gift.id + "-" + collection.cards[gift.id]?.count}
              card={gift}
              badge={collection.cards[gift.id]?.count === 1 ? "new" : "dup"}
              onOpen={() => viewer.open({ card: gift })}
            />
          </div>
        )}
      </section>

      {/* ---------- Fabriquer ---------- */}
      <section className="panel">
        <h2>Fabriquer une carte</h2>
        <p className="muted">Choisis une carte qui te manque et fabrique-la avec tes pièces.</p>
        <div className="sorts">
          {[...RARITIES].reverse().map((r) => (
            <button
              key={r.id}
              type="button"
              className={craftRarity === r.id ? "chip active" : "chip"}
              aria-pressed={craftRarity === r.id}
              onClick={() => setCraftRarity(craftRarity === r.id ? null : r.id)}
            >
              <RarityGlyph rarity={r.id} />
              {r.label} · <span className="mono">{n(CRAFT_PRICE[r.id])}</span>
            </button>
          ))}
        </div>
        <input
          className="search-input"
          type="search"
          placeholder="Nom du jeu…"
          aria-label="Rechercher une carte à fabriquer"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!pool ? (
          <p className="muted">Chargement des cartes…</p>
        ) : query.trim().length < 2 && !craftRarity ? (
          <p className="muted small">Tape au moins 2 lettres ou choisis une rareté pour voir les cartes qui te manquent.</p>
        ) : missing.length === 0 ? (
          <p className="muted">Aucune carte manquante ne correspond.</p>
        ) : (
          <ul className="craft-list">
            {missing.slice(0, 30).map((c) => {
              const price = CRAFT_PRICE[c.rarity];
              const r = rarityInfo(c.rarity);
              return (
                <li key={c.id}>
                  <RarityGlyph rarity={r.id} />
                  <span className="craft-name">{c.name}</span>
                  <span className="muted small">{r.label}</span>
                  <button
                    type="button"
                    className="button ghost"
                    disabled={busy || wallet < price}
                    onClick={() =>
                      act({ type: "craft", id: c.id }, () => {
                        viewer.open({ card: c, title: "Carte fabriquée !", reveal: true });
                        return `${c.name} a rejoint ton album !`;
                      })
                    }
                  >
                    Fabriquer · <span className="mono">{n(price)}</span>
                  </button>
                </li>
              );
            })}
            {missing.length > 30 && <li className="muted small">… et {missing.length - 30} autres : affine ta recherche.</li>}
          </ul>
        )}
      </section>

      {/* ---------- Acheter un booster ---------- */}
      <section className="panel">
        <h2>Acheter un booster</h2>
        <p className="muted">
          Échange tes pièces contre un booster de plus. Il s&apos;ajoute à tes boosters à ouvrir, même si ta réserve est pleine.
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="button"
            disabled={busy || wallet < BOOSTER_PRICE}
            onClick={() => act({ type: "buyBooster" }, () => "Booster acheté ! Il t'attend dans l'onglet Boosters.")}
          >
            Acheter un booster · <span className="mono">{n(BOOSTER_PRICE)}</span> pièces
          </button>
          <Link href="/cartes" className="button ghost">Ouvrir mes boosters</Link>
        </div>
        {wallet < BOOSTER_PRICE && (
          <p className="muted small">Encore {n(BOOSTER_PRICE - wallet)} pièces : recycle des doublons ou termine des quêtes.</p>
        )}
      </section>

      {/* ---------- Finitions ---------- */}
      <section className="panel">
        <h2>Finitions argent et or</h2>
        <p className="muted">
          Avec {FINISHES[0].need} exemplaires d&apos;une carte, passe-la en <strong className="silver">Argent</strong> (
          {FINISHES[0].cost} doublons utilisés). Avec {FINISHES[1].cost} doublons de plus, passe-la en{" "}
          <strong className="gold-text">Or</strong>, soit {FINISHES[0].need + FINISHES[1].cost} exemplaires au total.
        </p>
        {upgradable.length === 0 ? (
          <p className="muted">Aucune carte n&apos;a encore assez d&apos;exemplaires.</p>
        ) : (
          <div className="card-grid">
            {upgradable.map(({ o, f }) => (
              <div key={o.card.id} className="upgrade-item">
                <TradingCard
                  card={o.card}
                  count={copies(o)}
                  finish={o.finish}
                  onOpen={() => viewer.open({ card: o.card, count: copies(o), finish: o.finish })}
                />
                <button
                  type="button"
                  className="button ghost"
                  disabled={busy}
                  onClick={() => act({ type: "upgrade", id: o.card.id }, () => `${o.card.name} passe en ${f!.label} !`)}
                >
                  Passer en {f!.label} ({f!.cost} doublons)
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      {viewer.element}
    </>
  );
}
