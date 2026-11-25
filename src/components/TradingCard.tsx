"use client";

import { useRef } from "react";
import { rarityInfo, type Card } from "@/lib/cards";
import type { Finish } from "@/lib/data";

const FINISH_LABEL: Record<Finish, string> = { argent: "Argent", or: "Or" };

/**
 * Une carte à collectionner, qui s'incline en 3D sous la souris avec un reflet holographique.
 * `vitrail` = numéro du vitrail ; `hidden` = face cachée (avant révélation) ;
 * `badge` = « Nouvelle ! » ou « Doublon » à l'ouverture d'un booster ; `finish` = finition argent ou or.
 */
export function TradingCard({
  card,
  vitrail,
  count,
  badge,
  finish,
  hidden = false,
  onReveal,
  style,
}: {
  card: Card;
  vitrail?: number;
  count?: number;
  badge?: "new" | "dup";
  finish?: Finish;
  hidden?: boolean;
  onReveal?: () => void;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const r = rarityInfo(card.rarity);
  const year = card.released?.slice(0, 4);
  const className = ["tcard", `rarity-${card.rarity}`, vitrail ? "vitrail" : "", finish ? `finish-${finish}` : "", hidden ? "hidden" : "revealed"].join(" ");

  // position de la souris sur la carte → inclinaison et reflet
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || hidden || e.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${(0.5 - y) * 16}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 20}deg`);
    el.style.setProperty("--glare", "1");
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glare", "0");
  };

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      style={{ "--rarity": r.color, ...style } as React.CSSProperties}
      onClick={hidden ? onReveal : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={hidden ? "Retourner la carte" : `${card.name}, ${r.label}${vitrail ? `, vitrail numéro ${vitrail}` : ""}${finish ? `, finition ${FINISH_LABEL[finish]}` : ""}${badge === "new" ? ", nouvelle carte" : badge === "dup" ? ", doublon" : ""}`}
      tabIndex={hidden ? 0 : -1}
    >
      <span className="tcard-inner">
        <span className="tcard-back" aria-hidden="true">
          <span className="tcard-back-logo">J</span>
        </span>
        <span className="tcard-front">
          <span className="tcard-art">
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image} alt="" loading="lazy" draggable={false} />
            ) : (
              <span className="tcard-placeholder">{card.name.slice(0, 1)}</span>
            )}
          </span>
          <span className="tcard-name">{card.name}</span>
          <span className="tcard-meta">
            <span className="tcard-rarity">
              {vitrail ? `Vitrail n° ${vitrail}` : r.label}
              {finish && <span className="tcard-finish"> · {FINISH_LABEL[finish]}</span>}
            </span>
            {year && <span className="mono">{year}</span>}
          </span>
          {count && count > 1 ? <span className="tcard-count mono">×{count}</span> : null}
          {badge && (
            <span className={`tcard-badge ${badge}`} aria-hidden="true">
              {badge === "new" ? "Nouvelle !" : "Doublon"}
            </span>
          )}
          <span className="tcard-holo" aria-hidden="true" />
          <span className="tcard-glare" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}
