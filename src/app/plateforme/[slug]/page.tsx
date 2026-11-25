import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameCard } from "@/components/GameCard";
import { GridSkeleton } from "@/components/GridSkeleton";
import { PlatformTabs } from "@/components/PlatformTabs";
import { getNewGames } from "@/lib/games";
import { getPlatform, parsePeriod, type Period, type Platform } from "@/lib/platforms";

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

  // Les onglets s'affichent tout de suite ; la liste arrive dès que les sources ont répondu.
  return (
    <>
      <PlatformTabs platform={platform} active={period} />
      <Suspense key={period} fallback={<GridSkeleton />}>
        <NewGames platform={platform} period={period} />
      </Suspense>
    </>
  );
}

async function NewGames({ platform, period }: { platform: Platform; period: Period }) {
  let result;
  try {
    result = await getNewGames(platform, period);
  } catch {
    return <p className="notice">Les jeux sont indisponibles pour le moment, réessaie dans un instant.</p>;
  }
  const { games, demo } = result;

  return (
    <>
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
