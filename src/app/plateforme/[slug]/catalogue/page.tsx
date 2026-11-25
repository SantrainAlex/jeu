import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/GameCard";
import { PlatformTabs } from "@/components/PlatformTabs";
import { getCatalog, type CatalogSort } from "@/lib/games";
import { getPlatform } from "@/lib/platforms";

export const dynamic = "force-dynamic";

const SORTS: Record<CatalogSort, string> = {
  populaires: "Populaires",
  notes: "Mieux notés",
  recents: "Plus récents",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const platform = getPlatform((await params).slug);
  return { title: platform ? `Catalogue ${platform.name} — Jeu` : "Plateforme inconnue" };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; tri?: string; page?: string }>;
}) {
  const platform = getPlatform((await params).slug);
  if (!platform) notFound();

  const sp = await searchParams;
  const query = (sp.q ?? "").trim().slice(0, 80);
  const sort: CatalogSort = sp.tri === "notes" || sp.tri === "recents" ? sp.tri : "populaires";
  const page = Math.min(Math.max(1, Number(sp.page) || 1), 50);

  let result: Awaited<ReturnType<typeof getCatalog>> | null = null;
  try {
    result = await getCatalog(platform, { query: query || undefined, sort, page });
  } catch {
    result = null;
  }

  const href = (changes: { tri?: CatalogSort; page?: number }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const t = changes.tri ?? sort;
    if (t !== "populaires") params.set("tri", t);
    const p = changes.page ?? 1;
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/plateforme/${platform.slug}/catalogue${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PlatformTabs platform={platform} active="catalogue" />

      <p className="muted">Tous les jeux déjà sortis sur {platform.name} : retrouve ceux auxquels tu as joué et note-les.</p>

      <form className="search" action={`/plateforme/${platform.slug}/catalogue`}>
        <input type="search" name="q" defaultValue={query} placeholder="Rechercher un jeu (ex. Zelda, FIFA…)" aria-label="Rechercher un jeu" />
        {sort !== "populaires" && <input type="hidden" name="tri" value={sort} />}
        <button type="submit">Rechercher</button>
      </form>

      {query ? (
        <p className="muted">
          Résultats pour « {query} » · <Link href={`/plateforme/${platform.slug}/catalogue`}>effacer</Link>
        </p>
      ) : (
        <div className="sorts">
          {(Object.keys(SORTS) as CatalogSort[]).map((s) => (
            <Link key={s} href={href({ tri: s })} className={s === sort ? "chip active" : "chip"}>
              {SORTS[s]}
            </Link>
          ))}
        </div>
      )}

      {result?.demo && (
        <p className="notice">
          Ce sont des jeux d&apos;exemple. Ajoute ta clé RAWG et/ou tes identifiants IGDB dans <code>.env.local</code> pour
          voir le vrai catalogue.
        </p>
      )}

      {!result ? (
        <p className="notice">Le catalogue est indisponible pour le moment, réessaie dans un instant.</p>
      ) : result.games.length === 0 ? (
        <p className="muted">Aucun jeu trouvé.</p>
      ) : (
        <div className="game-grid">
          {result.games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}

      {result && (page > 1 || result.hasMore) && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={href({ page: page - 1 })}>← Précédente</Link> : <span />}
          <span className="muted">Page {page}</span>
          {result.hasMore ? <Link href={href({ page: page + 1 })}>Suivante →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
