"use client";

import { usePathname, useSearchParams } from "next/navigation";

const loupe = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/**
 * Barre de recherche de l'en-tête : cherche un jeu sur toutes les plateformes (page /recherche).
 * Un simple formulaire : il marche même avant que la page soit complètement chargée.
 */
export function HeaderSearch() {
  const path = usePathname();
  const q = useSearchParams()?.get("q") ?? "";
  const current = path === "/recherche" ? q : "";
  return (
    <form className="header-search" action="/recherche" role="search">
      {loupe}
      {/* key : le champ se remet à jour quand on change de recherche ou de page */}
      <input key={current} type="search" name="q" defaultValue={current} placeholder="Rechercher un jeu…" aria-label="Rechercher un jeu" enterKeyHint="search" />
    </form>
  );
}

/** Version vide, affichée le temps que l'adresse de la page soit connue. */
export function HeaderSearchFallback() {
  return (
    <form className="header-search" action="/recherche" role="search">
      {loupe}
      <input type="search" name="q" placeholder="Rechercher un jeu…" aria-label="Rechercher un jeu" enterKeyHint="search" />
    </form>
  );
}
