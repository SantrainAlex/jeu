import Link from "next/link";
import { gameHref } from "@/lib/details";
import { getNewGames } from "@/lib/games";
import { mergeGames } from "@/lib/merge";
import { getPlatform } from "@/lib/platforms";

/** Bandeau d'accueil : les grosses sorties de la semaine, toutes plateformes. */
export async function HeroReleases() {
  const platforms = ["switch-2", "switch", "ps5", "pc", "xbox"].map((s) => getPlatform(s)!);
  const results = await Promise.allSettled(platforms.map((p) => getNewGames(p, "semaine")));
  const lists = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.games] : []));
  const games = mergeGames(...lists)
    .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)))
    .slice(0, 6);
  if (games.length === 0) return null;

  const [main, ...rest] = games;
  const date = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "";

  return (
    <section className="hero" aria-label="Les sorties de la semaine">
      <Link href={gameHref(main)} className="hero-main">
        {main.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main.image} alt="" />
        ) : (
          <div className="hero-fallback" />
        )}
        <div className="hero-overlay">
          <span className="eyebrow">Sortie de la semaine</span>
          <h2>{main.name}</h2>
          <p>
            {date(main.released)}
            {main.genres.length > 0 && ` · ${main.genres.slice(0, 2).map((g) => g.name).join(", ")}`}
          </p>
        </div>
      </Link>
      <ol className="hero-side">
        {rest.map((g) => (
          <li key={g.id} className="hero-mini">
            <span className="hero-thumb">
              {g.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt="" loading="lazy" />
              ) : (
                <span className="hero-fallback" />
              )}
            </span>
            <span className="hero-info">
              <h3>
                <Link href={gameHref(g)} className="card-link">
                  {g.name}
                </Link>
              </h3>
              <span className="mono">{date(g.released)}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href="/plateforme/pc?periode=semaine" className="sr-only">
        Voir toutes les sorties de la semaine
      </Link>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="hero" aria-busy="true">
      <div className="hero-main skeleton-block" />
      <div className="hero-side">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="hero-mini">
            <span className="hero-thumb skeleton-block" />
            <span className="hero-info">
              <span className="skeleton-line skeleton-block" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
