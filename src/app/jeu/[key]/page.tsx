import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BackButton } from "@/components/BackButton";
import { LiveStreams } from "@/components/LiveStreams";
import { RatingStars } from "@/components/RatingStars";
import { ReadMore } from "@/components/ReadMore";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WhereToBuy } from "@/components/WhereToBuy";
import { toGame, type GameDetails } from "@/lib/details";
import { getGameDetails } from "@/lib/games";
import { gamePlatforms } from "@/lib/platforms";
import { PlayerPerf } from "@/components/PlayerPerf";
import { hasPrices, shopLinks } from "@/lib/shops";
import { SITE_NAME } from "@/lib/site";
import { Icon } from "@/components/Icon";
import { PlatformMark } from "@/components/PlatformMark";
import { ExternalLabel } from "@/components/ExternalLabel";

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
  if (!result || result === "error") return { title: `Fiche du jeu — ${SITE_NAME}` };
  return {
    title: `${result.details.name} — ${SITE_NAME}`,
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
            <PlatformBadges names={g.platforms} />
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
                {g.descriptionFr ? (
                  g.descriptionEn && (
                    <details className="more-en">
                      <summary>Description complète (en anglais)</summary>
                      <ReadMore text={g.descriptionEn} />
                    </details>
                  )
                ) : (
                  !demo && <p className="muted small">Texte en anglais, fourni par {g.sources.map((s) => SOURCE_NAME[s]).join(" et ")}.</p>
                )}
              </>
            ) : (
              <p className="muted">Pas encore de description pour ce jeu.</p>
            )}
          </section>
          {g.pcRequirements && (
            <section>
              <h2>Configuration PC</h2>
              <div className="specs">
                {(
                  [
                    ["Minimum", g.pcRequirements.minimum],
                    ["Recommandée", g.pcRequirements.recommended],
                  ] as const
                ).map(
                  ([title, rows]) =>
                    rows.length > 0 && (
                      <div key={title} className="spec-card">
                        <h3>{title}</h3>
                        <dl>
                          {rows.map((row) => (
                            <div key={row.label}>
                              <dt>{row.label}</dt>
                              <dd>{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ),
                )}
              </div>
              <p className="muted small">D&apos;après la page Steam du jeu.</p>
            </section>
          )}
          {!demo && <Performance game={g} />}
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
            {controllerText(g) && <Fact label="Manette">{controllerText(g)}</Fact>}
            {g.playtime > 0 && <Fact label="Durée moyenne">{g.playtime} h</Fact>}
            {g.ageRating && <Fact label="Âge">{g.ageRating}</Fact>}
            {g.website && (
              <Fact label="Site officiel">
                <a href={g.website} target="_blank" rel="noreferrer" className="link">
                  <ExternalLabel>{hostname(g.website)}</ExternalLabel>
                </a>
              </Fact>
            )}
            {g.links.length > 0 && (
              <Fact label="Voir aussi">
                {g.links.map((l, i) => (
                  <span key={l.url}>
                    {i > 0 && " · "}
                    <a href={l.url} target="_blank" rel="noreferrer" className="link">
                      <ExternalLabel>{SOURCE_NAME[l.source]}</ExternalLabel>
                    </a>
                  </span>
                ))}
              </Fact>
            )}
          </dl>
          {!demo && !upcoming && <WhereToBuy name={g.name} stores={g.freeToPlay ? [] : g.stores} links={shopLinks(g)} withPrices={hasPrices() && !g.freeToPlay} free={g.freeToPlay} />}
        </aside>
      </div>
    </article>
  );
}

const isConsole = (p: string) => /playstation|xbox|nintendo|switch|wii/i.test(p);

/** « Jouable à la manette ? » : d'après Steam (ou RAWG) sur PC, et toujours oui sur console. */
function controllerText(g: GameDetails): string | null {
  const pc = g.controller === "full" ? "entièrement" : g.controller === "partial" ? "en partie" : null;
  const console = g.platforms.some(isConsole);
  if (pc && console) return `Oui (sur PC : ${pc})`;
  if (pc) return pc === "entièrement" ? "Oui, entièrement" : "En partie";
  if (console) return g.platforms.some((p) => /^pc$|windows/i.test(p)) ? "Oui sur console (pas indiqué sur PC)" : "Oui";
  return null;
}

/** « Disponible sur » : les plateformes du jeu, bien visibles, avec un lien vers leurs nouveautés. */
function PlatformBadges({ names }: { names: string[] }) {
  const { known, others } = gamePlatforms(names);
  if (known.length === 0 && others.length === 0) return null;
  return (
    <div className="platform-badges" aria-label="Disponible sur">
      {known.map((p) => (
        <Link key={p.slug} href={`/plateforme/${p.slug}`} className="platform-badge">
          <PlatformMark slug={p.slug} size="sm" />
          {p.short}
        </Link>
      ))}
      {others.slice(0, 4).map((o) => (
        <span key={o} className="platform-badge other">{o}</span>
      ))}
    </div>
  );
}

/**
 * « Sur quelle plateforme y jouer ? » : aucune source automatique ne donne la résolution et les FPS par console,
 * alors on montre l'avis des joueurs du site, et on renvoie vers les analyses qui les mesurent
 * (Digital Foundry, backwards-compatible.com, comparatifs).
 */
function Performance({ game: g }: { game: GameDetails }) {
  const { known } = gamePlatforms(g.platforms);
  if (known.length === 0) return null;
  const several = known.length >= 2;
  const q = (text: string) => encodeURIComponent(text);
  const consoles = known.filter((p) => p.slug !== "pc" && p.slug !== "mobile").map((p) => p.short);
  const versus = known.filter((p) => p.slug !== "mobile").map((p) => p.short).slice(0, 3).join(" vs ");
  const links = [
    { label: "Analyse Digital Foundry", hint: "résolution et FPS mesurés", url: `https://www.youtube.com/results?search_query=${q(`Digital Foundry ${g.name}`)}` },
    ...(several && versus.includes(" vs ")
      ? [{ label: `Comparatif ${versus}`, hint: "les versions côte à côte", url: `https://www.youtube.com/results?search_query=${q(`${g.name} ${versus} comparison`)}` }]
      : []),
    ...(consoles.length
      ? [{ label: "backwards-compatible.com", hint: "résolution et FPS par console", url: `https://www.google.com/search?q=${q(`site:backwards-compatible.com ${g.name}`)}` }]
      : []),
  ];
  return (
    <section>
      <h2>{several ? "Sur quelle plateforme y jouer ?" : "Résolution et FPS"}</h2>
      <p className="muted perf-intro">
        {several
          ? <>Le jeu sort sur {known.map((p) => p.short).join(", ")}. La résolution et les FPS changent d&apos;une plateforme à l&apos;autre.</>
          : <>Le jeu sort sur {known[0].short}.</>}
        {g.pcRequirements && known.some((p) => p.slug === "pc") && " Sur PC, ça dépend de ta machine (voir la configuration ci-dessus)."}
      </p>
      <PlayerPerf gameId={g.id} platforms={known.map((p) => ({ slug: p.slug, short: p.short, color: p.color }))} />
      <h3 className="perf-links-title">Les analyses qui les mesurent</h3>
      <div className="perf-links">
        {links.map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="perf-link">
            <strong className="ext-title"><ExternalLabel>{l.label}</ExternalLabel></strong>
            <span className="muted">{l.hint}</span>
          </a>
        ))}
      </div>
    </section>
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
          <strong className="mono gold"><Icon name="star" size={14} filled /> {g.rating.toFixed(1).replace(".", ",")}</strong>
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
