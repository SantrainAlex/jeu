"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Shot } from "@/lib/details";

/** Galerie de captures d'écran ; un clic ouvre la photo en grand (flèches du clavier, glisser sur téléphone). */
export function ScreenshotGallery({ shots, title }: { shots: Shot[]; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const show = (i: number) => {
    setOpen(i);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const move = useCallback(
    (step: number) => setOpen((i) => (i === null ? i : (i + step + shots.length) % shots.length)),
    [shots.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, move]);

  return (
    <>
      <ul className="shots">
        {shots.map((s, i) => (
          <li key={s.thumb}>
            <button type="button" onClick={() => show(i)} aria-label={`Agrandir la photo ${i + 1} sur ${shots.length}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.thumb} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={`Photos de ${title}`}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === e.currentTarget && close()}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {open !== null && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shots[open].full} alt={`${title}, photo ${open + 1}`} />
            <span className="lightbox-count mono">
              {open + 1} / {shots.length}
            </span>
            <button type="button" className="lightbox-close" onClick={close} aria-label="Fermer">✕</button>
            {shots.length > 1 && (
              <>
                <button type="button" className="lightbox-nav prev" onClick={() => move(-1)} aria-label="Photo précédente">‹</button>
                <button type="button" className="lightbox-nav next" onClick={() => move(1)} aria-label="Photo suivante">›</button>
              </>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
