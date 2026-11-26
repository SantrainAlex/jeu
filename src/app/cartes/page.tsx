"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardTabs } from "@/components/CardTabs";
import { useCardViewer } from "@/components/CardViewer";
import { TradingCard } from "@/components/TradingCard";
import {
  MAX_STOCK,
  PACK_SIZE,
  RECHARGE_MS,
  VITRAIL_CHANCE,
  VITRAIL_TOTAL,
  availablePacks,
  oddsTable,
  rarityInfo,
  type Card,
  type PulledCard,
} from "@/lib/cards";
import { runCardAction } from "@/lib/cardClient";
import { cloudEnabled, getVitrailsLeft, useCloud } from "@/lib/cloud";
import {
  PERIODS,
  msUntilPeriodEnd,
  periodInfo,
  questBoard,
  ratedCounts,
  rewardLabel,
  withLegacyBonus,
  type Period,
  type QuestId,
  type QuestView,
} from "@/lib/quests";
import { useStore } from "@/lib/store";

const pct = (x: number) =>
  x > 0.999
    ? "> 99,9 %"
    : `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: x < 0.01 ? 2 : x < 0.1 ? 1 : 0 })} %`;

export default function CardsPage() {
  const [{ collection, ratings }, ready] = useStore();
  const [pool, setPool] = useState<{ cards: Card[]; demo: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [pulled, setPulled] = useState<PulledCard[] | null>(null);
  // cartes déjà retournées (on peut les retourner dans n'importe quel ordre)
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const viewer = useCardViewer();
  // « tearing » : le pack se déchire avant que les cartes n'apparaissent
  const [tearing, setTearing] = useState(false);
  // éclair de couleur quand une carte rare est retournée (la clé relance l'animation)
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);
  const cloud = useCloud();
  const [onlineLeft, setOnlineLeft] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // ouverture de plusieurs boosters : où on en est (ex. 3 sur 10) et combien ont été ouverts
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [opened, setOpened] = useState(1);

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

  // l'horloge avance chaque seconde pour le compte à rebours de la recharge
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ratingsCount = Object.keys(ratings).length;
  const packs = availablePacks(withLegacyBonus(collection, ratingsCount), now);
  const rated = ratedCounts(ratings, now);
  const boards = Object.fromEntries(PERIODS.map((p) => [p.id, questBoard(collection, rated[p.id], now, p.id)])) as Record<
    Period,
    QuestView[]
  >;
  const [claiming, setClaiming] = useState<QuestId | null>(null);
  const [questMsg, setQuestMsg] = useState<string | null>(null);
  const vitrailsLeft = cloudEnabled ? (onlineLeft ?? VITRAIL_TOTAL) : Math.max(0, VITRAIL_TOTAL - collection.vitrailsGiven);
  const signedOutWithAccounts = cloudEnabled && cloud.status !== "signedIn";
  const canOpen = ready && Boolean(pool) && packs.total > 0 && !signedOutWithAccounts && !busy;

  /** Ouvre `count` boosters à la suite : chacun est vérifié par le serveur et compte pour les quêtes. */
  const open = async (count = 1) => {
    if (!pool || busy) return;
    setActionError(null);
    setBusy(true);
    const all: PulledCard[] = [];
    let done = 0;
    for (let n = 0; n < count; n++) {
      if (count > 1) setProgress({ done: n, total: count });
      // avec les comptes, c'est le serveur qui vérifie la réserve et tire les cartes
      const res = await runCardAction({ type: "booster" }, pool.cards);
      if ("error" in res) {
        // on garde les boosters déjà ouverts ; on ne prévient que si rien n'a pu être ouvert
        if (done === 0) setActionError(res.error);
        break;
      }
      if ("pulled" in res && res.pulled) {
        all.push(...res.pulled);
        done++;
      }
      if ("vitrailsLeft" in res && typeof res.vitrailsLeft === "number") setOnlineLeft(res.vitrailsLeft);
    }
    setBusy(false);
    setProgress(null);
    const cards = all.length ? all : undefined;
    if (cards) {
      setOpened(done);
      setPulled(null);
      setTearing(true);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => {
        setTearing(false);
        setPulled(cards);
        setRevealed(new Set());
      }, reduced ? 0 : 950);
    }
  };

  // choix « ouvrir plusieurs » : 5, 10, 15 si tu en as assez, sinon « tout ouvrir »
  const multi = [5, 10, 15].filter((n) => n <= packs.total);
  if (packs.total > 1 && packs.total < 15 && !multi.includes(packs.total)) multi.push(packs.total);
  const multiButtons = multi.map((n) => (
    <button key={n} type="button" className="button ghost" disabled={!canOpen} onClick={() => open(n)}>
      {n === packs.total && n !== 5 && n !== 10 && n !== 15 ? `Tout ouvrir (${n})` : `Ouvrir ${n}`}
    </button>
  ));

  const claim = async (period: Period, id: QuestId) => {
    if (!pool || claiming) return;
    setQuestMsg(null);
    setClaiming(id);
    // avec les comptes, c'est le serveur qui vérifie que la quête est finie et donne la récompense
    const res = await runCardAction({ type: "claimQuest", id, period }, pool.cards);
    setClaiming(null);
    if ("error" in res) setQuestMsg(res.error);
    else if (res.reward) setQuestMsg(`🎉 Récompense reçue : ${rewardLabel(res.reward)} !`);
  };

  const reveal = (indices: number[]) => {
    if (!pulled) return;
    const fresh = indices.filter((i) => !revealed.has(i));
    if (fresh.length === 0) return;
    // la carte la plus rare parmi celles qu'on vient de retourner décide de la couleur de l'éclair
    const newly = fresh.map((i) => pulled[i]);
    const best = newly.find((c) => c.vitrail) ?? [...newly].reverse().find((c) => !["commune", "rare"].includes(c.rarity));
    if (best) setFlash({ color: best.vitrail ? "#f5c84b" : rarityInfo(best.rarity).color, key: Date.now() });
    setRevealed(new Set([...revealed, ...fresh]));
  };

  const allRevealed = pulled !== null && revealed.size >= pulled.length;

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
      {actionError && <p className="notice">{actionError}</p>}

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
                  badge={revealed.has(i) ? (c.isNew ? "new" : "dup") : undefined}
                  hidden={!revealed.has(i)}
                  onReveal={() => reveal([i])}
                  onOpen={() => viewer.open({ card: c, vitrail: c.vitrail })}
                  style={{ animationDelay: `${Math.min(i, 12) * 90}ms` }}
                />
              ))}
            </div>
            {viewer.element}
            <div className="booster-actions">
              {!allRevealed ? (
                <>
                  <span className="muted">Clique sur une carte pour la retourner</span>
                  <button type="button" className="button ghost" onClick={() => reveal(pulled.map((_, i) => i))}>
                    Tout retourner
                  </button>
                </>
              ) : (
                <>
                  {packs.total > 0 ? (
                    <>
                      <button type="button" className="button big" disabled={!canOpen} onClick={() => open()}>
                        {progress ? `Ouverture ${progress.done + 1} sur ${progress.total}…` : `Ouvrir un autre booster (${packs.total})`}
                      </button>
                      {multiButtons.length > 0 && <div className="booster-multi">{multiButtons}</div>}
                    </>
                  ) : (
                    <Link href="/cartes/album" className="button big">Voir mon album →</Link>
                  )}
                  <PackSummary cards={pulled} packs={opened} />
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
                {!ready ? "…" : packs.total > 0 ? `${packs.total} booster${packs.total > 1 ? "s" : ""} à ouvrir` : "Plus de booster pour l'instant"}
              </p>
              <button type="button" className="button big" disabled={!canOpen} onClick={() => open()}>
                {progress
                  ? `Ouverture ${progress.done + 1} sur ${progress.total}…`
                  : busy
                    ? "Ouverture…"
                    : pool || error
                      ? "Ouvrir un booster"
                      : "Préparation des cartes…"}
              </button>
              {multiButtons.length > 0 && <div className="booster-multi">{multiButtons}</div>}
              {signedOutWithAccounts && cloud.status === "signedOut" && (
                <p className="muted small">
                  <Link href="/connexion">Connecte-toi</Link> pour ouvrir tes boosters : ta collection est gardée sur ton compte.
                </p>
              )}
              {ready && <Recharge timed={packs.timed} nextIn={packs.nextIn} />}
            </div>
          </div>
        )}

        <ul className="booster-rules">
          <li>
            ⏱️ 1 booster toutes les {RECHARGE_MS / 60000} minutes, jusqu&apos;à {MAX_STOCK} en réserve (
            {packs.nextIn === null ? "réserve pleine" : `prochain dans ${countdown(packs.nextIn)}`})
          </li>
          <li>
            ♻️ Tes doublons servent à l&apos;<Link href="/cartes/atelier">atelier</Link> : recycle-les en pièces, fabrique
            les cartes qui te manquent ou passe-les en argent et en or
          </li>
          <li>🎯 Termine les quêtes du jour, de la semaine et du mois (juste en dessous) pour gagner des boosters et des pièces en plus</li>
        </ul>
      </section>

      <QuestPanel
        boards={boards}
        now={now}
        message={questMsg}
        claiming={claiming}
        disabled={!ready || !pool || signedOutWithAccounts}
        signedOut={signedOutWithAccounts && cloud.status === "signedOut"}
        onClaim={claim}
      />

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

