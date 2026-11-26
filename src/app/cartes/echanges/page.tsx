"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { CardTabs } from "@/components/CardTabs";
import { rarityInfo } from "@/lib/cards";
import { cloudEnabled, refreshCards, tradesRequest, useCloud } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { TRADE_LIMITS, USERNAME, tradableCards, type TradeItem, type TradeLine, type TradeView, type TradesList } from "@/lib/trades";

type Picked = Record<number, number>;
const toLines = (p: Picked): TradeLine[] => Object.entries(p).filter(([, n]) => n > 0).map(([id, n]) => ({ id: Number(id), n }));
const total = (p: Picked) => Object.values(p).reduce((s, n) => s + n, 0);
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

const STATUS: Record<TradeView["status"], string> = {
  pending: "En attente",
  accepted: "Accepté ✅",
  refused: "Refusé",
  cancelled: "Annulé",
  expired: "Expiré",
};

export default function TradesPage() {
  const cloud = useCloud();
  const [{ collection }, ready] = useStore();
  const [list, setList] = useState<TradesList | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // proposer un échange
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<{ username: string; cards: TradeItem[] } | null>(null);
  const [give, setGive] = useState<Picked>({});
  const [want, setWant] = useState<Picked>({});

  const load = useCallback(async () => {
    const res = await tradesRequest<TradesList>();
    if ("error" in res) setMessage({ text: res.error, ok: false });
    else setList(res);
    // un autre joueur a peut-être accepté une de tes offres pendant ton absence
    refreshCards();
  }, []);

  useEffect(() => {
    if (cloud.status === "signedIn") load();
  }, [cloud.status, cloud.userId, load]);

  const lookUp = useCallback(async (who: string) => {
    const q = who.trim();
    if (!USERNAME.test(q)) return setMessage({ text: "Tape le nom d'utilisateur exact du joueur (3 à 20 caractères).", ok: false });
    setBusy(true);
    const res = await tradesRequest<{ username: string; cards: TradeItem[] }>(`?joueur=${encodeURIComponent(q)}`);
    setBusy(false);
    setWant({});
    if ("error" in res) {
      setPlayer(null);
      setMessage({ text: res.error, ok: false });
    } else {
      setPlayer(res);
      setMessage(null);
    }
  }, []);

  // lien « Échanger » depuis le classement : /cartes/echanges?avec=Nom
  useEffect(() => {
    if (cloud.status !== "signedIn") return;
    const avec = new URLSearchParams(window.location.search).get("avec");
    if (avec) {
      setName(avec);
      lookUp(avec);
    }
  }, [cloud.status, lookUp]);

  const mine = useMemo(() => tradableCards(collection), [collection]);

  const act = async (action: unknown, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    const res = await tradesRequest<TradesList & { message: string }>("", action);
    setBusy(false);
    if ("error" in res) {
      setMessage({ text: res.error, ok: false });
      load();
      return;
    }
    setList(res);
    setMessage({ text: res.message, ok: true });
    after?.();
  };

  const send = () =>
    player &&
    act({ type: "propose", to: player.username, give: toLines(give), want: toLines(want) }, () => {
      setGive({});
      setWant({});
      setPlayer(null);
      setName("");
    });

  if (!ready) return <h1>Échanges</h1>;

  const header = (
    <>
      <p className="eyebrow">Cartes · entre joueurs</p>
      <h1>Échanges</h1>
      <CardTabs active="echanges" />
    </>
  );

  if (!cloudEnabled) return <>{header}<p className="notice">Les échanges ont besoin des comptes en ligne, qui ne sont pas activés sur ce site.</p></>;
  if (cloud.status !== "signedIn") {
    return (
      <>
        {header}
        <p className="notice">
          {cloud.status === "loading" ? "Chargement…" : <><Link href="/connexion">Connecte-toi</Link> pour échanger des cartes avec les autres joueurs.</>}
        </p>
      </>
    );
  }

  const canSend = player && total(give) > 0 && total(want) > 0 && !busy;

  return (
    <>
      {header}
      <p className="muted">
        Propose tes doublons à un autre joueur contre les siens. Il accepte ou refuse ; s&apos;il accepte, les cartes changent
        d&apos;album en même temps des deux côtés. Seuls les doublons s&apos;échangent : ton dernier exemplaire d&apos;une carte reste
        toujours à toi.
      </p>

      {message && (
        <p className={message.ok ? "notice ok" : "notice"} role="status">
          {message.text}
        </p>
      )}

      {list && !list.username && (
        <p className="notice">
          Pour échanger, <Link href="/profil">choisis d&apos;abord ton nom d&apos;utilisateur</Link> : c&apos;est avec ce nom que les
          autres joueurs te trouvent.
        </p>
      )}

      {/* ---------- Offres reçues ---------- */}
      <section className="panel">
        <h2>Offres reçues {list?.received.length ? <span className="chip-count">{list.received.length}</span> : null}</h2>
        {!list ? (
          <p className="muted">Chargement…</p>
        ) : list.received.length === 0 ? (
          <p className="muted">Aucune offre pour l&apos;instant.</p>
        ) : (
          <ul className="trade-offers">
            {list.received.map((t) => (
              <li key={t.id} className="trade-offer">
                <p>
                  <strong>{t.other}</strong> te propose <span className="muted small">· jusqu&apos;au {dateFr(t.expiresAt)}</span>
                </p>
                <OfferSides youGive={t.want} youGet={t.give} />
                <div className="row-actions">
                  <button type="button" className="button" disabled={busy} onClick={() => act({ type: "accept", id: t.id })}>
                    Accepter
                  </button>
                  <button type="button" className="button ghost" disabled={busy} onClick={() => act({ type: "refuse", id: t.id })}>
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Proposer ---------- */}
      <section className="panel">
        <h2>Proposer un échange</h2>
        <form
          className="trade-search"
          onSubmit={(e) => {
            e.preventDefault();
            lookUp(name);
          }}
        >
          <PlayerSearch
            value={name}
            onChange={setName}
            onPick={(who) => {
              setName(who);
              lookUp(who);
            }}
          />
          <button type="submit" className="button ghost" disabled={busy || name.trim().length < 3}>
            Voir ses doublons
          </button>
        </form>
        <p className="muted small">
          Tu peux aussi le trouver dans le <Link href="/cartes/classement">classement</Link>.
        </p>

        {player && (
          <>
            <div className="trade-pickers">
              <Picker
                title="Tu donnes"
                empty="Tu n'as pas encore de doublon à échanger."
                cards={mine}
                picked={give}
                onChange={setGive}
              />
              <Picker
                title={`Tu veux (cartes de ${player.username})`}
                empty={`${player.username} n'a pas de doublon à échanger pour l'instant.`}
                cards={player.cards}
                picked={want}
                onChange={setWant}
                markMissing={(id) => !collection.cards[id]}
              />
            </div>
            <p className="muted small">
              Jusqu&apos;à {TRADE_LIMITS.cardsPerSide} cartes différentes et {TRADE_LIMITS.copiesPerSide} exemplaires de chaque côté. Sans
              réponse, l&apos;offre expire au bout de {TRADE_LIMITS.expireDays} jours.
            </p>
            <button type="button" className="button" disabled={!canSend} onClick={send}>
              Envoyer l&apos;offre à {player.username} ({total(give)} contre {total(want)})
            </button>
          </>
        )}
      </section>

      {/* ---------- Offres envoyées ---------- */}
      {list && list.sent.length > 0 && (
        <section className="panel">
          <h2>
            Mes offres en attente <span className="muted small">({list.sent.length} / {TRADE_LIMITS.openSent})</span>
          </h2>
          <ul className="trade-offers">
            {list.sent.map((t) => (
              <li key={t.id} className="trade-offer">
                <p>
                  À <strong>{t.other}</strong> <span className="muted small">· jusqu&apos;au {dateFr(t.expiresAt)}</span>
                </p>
                <OfferSides youGive={t.give} youGet={t.want} />
                <button type="button" className="button ghost" disabled={busy} onClick={() => act({ type: "cancel", id: t.id })}>
                  Annuler l&apos;offre
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Historique ---------- */}
      {list && list.history.length > 0 && (
        <section className="panel">
          <h2>Derniers échanges</h2>
          <ul className="trade-offers">
            {list.history.map((t) => (
              <li key={t.id} className="trade-offer done">
                <p>
                  {t.sent ? <>À <strong>{t.other}</strong></> : <>De <strong>{t.other}</strong></>} · {STATUS[t.status]}
                  {t.resolvedAt && <span className="muted small"> · {dateFr(t.resolvedAt)}</span>}
                </p>
                <OfferSides youGive={t.sent ? t.give : t.want} youGet={t.sent ? t.want : t.give} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Items({ items }: { items: TradeItem[] }) {
  return (
    <ul className="trade-items">
      {items.map((it) => {
        const r = rarityInfo(it.card.rarity);
        const art = it.card.cover ?? it.card.image;
        return (
          <li key={it.id} className="trade-item" style={{ borderColor: r.color }} title={`${it.card.name} · ${r.label}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {art ? <img src={art} alt="" loading="lazy" /> : <span className="trade-noart" />}
            <span className="trade-item-name">
              {it.card.name}
              <span className="muted small">
                <span className="dot" style={{ background: r.color }} /> {r.label}
                {it.n > 1 ? ` · ×${it.n}` : ""}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function OfferSides({ youGive, youGet }: { youGive: TradeItem[]; youGet: TradeItem[] }) {
  return (
    <div className="trade-sides">
      <div>
        <p className="muted small">Tu donnes</p>
        <Items items={youGive} />
      </div>
      <span className="trade-arrow" aria-hidden="true">⇄</span>
      <div>
        <p className="muted small">Tu reçois</p>
        <Items items={youGet} />
      </div>
    </div>
  );
}

function Picker({
  title,
  empty,
  cards,
  picked,
  onChange,
  markMissing,
}: {
  title: string;
  empty: string;
  cards: TradeItem[];
  picked: Picked;
  onChange: (p: Picked) => void;
  /** cartes que tu n'as pas encore : signalées « Nouvelle pour toi » */
  markMissing?: (id: number) => boolean;
}) {
  const [q, setQ] = useState("");
  const shown = cards.filter((c) => q.trim().length < 2 || c.card.name.toLowerCase().includes(q.trim().toLowerCase()));
  const kinds = Object.values(picked).filter((n) => n > 0).length;
  const full = total(picked) >= TRADE_LIMITS.copiesPerSide;
  const set = (id: number, n: number) => {
    const next = { ...picked };
    if (n > 0) next[id] = n;
    else delete next[id];
    onChange(next);
  };

  return (
    <div className="trade-picker">
      <h3>
        {title} <span className="muted small">· {total(picked)} choisie{total(picked) > 1 ? "s" : ""}</span>
      </h3>
      {cards.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <>
          {cards.length > 8 && (
            <input className="search-input" type="search" placeholder="Filtrer…" aria-label={`Filtrer : ${title}`} value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          <ul className="trade-pick-list">
            {shown.slice(0, 60).map((c) => {
              const r = rarityInfo(c.card.rarity);
              const n = picked[c.id] ?? 0;
              const canAdd = n < c.n && !full && (n > 0 || kinds < TRADE_LIMITS.cardsPerSide);
              return (
                <li key={c.id} className={n ? "picked" : undefined}>
                  <span className="dot" style={{ background: r.color }} />
                  <span className="craft-name">
                    {c.card.name}
                    {markMissing?.(c.id) && <span className="badge-new">Nouvelle pour toi</span>}
                  </span>
                  <span className="muted small mono">{c.n} dispo</span>
                  <span className="stepper">
                    <button type="button" className="button ghost" aria-label={`Retirer ${c.card.name}`} disabled={n === 0} onClick={() => set(c.id, n - 1)}>
                      −
                    </button>
                    <span className="mono">{n}</span>
                    <button type="button" className="button ghost" aria-label={`Ajouter ${c.card.name}`} disabled={!canAdd} onClick={() => set(c.id, n + 1)}>
                      +
                    </button>
                  </span>
                </li>
              );
            })}
            {shown.length > 60 && <li className="muted small">… et {shown.length - 60} autres : filtre par nom.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

/** Temps d'attente après la dernière lettre tapée avant de chercher les joueurs (ms). */
const WAIT = 200;

/**
 * Le champ « Nom du joueur » : dès la 1re lettre, les joueurs dont le nom contient ces lettres
 * apparaissent juste en dessous (ceux qui commencent par elles d'abord). Un clic, ou flèches + Entrée, choisit le joueur.
 */
function PlayerSearch({ value, onChange, onPick }: { value: string; onChange: (v: string) => void; onPick: (username: string) => void }) {
  const listId = useId();
  const [items, setItems] = useState<{ username: string; score: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);
  const wanted = value.trim();

  useEffect(() => {
    if (!typed.current || wanted.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await tradesRequest<{ players: { username: string; score: number }[] }>(`?chercher=${encodeURIComponent(wanted)}`);
      if (stale) return;
      setItems("error" in res ? [] : res.players);
      setActive(-1);
      setLoading(false);
    }, WAIT);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [wanted]);

  const pick = (username: string) => {
    setOpen(false);
    typed.current = false;
    setItems([]);
    onPick(username);
  };
  const show = open && wanted.length >= 1 && typed.current;

  return (
    <div className="player-search">
      <input
        className="search-input"
        type="search"
        placeholder="Nom du joueur…"
        aria-label="Nom d'utilisateur du joueur"
        autoComplete="off"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (!items.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0 && items[active]) {
            e.preventDefault();
            pick(items[active].username);
          }
        }}
      />
      {show && (
        // onMouseDown : on choisit avant que le champ perde le focus (sinon la liste se ferme d'abord)
        <div className="suggestions" onMouseDown={(e) => e.preventDefault()}>
          <ul id={listId} role="listbox" aria-label="Joueurs">
            {items.map((p, i) => (
              <li key={p.username} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <a
                  href={`/cartes/echanges?avec=${encodeURIComponent(p.username)}`}
                  className={i === active ? "active" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    pick(p.username);
                  }}
                >
                  <span className="suggestion-placeholder">{p.username.slice(0, 1).toUpperCase()}</span>
                  <span className="suggestion-name">{p.username}</span>
                  <span className="suggestion-year">{p.score.toLocaleString("fr-FR")} pts</span>
                </a>
              </li>
            ))}
          </ul>
          {loading && items.length === 0 && <p className="suggestion-note">Recherche…</p>}
          {!loading && items.length === 0 && <p className="suggestion-note">Aucun joueur trouvé.</p>}
        </div>
      )}
    </div>
  );
}
