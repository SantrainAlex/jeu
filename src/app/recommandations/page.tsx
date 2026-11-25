"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GameCard } from "@/components/GameCard";
import { getPlatform } from "@/lib/platforms";
import type { Game } from "@/lib/types";
import {
  applyFilters,
  computeTastes,
  DEFAULT_FILTERS,
  isStrongMatch,
  onlyOnMyPlatforms,
  platformsFor,
  rankGames,
  type RecoFilters,
  type RecoSort,
} from "@/lib/reco";
import { useStore } from "@/lib/store";

type State = { status: "idle" | "loading" | "done" | "error"; games: Game[]; demo: boolean };

const PAGE = 24;
const SORTS: { id: RecoSort; label: string }[] = [
  { id: "pour-moi", label: "Pour moi" },
  { id: "notes", label: "Mieux notés" },
  { id: "recents", label: "Plus récents" },
];

export default function RecommendationsPage() {
  const [{ ratings, profile }, ready] = useStore();
  const rated = useMemo(() => Object.values(ratings), [ratings]);
  const tastes = useMemo(() => computeTastes(rated), [rated]);
  const liked = tastes.filter((t) => t.weight > 0).slice(0, 5);
  const mine = useMemo(() => [...new Set([...profile.owned, ...profile.interested])], [profile]);

  const genreKey = liked.map((t) => t.slug).join(",");
  const platformKey = mine.join(",");
  const [state, setState] = useState<State>({ status: "idle", games: [], demo: false });
  const [filters, setFilters] = useState<RecoFilters>(DEFAULT_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const set = (change: Partial<RecoFilters>) => {
    setFilters((f) => ({ ...f, ...change }));
    setShown(PAGE);
  };

  useEffect(() => {
    if (!genreKey || !platformKey) return;
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    fetch(`/api/recommandations?genres=${genreKey}&platforms=${platformKey}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { games: Game[]; demo: boolean }) => {
        if (!cancelled) setState({ status: "done", games: data.games, demo: data.demo });
      })
      .catch(() => !cancelled && setState({ status: "error", games: [], demo: false }));
    return () => {
      cancelled = true;
    };
  }, [genreKey, platformKey]);

  // Tous les jeux qui peuvent te plaire, uniquement sur tes plateformes
  const recos = useMemo(
    () => rankGames(onlyOnMyPlatforms(state.games, mine), tastes, new Set(rated.map((r) => r.id))),
    [state.games, mine, tastes, rated],
  );
  const visible = useMemo(() => applyFilters(recos, filters, profile, tastes), [recos, filters, profile, tastes]);

  // Nombre de jeux pour chaque choix de console (avec les autres filtres)
  const countFor = (platform: string) => applyFilters(recos, { ...filters, platform }, profile, tastes).length;

  if (!ready) return <h1>Pour toi</h1>;

  const platformChoices = [
    { id: "toutes", label: "Toutes mes consoles" },
    ...(profile.owned.length && platformsFor("interesse", profile).length
      ? [
          { id: "jai", label: "🎮 Celles que j'ai" },
          { id: "interesse", label: "⭐ Qui m'intéressent" },
        ]
      : []),
    ...(mine.length > 1 ? mine.map((slug) => ({ id: slug, label: getPlatform(slug)?.short ?? slug })) : []),
  ];

  return (
    <>
      <h1>Pour toi</h1>
      {mine.length === 0 ? (
        <p className="notice">
          Dis-moi d&apos;abord quelles consoles tu as ou t&apos;intéressent dans ton <Link href="/profil">profil</Link> :
          je ne te propose que des jeux qui sortent dessus.
        </p>
      ) : !genreKey ? (
        <p className="muted">
          Note au moins un jeu avec 4 ou 5 étoiles pour que je comprenne ce que tu aimes. Commence par une{" "}
          <Link href="/">plateforme</Link>.
        </p>
      ) : (
        <>
          <p className="muted">
            Basées sur tes {rated.length} note{rated.length > 1 ? "s" : ""}, uniquement sur tes consoles (
            {mine.map((s) => getPlatform(s)?.short ?? s).join(", ")}). <Link href="/profil">Modifier</Link>
          </p>

          <div className="reco-filters">
            <div className="filter-row" role="group" aria-label="Consoles">
              <span className="filter-label">Consoles</span>
              <div className="filter-chips">
                {platformChoices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={filters.platform === c.id ? "chip active" : "chip"}
                    aria-pressed={filters.platform === c.id}
                    onClick={() => set({ platform: c.id })}
                  >
                    {c.label}
                    {state.status === "done" && <span className="chip-count">{countFor(c.id)}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-row" role="group" aria-label="Genre">
              <span className="filter-label">Genre</span>
              <div className="filter-chips">
                {[{ slug: "tous", name: "Tous" }, ...liked].map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    className={filters.genre === t.slug ? "chip active" : "chip"}
                    aria-pressed={filters.genre === t.slug}
                    onClick={() => set({ genre: t.slug })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-row" role="group" aria-label="Tri">
              <span className="filter-label">Trier</span>
              <div className="filter-chips">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={filters.sort === s.id ? "chip active" : "chip"}
                    aria-pressed={filters.sort === s.id}
                    onClick={() => set({ sort: s.id })}
                  >
                    {s.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={filters.strongOnly ? "chip active" : "chip"}
                  aria-pressed={filters.strongOnly}
                  onClick={() => set({ strongOnly: !filters.strongOnly })}
                >
                  💖 Coups de cœur seulement
                </button>
              </div>
            </div>
          </div>

          {state.demo && (
            <p className="notice">Ce sont des jeux d&apos;exemple : ajoute ta clé RAWG et/ou IGDB pour de vraies recommandations.</p>
          )}
          {state.status === "loading" && <p className="muted">Recherche de jeux pour toi…</p>}
          {state.status === "error" && <p className="notice">Impossible de charger les recommandations pour le moment.</p>}
          {state.status === "done" && recos.length === 0 && (
            <p className="muted">Pas de nouvelle idée pour l&apos;instant : note d&apos;autres jeux !</p>
          )}
          {state.status === "done" && recos.length > 0 && visible.length === 0 && (
            <p className="muted">
              Aucun jeu avec ces filtres.{" "}
              <button type="button" className="chip" onClick={() => set(DEFAULT_FILTERS)}>
                Tout réafficher
              </button>
            </p>
          )}
          <div className="game-grid">
            {visible.slice(0, shown).map((g) => (
              <GameCard
                key={g.id}
                game={g}
                extra={
                  <>
                    <p className="reason">
                      {isStrongMatch(g, tastes) ? "💖 Coup de cœur probable" : "Ça peut te plaire"} · tu aimes{" "}
                      {g.reasons.join(", ")}
                    </p>
                    <div className="tags">
                      {(g.platforms ?? []).map((slug) => {
                        const p = getPlatform(slug);
                        const owned = profile.owned.includes(slug);
                        return (
                          <span
                            key={slug}
                            className={owned ? "tag platform-tag owned" : "tag platform-tag"}
                            title={owned ? "Tu as cette console" : "Cette console t'intéresse"}
                          >
                            <span className="dot" style={{ background: p?.color }} />
                            {p?.short ?? slug}
                            {owned ? " ✓" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </>
                }
              />
            ))}
          </div>
          {visible.length > shown && (
            <p style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <button type="button" className="button ghost" onClick={() => setShown((n) => n + PAGE)}>
                Voir plus ({visible.length - shown})
              </button>
            </p>
          )}
        </>
      )}
    </>
  );
}
