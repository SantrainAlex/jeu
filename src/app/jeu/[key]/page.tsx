import { notFound } from "next/navigation";
import { cache } from "react";
import { BackButton } from "@/components/BackButton";
import { LiveStreams } from "@/components/LiveStreams";
import { RatingStars } from "@/components/RatingStars";
import { ReadMore } from "@/components/ReadMore";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toGame, type GameDetails } from "@/lib/details";
import { getGameDetails } from "@/lib/games";

// La même fiche sert au titre de l'onglet et à la page : on ne la demande qu'une fois.
const load = cache(async (key: string) => {
  try {
    return await getGameDetails(key);
  } catch (e) {
    console.error("[jeu] fiche indisponible :", (e as Error).message);
    return "error" as const;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const result = await load((await params).key);
  if (!result || result === "error") return { title: "Fiche du jeu — Jeu" };
  return {
    title: `${result.details.name} — Jeu`,
    description: result.details.description?.slice(0, 160),
  };
}

const longDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const list = (items: string[]) => items.join(", ");
const SOURCE_NAME = { rawg: "RAWG", igdb: "IGDB" } as const;

export default async function GamePage({ params }: { params: Promise<{ key: string }> }) {
  const result = await load((await params).key);
  if (result === "error") {
    return (
      <>
        <BackButton />
        <p className="notice">La fiche de ce jeu est indisponible pour le moment, réessaie dans un instant.</p>
      </>
    );
  }
  if (!result) notFound();
  const { details: g, demo } = result;
  const upcoming = g.released !== null && g.released > new Date().toISOString().slice(0, 10);

  return (
    <article className="game-page">
      <BackButton />

      <header className="game-hero">
        <div className="game-hero-bg" aria-hidden="true">
          {g.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.image} alt="" />
          )}
        </div>
        <div className="game-hero-content">
          {g.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="game-cover" src={g.cover} alt={`Jaquette de ${g.name}`} />
          )}
          <div className="game-hero-text">
            {g.genres.length > 0 && <span className="eyebrow">{g.genres.slice(0, 3).map((x) => x.name).join(" · ")}</span>}
            <h1>{g.name}</h1>
            <p className="game-hero-meta">
              {g.released ? `${upcoming ? "Sortie prévue le" : "Sorti le"} ${longDate(g.released)}` : "Date de sortie inconnue"}
              {g.developers.length > 0 && ` · ${g.developers[0]}`}
            </p>
            <Scores game={g} />
            <RatingStars game={toGame(g)} />
          </div>
        </div>
      </header>

      {demo && (
        <p className="notice">
          Ce sont des infos d&apos;exemple. Ajoute ta clé RAWG et/ou tes identifiants IGDB dans le fichier <code>.env.local</code>.
        </p>
      )}

      <div className="game-layout">
        <div className="game-main">
          {g.videos.length > 0 && (
            <section>
              <h2>Vidéos</h2>
              <VideoPlayer videos={g.videos} title={g.name} />
            </section>
          )}
          {!demo && <LiveStreams name={g.name} igdbId={g.igdbId} />}
          {g.screenshots.length > 0 && (
            <section>
              <h2>
                Photos <span className="count mono">{g.screenshots.length}</span>
              </h2>
              <ScreenshotGallery shots={g.screenshots} title={g.name} />
            </section>
          )}
          <section>
            <h2>Description</h2>
            {g.description ? (
              <>
                <ReadMore text={g.description} />
                {!demo && <p className="muted small">Texte en anglais, fourni par {g.sources.map((s) => SOURCE_NAME[s]).join(" et ")}.</p>}
              </>
            ) : (
              <p className="muted">Pas encore de description pour ce jeu.</p>
            )}
          </section>
        </div>

        <aside className="game-aside">
          <h2>Infos</h2>
          <dl className="game-facts">
            <Fact label="Sortie">{g.released ? longDate(g.released) : "Inconnue"}</Fact>
            {g.platforms.length > 0 && (
              <Fact label="Plateformes">
                <span className="tags">
                  {g.platforms.map((p) => (
                    <span key={p} className="tag">{p}</span>
                  ))}
                </span>
              </Fact>
            )}
            {g.genres.length > 0 && <Fact label="Genres">{list(g.genres.map((x) => x.name))}</Fact>}
            {g.developers.length > 0 && <Fact label="Développeur">{list(g.developers)}</Fact>}
            {g.publishers.length > 0 && <Fact label="Éditeur">{list(g.publishers)}</Fact>}
            {g.modes.length > 0 && <Fact label="Modes de jeu">{list(g.modes)}</Fact>}
            {g.playtime > 0 && <Fact label="Durée moyenne">{g.playtime} h</Fact>}
            {g.ageRating && <Fact label="Âge">{g.ageRating}</Fact>}
            {g.website && (
              <Fact label="Site officiel">
                <a href={g.website} target="_blank" rel="noreferrer" className="link">
                  {hostname(g.website)} ↗
                </a>
              </Fact>
            )}
            {g.links.length > 0 && (
              <Fact label="Voir aussi">
                {g.links.map((l, i) => (
                  <span key={l.url}>
                    {i > 0 && " · "}
                    <a href={l.url} target="_blank" rel="noreferrer" className="link">
                      {SOURCE_NAME[l.source]} ↗
                    </a>
                  </span>
                ))}
              </Fact>
            )}
          </dl>
        </aside>
      </div>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Scores({ game: g }: { game: GameDetails }) {
  if (g.rating <= 0 && g.press === null && g.playtime <= 0) return null;
  return (
    <ul className="scores">
      {g.rating > 0 && (
        <li>
          <strong className="mono gold">★ {g.rating.toFixed(1)}</strong>
          <span>
            Joueurs{g.ratingCount > 0 && ` · ${g.ratingCount.toLocaleString("fr-FR")} avis`}
          </span>
        </li>
      )}
      {g.press !== null && (
        <li>
          <strong className={`mono press ${g.press >= 75 ? "good" : g.press >= 50 ? "mid" : "low"}`}>{g.press}</strong>
          <span>Presse / 100</span>
        </li>
      )}
      {g.playtime > 0 && (
        <li>
          <strong className="mono">{g.playtime} h</strong>
          <span>Durée moyenne</span>
        </li>
      )}
    </ul>
  );
}
