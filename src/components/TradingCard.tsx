"use client";

import { useRef } from "react";
import { rarityInfo, type Card } from "@/lib/cards";
import type { Finish } from "@/lib/data";
import { Logo } from "./Logo";
import { RarityGlyph } from "./RarityGlyph";

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
  onOpen,
  style,
}: {
  card: Card;
  vitrail?: number;
  count?: number;
  badge?: "new" | "dup";
  finish?: Finish;
  hidden?: boolean;
  onReveal?: () => void;
  /** clic sur une carte déjà retournée : l'ouvrir en grand */
  onOpen?: () => void;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const r = rarityInfo(card.rarity);
  const year = card.released?.slice(0, 4);
  // la jaquette verticale a déjà la forme d'une carte ; sinon, l'image large du jeu
  const art = card.cover ?? card.image;
  const className = ["tcard", `rarity-${card.rarity}`, vitrail ? "vitrail" : "", finish ? `finish-${finish}` : "", hidden ? "hidden" : "revealed", onOpen && !hidden ? "zoomable" : ""].join(" ");

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
      onClick={hidden ? onReveal : onOpen}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={hidden ? "Retourner la carte" : `${card.name}, ${r.label}${vitrail ? `, vitrail numéro ${vitrail}` : ""}${finish ? `, finition ${FINISH_LABEL[finish]}` : ""}${badge === "new" ? ", nouvelle carte" : badge === "dup" ? ", doublon" : ""}${onOpen ? ", voir en grand" : ""}`}
      tabIndex={hidden || onOpen ? 0 : -1}
    >
      <span className="tcard-inner">
        <span className="tcard-back" aria-hidden="true">
          <span className="tcard-back-logo">
            <Logo size={44} wordmark={false} />
          </span>
        </span>
        <span className="tcard-front">
          <span className="tcard-art">
            {art ? (
              <>
                {/* l'image entière, posée sur un fond flou de la même image pour remplir la carte */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="tcard-art-bg" src={art} alt="" loading="lazy" draggable={false} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="tcard-art-img" src={art} alt="" loading="lazy" draggable={false} />
              </>
            ) : (
              <span className="tcard-placeholder">{card.name.slice(0, 1)}</span>
            )}
          </span>
          <span className="tcard-name">{card.name}</span>
          <span className="tcard-meta">
            <span className="tcard-rarity">
              <RarityGlyph rarity={vitrail ? "vitrail" : card.rarity} size={12} />
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
