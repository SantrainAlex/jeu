import { Suspense } from "react";
import { HeroReleases, HeroSkeleton } from "@/components/HeroReleases";
import { PlatformGrid } from "@/components/PlatformGrid";

// Les sorties changent chaque jour : la page est générée à la demande (les données restent en cache 1 h).
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroReleases />
      </Suspense>
      <h1>Choisis ta plateforme</h1>
      <p className="muted">Les sorties du jour, de la semaine et du mois, et tout le catalogue à noter.</p>
      <PlatformGrid />
    </>
  );
}
