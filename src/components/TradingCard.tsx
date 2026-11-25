import { rarityInfo, type Card } from "@/lib/cards";

/** Une carte à collectionner. `vitrail` = numéro du vitrail ; `hidden` = face cachée (avant révélation). */
export function TradingCard({
  card,
  vitrail,
  count,
  hidden = false,
  onReveal,
}: {
  card: Card;
  vitrail?: number;
  count?: number;
  hidden?: boolean;
  onReveal?: () => void;
}) {
  const r = rarityInfo(card.rarity);
  const year = card.released?.slice(0, 4);
  const className = ["tcard", `rarity-${card.rarity}`, vitrail ? "vitrail" : "", hidden ? "hidden" : "revealed"].join(" ");

  return (
    <button
      type="button"
      className={className}
      style={{ "--rarity": r.color } as React.CSSProperties}
      onClick={hidden ? onReveal : undefined}
      aria-label={hidden ? "Retourner la carte" : `${card.name}, ${r.label}${vitrail ? `, vitrail numéro ${vitrail}` : ""}`}
      tabIndex={hidden ? 0 : -1}
    >
      <span className="tcard-inner">
        <span className="tcard-back" aria-hidden="true">
          <span>🎮</span>
        </span>
        <span className="tcard-front">
          <span className="tcard-art">
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image} alt="" loading="lazy" />
            ) : (
              <span className="tcard-placeholder">{card.name.slice(0, 1)}</span>
            )}
          </span>
          <span className="tcard-name">{card.name}</span>
          <span className="tcard-meta">
            <span className="tcard-rarity">{vitrail ? `Vitrail n° ${vitrail}` : r.label}</span>
            {year && <span>{year}</span>}
          </span>
          {count && count > 1 ? <span className="tcard-count">×{count}</span> : null}
        </span>
      </span>
    </button>
  );
}
