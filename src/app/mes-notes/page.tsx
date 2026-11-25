"use client";

import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { computeTastes } from "@/lib/reco";
import { useStore } from "@/lib/store";

export default function MyRatingsPage() {
  const [{ ratings }, ready] = useStore();
  const list = Object.values(ratings).sort((a, b) => b.stars - a.stars || b.ratedAt.localeCompare(a.ratedAt));
  const tastes = computeTastes(list);
  const liked = tastes.filter((t) => t.weight > 0).slice(0, 5);
  const disliked = tastes.filter((t) => t.weight < 0).slice(-3).reverse();

  if (!ready) return <h1>Mes notes</h1>;

  return (
    <>
      <h1>Mes notes</h1>
      {list.length === 0 ? (
        <p className="muted">
          Tu n&apos;as encore noté aucun jeu. Va sur une <Link href="/">plateforme</Link> et clique sur les étoiles
          d&apos;un jeu auquel tu as joué.
        </p>
      ) : (
        <>
          {(liked.length > 0 || disliked.length > 0) && (
            <div className="tastes">
              {liked.length > 0 && (
                <p>
                  <strong>Tu aimes :</strong> {liked.map((t) => t.name).join(", ")}
                </p>
              )}
              {disliked.length > 0 && (
                <p className="muted">
                  <strong>Moins ton truc :</strong> {disliked.map((t) => t.name).join(", ")}
                </p>
              )}
              <Link href="/recommandations" className="button">Voir mes recommandations →</Link>
            </div>
          )}
          <div className="game-grid">
            {list.map((r) => (
              <GameCard key={r.id} game={{ ...r, rating: 0, sources: [] }} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
