import Link from "next/link";
import { gameHref } from "@/lib/details";
import type { Game } from "@/lib/types";
import { Icon } from "./Icon";
import { RatingStars } from "./RatingStars";

export function GameCard({ game, extra }: { game: Game; extra?: React.ReactNode }) {
  const date = game.released
    ? new Date(game.released).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "Date inconnue";
  return (
    <article className="game-card">
      <div className="game-image">
        {game.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.image} alt="" loading="lazy" />
        ) : (
          <div className="game-placeholder">{game.name.slice(0, 1)}</div>
        )}
      </div>
      <div className="game-body">
        <h3>
          {/* toute la carte est cliquable (voir .card-link), sauf les étoiles qui restent au-dessus */}
          <Link href={gameHref(game)} className="card-link">
            {game.name}
          </Link>
        </h3>
        <p className="muted">Sortie le {date}</p>
        <div className="tags">
          {game.genres.slice(0, 3).map((g) => (
            <span key={g.slug} className="tag">{g.name}</span>
          ))}
        </div>
        {game.rating > 0 && (
          <p className="rating">
            <Icon name="star" size={14} filled /> {game.rating.toFixed(1).replace(".", ",")} / 5
          </p>
        )}
        {game.sources.length > 0 && (
          <p className="sources">Source : {game.sources.map((s) => (s === "rawg" ? "RAWG" : "IGDB")).join(" + ")}</p>
        )}
        {extra}
        <RatingStars game={game} />
      </div>
    </article>
  );
}
