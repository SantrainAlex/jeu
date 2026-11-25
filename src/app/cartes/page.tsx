"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardTabs } from "@/components/CardTabs";
import { TradingCard } from "@/components/TradingCard";
import {
  PACK_SIZE,
  RATINGS_PER_BONUS,
  VITRAIL_CHANCE,
  VITRAIL_TOTAL,
  availablePacks,
  oddsTable,
  rarityInfo,
  type Card,
  type PulledCard,
} from "@/lib/cards";
import { cloudEnabled, getVitrailStock, getVitrailsLeft, useCloud } from "@/lib/cloud";
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
  // « tearing » : le pack se déchire avant que les cartes n'apparaissent
  const [tearing, setTearing] = useState(false);
  // éclair de couleur quand une carte rare est retournée (la clé relance l'animation)
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);
  const cloud = useCloud();
  const [onlineLeft, setOnlineLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/cartes")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setPool)
      .catch(() => setError(true));
  }, []);

  // avec les comptes, le stock de vitraux est partagé entre tous les joueurs
  useEffect(() => {
    if (cloudEnabled) getVitrailsLeft().then(setOnlineLeft);
  }, [cloud.status]);

  const ratingsCount = Object.keys(ratings).length;
  const packs = availablePacks(collection, ratingsCount);
  const nextBonusIn = RATINGS_PER_BONUS - (ratingsCount % RATINGS_PER_BONUS);
  const vitrailsLeft = cloudEnabled ? (onlineLeft ?? VITRAIL_TOTAL) : Math.max(0, VITRAIL_TOTAL - collection.vitrailsGiven);
  const signedOutWithAccounts = cloudEnabled && cloud.status !== "signedIn";

  const open = async () => {
    if (!pool) return;
    // connecté : stock en ligne partagé ; comptes activés mais pas connecté : pas de vitrail possible
    const stock = cloudEnabled
      ? ((await getVitrailStock()) ?? { left: 0, claim: async () => null })
      : undefined;
    const cards = await openBooster(pool.cards, stock);
    if (cards) {
      setPulled(null);
      setTearing(true);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => {
        setTearing(false);
        setPulled(cards);
        setRevealed(0);
      }, reduced ? 0 : 950);
      if (cards.some((c) => c.vitrail)) getVitrailsLeft().then(setOnlineLeft);
    }
  };

  const reveal = (count: number) => {
    if (!pulled) return;
    // la carte la plus rare parmi celles qu'on vient de retourner décide de la couleur de l'éclair
    const newly = pulled.slice(revealed, count);
    const best = newly.find((c) => c.vitrail) ?? [...newly].reverse().find((c) => !["commune", "rare"].includes(c.rarity));
    if (best) setFlash({ color: best.vitrail ? "#f5c84b" : rarityInfo(best.rarity).color, key: Date.now() });
    setRevealed(count);
  };

  const allRevealed = pulled !== null && revealed >= PACK_SIZE;

  return (
    <>
      <h1>Cartes à collectionner</h1>
      <CardTabs active="boosters" />
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
        {flash && (
          <div
            key={flash.key}
            className="rarity-flash"
            style={{ "--flash": flash.color } as React.CSSProperties}
            onAnimationEnd={() => setFlash(null)}
            aria-hidden="true"
          />
        )}
        {tearing ? (
          <div className="booster-stage" aria-live="polite">
            <div className="booster tearing" aria-hidden="true">
              <span className="booster-top" />
              <span className="booster-label">BOOSTER</span>
              <small>{PACK_SIZE} cartes</small>
            </div>
            <span className="sr-only">Ouverture du booster…</span>
          </div>
        ) : pulled ? (
          <>
            <div className="pack-cards">
              {pulled.map((c, i) => (
                <TradingCard
                  key={i}
                  card={c}
                  vitrail={c.vitrail}
                  badge={i < revealed ? (c.isNew ? "new" : "dup") : undefined}
                  hidden={i >= revealed}
                  onReveal={() => i === revealed && reveal(revealed + 1)}
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
            <div className="booster-actions">
              {!allRevealed ? (
                <>
                  <span className="muted">Clique sur la carte suivante pour la retourner</span>
                  <button type="button" className="button ghost" onClick={() => reveal(PACK_SIZE)}>
                    Tout retourner
                  </button>
                </>
              ) : (
                <>
                  {packs.total > 0 ? (
                    <button type="button" className="button big" onClick={open}>
                      Ouvrir un autre booster ({packs.total})
                    </button>
                  ) : (
                    <Link href="/cartes/album" className="button big">Voir mon album →</Link>
                  )}
                  <PackSummary cards={pulled} />
                </>
              )}
            </div>
          </>
        ) : (
          <div className="booster-closed">
            <div className={packs.total > 0 && pool ? "booster ready" : "booster"} aria-hidden="true">
              <span className="booster-top" />
              <span className="booster-label">BOOSTER</span>
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
            ♻️ Tes doublons servent à l&apos;<Link href="/cartes/atelier">atelier</Link> : recycle-les en pièces, fabrique
            les cartes qui te manquent ou passe-les en argent et en or
          </li>
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
          d&apos;une carte, tant qu&apos;il en reste ({vitrailsLeft.toLocaleString("fr-FR")} exemplaires encore à distribuer
          {cloudEnabled ? " entre tous les joueurs" : ""}).
          {signedOutWithAccounts && (
            <>
              {" "}
              <Link href="/connexion">Connecte-toi</Link> pour pouvoir en gagner un.
            </>
          )}
        </p>
      </section>
    </>
  );
}

function PackSummary({ cards }: { cards: PulledCard[] }) {
  const fresh = cards.filter((c) => c.isNew).length;
  const dups = cards.length - fresh;
  return (
    <span className="muted pack-summary">
      {fresh} nouvelle{fresh > 1 ? "s" : ""} · {dups} doublon{dups > 1 ? "s" : ""}
      {dups > 0 && (
        <>
          {" "}
          · <Link href="/cartes/atelier">Aller à l&apos;atelier</Link>
        </>
      )}
    </span>
  );
}
