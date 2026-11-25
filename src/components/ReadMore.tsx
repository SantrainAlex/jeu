"use client";

import { useState } from "react";

/** Un long texte replié, avec un bouton « Lire la suite ». */
export function ReadMore({ text, limit = 700 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  const shown = open || !long ? text : text.slice(0, text.lastIndexOf(" ", limit)) + "…";
  return (
    <div className="read-more">
      {shown.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {long && (
        <button type="button" className="chip" onClick={() => setOpen(!open)}>
          {open ? "Réduire" : "Lire la suite"}
        </button>
      )}
    </div>
  );
}
