import Link from "next/link";
import { PLATFORMS } from "@/lib/platforms";

export default function Home() {
  return (
    <>
      <h1>Choisis ta plateforme</h1>
      <p className="muted">Retrouve les sorties du jour, de la semaine et du mois.</p>
      <div className="platform-grid">
        {PLATFORMS.map((p) => (
          <Link
            key={p.slug}
            href={`/plateforme/${p.slug}`}
            className="platform-card"
            style={{ "--accent": p.color } as React.CSSProperties}
          >
            <span>{p.name}</span>
            <span className="arrow">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}
