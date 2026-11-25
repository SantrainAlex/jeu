import { PlatformGrid } from "@/components/PlatformGrid";

export default function Home() {
  return (
    <>
      <h1>Choisis ta plateforme</h1>
      <p className="muted">Retrouve les sorties du jour, de la semaine et du mois.</p>
      <PlatformGrid />
    </>
  );
}
