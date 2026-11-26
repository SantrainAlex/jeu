import Link from "next/link";
import { Suspense } from "react";
import { GameCard } from "@/components/GameCard";
import { GridSkeleton } from "@/components/GridSkeleton";
import { searchGames } from "@/lib/games";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  return { title: q ? `« ${q.slice(0, 80)} » — Recherche — ${SITE_NAME}` : `Recherche — ${SITE_NAME}` };
}

function pageHref(query: string, page: number) {
  const params = new URLSearchParams({ q: query });
  if (page > 1) params.set("page", String(page));
  return `/recherche?${params}`;
}

/** Résultats de la barre de recherche du haut : un jeu sur toutes les plateformes du site. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const query = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.min(Math.max(1, Number(sp.page) || 1), 50);

  return (
    <>
      <h1>Rechercher un jeu</h1>
      <p className="muted">Sur toutes les plateformes : Switch, PC, PlayStation, Xbox et mobile.</p>

      {query ? (
        <>
          <p className="muted">Résultats pour « {query} »</p>
          <Suspense key={`${query}|${page}`} fallback={<GridSkeleton />}>
            <Results query={query} page={page} />
          </Suspense>
        </>
      ) : (
        <p className="muted">Tape le nom d&apos;un jeu dans la barre de recherche en haut pour le retrouver, voir sa fiche et le noter.</p>
      )}
    </>
  );
}

async function Results({ query, page }: { query: string; page: number }) {
  let result;
  try {
    result = await searchGames(query, page);
  } catch {
    return <p className="notice">La recherche est indisponible pour le moment, réessaie dans un instant.</p>;
  }

  return (
    <>
      {result.demo && <p className="notice">Ce sont des jeux d&apos;exemple : les vraies sources de jeux ne sont pas branchées.</p>}

      {result.games.length === 0 ? (
        <p className="muted">Aucun jeu trouvé. Vérifie l&apos;orthographe ou essaie avec moins de mots.</p>
      ) : (
        <div className="game-grid">
          {result.games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}

      {(page > 1 || result.hasMore) && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={pageHref(query, page - 1)}>← Précédente</Link> : <span />}
          <span className="muted">Page {page}</span>
          {result.hasMore ? <Link href={pageHref(query, page + 1)}>Suivante →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
