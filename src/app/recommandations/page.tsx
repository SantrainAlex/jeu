"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GameCard } from "@/components/GameCard";
import type { Game } from "@/lib/rawg";
import { computeTastes, rankGames } from "@/lib/reco";
import { useStore } from "@/lib/store";

type State = { status: "idle" | "loading" | "done" | "error"; games: Game[]; demo: boolean };

export default function RecommendationsPage() {
  const [{ ratings, profile }, ready] = useStore();
  const rated = useMemo(() => Object.values(ratings), [ratings]);
  const tastes = useMemo(() => computeTastes(rated), [rated]);
  const topGenres = tastes.filter((t) => t.weight > 0).slice(0, 3);
  const platforms = [...new Set([...profile.owned, ...profile.interested])];

  const genreKey = topGenres.map((t) => t.slug).join(",");
  const platformKey = platforms.join(",");
  const [state, setState] = useState<State>({ status: "idle", games: [], demo: false });

  useEffect(() => {
    if (!genreKey) return;
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

  const recos = useMemo(
    () => rankGames(state.games, tastes, new Set(rated.map((r) => r.id))).slice(0, 20),
    [state.games, tastes, rated],
  );

  if (!ready) return <h1>Mes recommandations</h1>;

  return (
    <>
      <h1>Mes recommandations</h1>
      {!genreKey ? (
        <p className="muted">
          Note au moins un jeu avec 4 ou 5 étoiles pour que je comprenne ce que tu aimes. Commence par une{" "}
          <Link href="/">plateforme</Link>.
        </p>
      ) : (
        <>
          <p className="muted">
            Basées sur tes {rated.length} note{rated.length > 1 ? "s" : ""}. Genres préférés :{" "}
            <strong>{topGenres.map((t) => t.name).join(", ")}</strong>
            {platforms.length > 0 ? " · sur tes plateformes" : " · toutes plateformes (choisis les tiennes dans ton profil)"}
          </p>
          {state.demo && (
            <p className="notice">Ce sont des jeux d&apos;exemple : ajoute ta clé RAWG pour de vraies recommandations.</p>
          )}
          {state.status === "loading" && <p className="muted">Recherche de jeux pour toi…</p>}
          {state.status === "error" && <p className="notice">Impossible de charger les recommandations pour le moment.</p>}
          {state.status === "done" && recos.length === 0 && (
            <p className="muted">Pas de nouvelle idée pour l&apos;instant : note d&apos;autres jeux !</p>
          )}
          <div className="game-grid">
            {recos.map((g) => (
              <GameCard key={g.id} game={g} extra={<p className="reason">Parce que tu aimes {g.reasons.join(", ")}</p>} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
