"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TradingCard } from "@/components/TradingCard";
import type { Card } from "@/lib/cards";
import { gameHref } from "@/lib/details";
import type { Finish } from "@/lib/data";
import { Icon } from "./Icon";

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

/**
 * Position du reflet (holo, brillance) selon l'inclinaison de la carte : il glisse d'un bord à l'autre
 * quand la carte tourne, et monte ou descend quand on la penche. Carte posée à plat : reflet au centre.
 */
function shine(angle: number, tilt: number) {
  // angle ramené entre -90° et 90° autour du côté visible
  const a = ((((angle + 90) % 180) + 180) % 180) - 90;
  return { "--vx": `${50 + (a / 90) * 70}%`, "--vy": `${50 - (tilt / 18) * 40}%` };
}

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
  const [tilt, setTilt] = useState(0);
  const drag = useRef<{ x: number; y: number; start: number; width: number; moved: boolean } | null>(null);

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
    drag.current = { x: e.clientX, y: e.clientY, start: angle, width: e.currentTarget.offsetWidth || 300, moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true;
    // glisser sur toute la largeur de la carte ≈ un demi-tour ; glisser en hauteur penche un peu la carte
    setAngle(d.start + (dx / d.width) * 200);
    setTilt(Math.max(-18, Math.min(18, (-dy / d.width) * 40)));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    setTilt(0);
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
            style={{ "--flip": `${angle}deg`, "--tilt": `${tilt}deg`, ...shine(angle, tilt) } as React.CSSProperties}
            role="button"
            tabIndex={0}
            aria-label={`${shown.card.name} : ${backSide ? "dos" : "face"} de la carte. Glisse ou appuie pour la retourner.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
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
          <p className="card-viewer-hint muted">Glisse la carte pour la retourner</p>
          <Link href={gameHref(shown.card)} className="button">
            Voir la fiche du jeu
          </Link>
          <button type="button" className="lightbox-close" onClick={close} aria-label="Fermer">
            <Icon name="close" size={20} />
          </button>
        </div>
      )}
    </dialog>
  );

  return { open, element };
}