function PackSummary({ cards, packs }: { cards: PulledCard[]; packs: number }) {
  const fresh = cards.filter((c) => c.isNew).length;
  const dups = cards.length - fresh;
  return (
    <span className="muted pack-summary">
      {packs > 1 && `${packs} boosters · ${cards.length} cartes · `}
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

/** « 5 h 03 », « 12 min », « 3 j 5 h ». */
function untilLabel(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)} j ${h % 24} h`;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

const RESET_TEXT: Record<Period, string> = {
  day: "Les quêtes du jour changent tous les jours à minuit.",
  week: "Les quêtes de la semaine changent chaque lundi à minuit.",
  month: "Les quêtes du mois changent le 1er de chaque mois à minuit.",
};

/** Les quêtes du jour, de la semaine et du mois (onglets) : avancement, récompense, et bouton pour la récupérer. */
function QuestPanel(props: {
  boards: Record<Period, QuestView[]>;
  now: number;
  message: string | null;
  claiming: QuestId | null;
  disabled: boolean;
  signedOut: boolean;
  onClaim: (period: Period, id: QuestId) => void;
}) {
  const { boards, now, message, claiming, disabled, signedOut, onClaim } = props;
  const [period, setPeriod] = useState<Period>("day");
  const quests = boards[period];
  const info = periodInfo(period);
  const ready = (p: Period) => boards[p].filter((q) => q.done && !q.claimed).length;
  return (
    <section className="quests" aria-labelledby="quests-title">
      <div className="quests-head">
        <h2 id="quests-title">Quêtes</h2>
        <span className="muted small mono">Nouvelles quêtes dans {untilLabel(msUntilPeriodEnd(period, now))}</span>
      </div>
      <div className="quest-tabs" role="tablist" aria-label="Période des quêtes">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === period}
            className={p.id === period ? "quest-tab active" : "quest-tab"}
            onClick={() => setPeriod(p.id)}
          >
            {p.tab}
            {ready(p.id) > 0 && <span className="quest-dot" aria-label={`${ready(p.id)} à récupérer`}>{ready(p.id)}</span>}
          </button>
        ))}
      </div>
      <p className="muted small">
        {RESET_TEXT[period]} Chaque récompense se récupère une seule fois.
      </p>
      {message && <p className="notice">{message}</p>}
      <ul className="quest-list" role="tabpanel" aria-label={`Quêtes ${info.of}`}>
        {quests.map((q) => (
          <li key={q.id} className={q.claimed ? "quest claimed" : q.done ? "quest done" : "quest"}>
            <span className="quest-icon" aria-hidden="true">{q.icon}</span>
            <div className="quest-body">
              <strong>{q.label}</strong>
              <div className="quest-bar" role="progressbar" aria-valuemin={0} aria-valuemax={q.goal} aria-valuenow={q.progress} aria-label={q.label}>
                <span style={{ width: `${(100 * q.progress) / q.goal}%` }} />
              </div>
              <span className="muted small">
                {q.progress}/{q.goal} · récompense : {rewardLabel(q.reward)}
              </span>
            </div>
            {q.claimed ? (
              <span className="quest-ok">✓ Récupérée</span>
            ) : (
              <button
                type="button"
                className={q.done ? "button" : "button ghost"}
                disabled={!q.done || disabled || claiming !== null}
                onClick={() => onClaim(period, q.id)}
              >
                {claiming === q.id ? "…" : "Récupérer"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {signedOut && (
        <p className="muted small">
          <Link href="/connexion">Connecte-toi</Link> pour faire les quêtes.
        </p>
      )}
    </section>
  );
}

const countdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, "0");
  return `${m}:${sec}`;
};

/** Jauge de la réserve : 5 cases, la case en cours se remplit pendant la recharge. */
function Recharge({ timed, nextIn }: { timed: number; nextIn: number | null }) {
  const progress = nextIn === null ? 0 : 1 - nextIn / RECHARGE_MS;
  return (
    <div className="recharge" aria-label={`Réserve : ${timed} booster${timed > 1 ? "s" : ""} sur ${MAX_STOCK}`}>
      <div className="recharge-pips" aria-hidden="true">
        {Array.from({ length: MAX_STOCK }, (_, i) => (
          <span
            key={i}
            className={i < timed ? "pip full" : i === timed ? "pip charging" : "pip"}
            style={i === timed ? ({ "--p": progress } as React.CSSProperties) : undefined}
          />
        ))}
      </div>
      <span className="muted mono small">
        {nextIn === null ? `Réserve pleine ${MAX_STOCK}/${MAX_STOCK}` : `${timed}/${MAX_STOCK} · +1 dans ${countdown(nextIn)}`}
      </span>
    </div>
  );
}
