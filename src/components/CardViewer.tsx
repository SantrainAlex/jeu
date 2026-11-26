"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TradingCard } from "@/components/TradingCard";
import type { Card } from "@/lib/cards";
import { gameHref } from "@/lib/details";
import type { Finish } from "@/lib/data";

export type ViewedCard = {
  card: Card;
  vitrail?: number;
  count?: number;
  finish?: Finish;
  /** titre au-dessus de la carte, ex. « Échange réussi ! » */
  title?: string;
  /** la carte arrive face cachée puis se retourne toute seule (carte qu'on vient de gagner) */
  reveal?: boolean;
};

/** angle de la carte arrondi au côté le plus proche (0 = face, 180 = dos, 360 = face…) */
const snap = (deg: number) => Math.round(deg / 180) * 180;

/**
 * Montre une carte en grand. On la fait tourner en la faisant glisser (doigt ou souris) :
 * elle suit le geste puis se pose sur sa face ou son dos. Un simple appui la retourne aussi.
 * Utilisation : `const viewer = useCardViewer();` puis `onOpen={() => viewer.open({ card })}` et `{viewer.element}`.
 */
export function useCardViewer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<ViewedCard | null>(null);
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; start: number; width: number; moved: boolean } | null>(null);

  const open = useCallback((c: ViewedCard) => {
    setShown(c);
    setAngle(c.reveal ? 180 : 0);
  }, []);
  const close = () => dialog.current?.close();

  // ouvre la fenêtre une fois la carte prête à être affichée
  useEffect(() => {
    if (shown && !dialog.current?.open) dialog.current?.showModal();
    if (!shown?.reveal) return;
    const t = setTimeout(() => setAngle(360), 450);
    return () => clearTimeout(t);
  }, [shown]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, start: angle, width: e.currentTarget.offsetWidth || 300, moved: false };
    setDragging(true);
  };
  // reflets (holo, brillance) : ils suivent le doigt ou la souris, comme dans l'album
  const light = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    el.style.setProperty("--vx", `${x * 100}%`);
    el.style.setProperty("--vy", `${y * 100}%`);
    el.dataset.live = "1";
  };
  const unlight = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current) return;
    delete e.currentTarget.dataset.live;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    light(e);
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    // glisser sur toute la largeur de la carte ≈ un demi-tour
    setAngle(d.start + (dx / d.width) * 200);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    const dx = e.clientX - d.x;
    if (!d.moved) {
      setAngle(d.start + 180); // simple appui : on retourne
      return;
    }
    let end = snap(d.start + (dx / d.width) * 200);
    // un petit coup de doigt suffit à retourner la carte
    if (end === d.start && Math.abs(dx) > 40) end = d.start + (dx > 0 ? 180 : -180);
    setAngle(end);
  };

  const backSide = Math.abs(snap(angle) / 180) % 2 === 1;

  const element = (
    <dialog
      ref={dialog}
      className="lightbox card-viewer"
      aria-label={shown ? `Carte ${shown.card.name}` : "Carte"}
      onClose={() => setShown(null)}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      {shown && (
        <div className="card-viewer-body" onClick={(e) => e.target === e.currentTarget && close()}>
          {shown.title && <p className="card-viewer-title">{shown.title}</p>}
          <div
            className={dragging ? "card-viewer-card dragging" : "card-viewer-card"}
            style={{ "--flip": `${angle}deg` } as React.CSSProperties}
            role="button"
            tabIndex={0}
            aria-label={`${shown.card.name} : ${backSide ? "dos" : "face"} de la carte. Glisse ou appuie pour la retourner.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={unlight}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
                e.preventDefault();
                setAngle((a) => snap(a) + 180);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                setAngle((a) => snap(a) - 180);
              }
            }}
          >
            <TradingCard card={shown.card} vitrail={shown.vitrail} count={shown.count} finish={shown.finish} />
          </div>
          <p className="card-viewer-hint muted">↔ Glisse la carte pour la retourner</p>
          <Link href={gameHref(shown.card)} className="button">
            Voir la fiche du jeu
          </Link>
          <button type="button" className="lightbox-close" onClick={close} aria-label="Fermer">
            ✕
          </button>
        </div>
      )}
    </dialog>
  );

  return { open, element };
}
