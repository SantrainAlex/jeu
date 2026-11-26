"use client";

import { rateGame, removeRating, useStore } from "@/lib/store";
import type { Game } from "@/lib/types";
import { Icon } from "./Icon";

export function RatingStars({ game }: { game: Game }) {
  const [{ ratings }, ready] = useStore();
  const current = ratings[game.id]?.stars ?? 0;

  return (
    <div className="my-rating" aria-label="Ma note">
      <span className="muted">{current ? "Ma note :" : "J'y ai joué :"}</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= current ? "star on" : "star"}
          disabled={!ready}
          title={`${n} sur 5`}
          aria-label={`Noter ${n} sur 5`}
          onClick={() =>
            n === current
              ? removeRating(game.id)
              : rateGame(
                  {
                    id: game.id,
                    slug: game.slug,
                    name: game.name,
                    image: game.image,
                    released: game.released,
                    genres: game.genres,
                  },
                  n,
                )
          }
        >
          <Icon name="star" size={20} filled={n <= current} />
        </button>
      ))}
    </div>
  );
}
