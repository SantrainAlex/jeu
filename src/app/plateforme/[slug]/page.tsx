import Link from "next/link";
import { notFound } from "next/navigation";
import { GameCard } from "@/components/GameCard";
import { PERIODS, getPlatform, parsePeriod, type Period } from "@/lib/platforms";
import { getNewGames } from "@/lib/games";

// La page dépend de la période choisie (?periode=...), elle est donc générée à la demande.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const platform = getPlatform(slug);
  return { title: platform ? `Nouveautés ${platform.name} — Jeu` : "Plateforme inconnue" };
}

export default async function PlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { slug } = await params;
  const platform = getPlatform(slug);
  if (!platform) notFound();

  const period = parsePeriod((await searchParams).periode);
  const { games, demo } = await getNewGames(platform, period);

  return (
    <>
      <p><Link href="/" className="muted">← Toutes les plateformes</Link></p>
      <h1 style={{ color: platform.color }}>{platform.name}</h1>

      <div className="tabs" role="tablist">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <Link
            key={p}
            href={`/plateforme/${platform.slug}?periode=${p}`}
            className={p === period ? "tab active" : "tab"}
            role="tab"
            aria-selected={p === period}
          >
            {PERIODS[p].label}
          </Link>
        ))}
      </div>

      {demo && (
        <p className="notice">
          Ce sont des jeux d&apos;exemple. Ajoute ta clé RAWG et/ou tes identifiants IGDB dans le fichier{" "}
          <code>.env.local</code> pour voir les vraies sorties.
        </p>
      )}

      {games.length === 0 ? (
        <p className="muted">Aucune sortie sur cette période.</p>
      ) : (
        <div className="game-grid">
          {games.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </>
  );
}
