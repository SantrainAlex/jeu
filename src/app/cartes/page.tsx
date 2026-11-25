"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TradingCard } from "@/components/TradingCard";
import {
  PACK_SIZE,
  RATINGS_PER_BONUS,
  VITRAIL_CHANCE,
  VITRAIL_TOTAL,
  availablePacks,
  oddsTable,
  type Card,
  type PulledCard,
} from "@/lib/cards";
import { openBooster, useStore } from "@/lib/store";

const pct = (x: number) =>
  x > 0.999
    ? "> 99,9 %"
    : `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: x < 0.01 ? 2 : x < 0.1 ? 1 : 0 })} %`;

export default function CardsPage() {
  const [{ collection, ratings }, ready] = useStore();
  const [pool, setPool] = useState<{ cards: Card[]; demo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [pulled, setPulled] = useState<PulledCard[] | null>(null);
  const [revealed, setRevealed] = useState<number>(0);

  useEffect(() => {
    fetch("/api/cartes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setPool)
      .catch(() => setError(true));
  }, []);

  const ratingsCount = Object.keys(ratings).length;
  const packs = availablePacks(collection, ratingsCount);
  const nextBonusIn = RATINGS_PER_BONUS - (ratingsCount % RATINGS_PER_BONUS);
  const vitrailsLeft = Math.max(0, VITRAIL_TOTAL - collection.vitrailsGiven);

  const open = () => {
    if (!pool) return;
    const cards = openBooster(pool.cards);
    if (cards) {
      setPulled(cards);
      setRevealed(0);
    }
  };

  const allRevealed = pulled !== null && revealed >= PACK_SIZE;

  return (
    <>
      <h1>Cartes à collectionner</h1>
      <p className="muted">
        Ouvre des boosters de {PACK_SIZE} cartes et complète ton <Link href="/cartes/album">album</Link>. Chaque carte est
        un jeu vidéo : plus il est populaire, plus elle est rare.
      </p>

      {pool?.demo && (
        <p className="notice">
          Ce sont des cartes d&apos;exemple. Ajoute ta clé RAWG et/ou IGDB dans <code>.env.local</code> pour avoir les
          vrais jeux.
        </p>
      )}
      {error && <p className="notice">Impossible de charger les cartes pour le moment, réessaie dans un instant.</p>}

      <section className="booster-zone">
        {pulled ? (
          <>
            <div className="pack-cards">
              {pulled.map((c, i) => (
                <TradingCard
                  key={i}
                  card={c}
                  vitrail={c.vitrail}
                  hidden={i >= revealed}
                  onReveal={() => i === revealed && setRevealed(revealed + 1)}
                />
              ))}
            </div>
            <div className="booster-actions">
              {!allRevealed ? (
                <>
                  <span className="muted">Clique sur la carte suivante pour la retourner</span>
                  <button type="button" className="button ghost" onClick={() => setRevealed(PACK_SIZE)}>
                    Tout retourner
                  </button>
                </>
              ) : packs.total > 0 ? (
                <button type="button" className="button big" onClick={open}>
                  Ouvrir un autre booster ({packs.total})
                </button>
              ) : (
                <Link href="/cartes/album" className="button big">Voir mon album →</Link>
              )}
            </div>
          </>
        ) : (
          <div className="booster-closed">
            <div className={packs.total > 0 && pool ? "booster ready" : "booster"} aria-hidden="true">
              <span>BOOSTER</span>
              <small>{PACK_SIZE} cartes</small>
            </div>
            <div>
              <p className="booster-count">
                {!ready ? "…" : packs.total > 0 ? `${packs.total} booster${packs.total > 1 ? "s" : ""} à ouvrir` : "Plus de booster pour aujourd'hui"}
              </p>
              <button type="button" className="button big" disabled={!ready || !pool || packs.total === 0} onClick={open}>
                {pool || error ? "Ouvrir un booster" : "Préparation des cartes…"}
              </button>
            </div>
          </div>
        )}

        <ul className="booster-rules">
          <li>🎁 1 booster gratuit chaque jour ({packs.free ? "disponible" : "reviens demain"})</li>
          <li>
            ⭐ +1 booster tous les {RATINGS_PER_BONUS} jeux notés : encore {nextBonusIn} note{nextBonusIn > 1 ? "s" : ""} pour le
            prochain
          </li>
        </ul>
      </section>

      <section className="odds">
        <h2>Chances par pack</h2>
        <p className="muted">Probabilité qu&apos;un pack de {PACK_SIZE} cartes contienne au moins une carte de chaque rareté.</p>
        <table>
          <thead>
            <tr>
              <th>Rareté</th>
              <th className="num">Par carte</th>
              <th className="num">Par pack</th>
              <th className="num">Soit environ</th>
            </tr>
          </thead>
          <tbody>
            {oddsTable().map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="dot" style={{ background: r.color }} /> <strong>{r.label}</strong>
                </td>
                <td className="num mono">{(r.chance * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</td>
                <td className="num mono strong">{pct(r.pack)}</td>
                <td className="num muted">
                  {r.onePackIn === null ? "presque tous les packs" : `1 pack sur ${r.onePackIn.toLocaleString("fr-FR")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="vitrail-note">
          <strong>Vitraux numérotés</strong> : environ 1 pack sur {Math.round(1 / VITRAIL_CHANCE)} en contient un, à la place
          d&apos;une carte, tant qu&apos;il en reste ({vitrailsLeft.toLocaleString("fr-FR")} exemplaires encore à distribuer).
        </p>
      </section>
    </>
  );
}
