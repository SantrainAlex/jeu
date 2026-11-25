import type { Game } from "@/lib/rawg";
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
        <h3>{game.name}</h3>
        <p className="muted">Sortie le {date}</p>
        <div className="tags">
          {game.genres.slice(0, 3).map((g) => (
            <span key={g.slug} className="tag">{g.name}</span>
          ))}
        </div>
        {game.rating > 0 && <p className="rating">★ {game.rating.toFixed(1)} / 5 <span className="muted">(RAWG)</span></p>}
        {extra}
        <RatingStars game={game} />
      </div>
    </article>
  );
}
