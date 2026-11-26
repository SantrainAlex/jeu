"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TradingCard } from "@/components/TradingCard";
import type { Card } from "@/lib/cards";
import { gameHref } from "@/lib/details";
import type { Finish } from "@/lib/data";

export type ViewedCard = { card: Card; vitrail?: number; count?: number; finish?: Finish };

/**
 * Montre une carte en grand. Un clic (ou « Retourner ») la fait tourner pour voir son dos.
 * Utilisation : `const viewer = useCardViewer();` puis `onOpen={() => viewer.open({ card })}` et `{viewer.element}`.
 */
export function useCardViewer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<ViewedCard | null>(null);
  const [flipped, setFlipped] = useState(false);

  const open = useCallback((c: ViewedCard) => {
    setShown(c);
    setFlipped(false);
  }, []);
  const close = () => dialog.current?.close();

  // ouvre la fenêtre une fois la carte prête à être affichée
  useEffect(() => {
    if (shown && !dialog.current?.open) dialog.current?.showModal();
  }, [shown]);

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
          <div className="card-viewer-card">
            <TradingCard
              card={shown.card}
              vitrail={shown.vitrail}
              count={shown.count}
              finish={shown.finish}
              flipped={flipped}
              onOpen={() => setFlipped((f) => !f)}
            />
          </div>
          <div className="card-viewer-actions">
            <button type="button" className="button ghost" onClick={() => setFlipped((f) => !f)}>
              ↻ Retourner la carte
            </button>
            <Link href={gameHref(shown.card)} className="button">
              Voir la fiche du jeu
            </Link>
          </div>
          <button type="button" className="lightbox-close" onClick={close} aria-label="Fermer">
            ✕
          </button>
        </div>
      )}
    </dialog>
  );

  return { open, element };
}
