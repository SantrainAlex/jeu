"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AccountLink } from "./AccountLink";
import { HeaderSearch, HeaderSearchFallback } from "./HeaderSearch";
import { SITE_NAME } from "@/lib/site";

type Item = { href: string; label: string; icon: React.ReactNode; match: (p: string) => boolean };

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const ITEMS: Item[] = [
  { href: "/", label: "Jeux", icon: icon("M6 11h4M8 9v4M15 12h.01M18 10h.01M17.3 5H6.7a4 4 0 0 0-3.95 3.4L2 14.6A2.6 2.6 0 0 0 6.6 16.8L9 14h6l2.4 2.8a2.6 2.6 0 0 0 4.6-2.2l-.75-6.2A4 4 0 0 0 17.3 5Z"), match: (p) => p === "/" || p.startsWith("/plateforme") },
  { href: "/recommandations", label: "Pour toi", icon: icon("M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7Z"), match: (p) => p.startsWith("/recommandations") },
  { href: "/cartes", label: "Cartes", icon: icon("M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 7v11a3 3 0 0 0 3 3"), match: (p) => p.startsWith("/cartes") },
  { href: "/mes-notes", label: "Mes notes", icon: icon("M4 6h16M4 12h10M4 18h7M17 15l1.5 3 3 .4-2.2 2.1.5 3-2.8-1.5"), match: (p) => p.startsWith("/mes-notes") },
  { href: "/profil", label: "Profil", icon: icon("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0"), match: (p) => p.startsWith("/profil") || p.startsWith("/connexion") },
];

/** En-tête fixe (ordinateur) et barre d'onglets en bas de l'écran (téléphone). */
export function SiteNav() {
  const path = usePathname() ?? "/";
  return (
    <>
      <header className="site-header">
        <Link href="/" className="logo">
          <span className="logo-mark">J</span>
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="top-nav" aria-label="Navigation principale">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className={it.match(path) ? "active" : undefined} aria-current={it.match(path) ? "page" : undefined}>
              {it.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<HeaderSearchFallback />}>
          <HeaderSearch />
        </Suspense>
        <AccountLink />
      </header>
      <nav className="tab-bar" aria-label="Navigation">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className={it.match(path) ? "active" : undefined} aria-current={it.match(path) ? "page" : undefined}>
            {it.icon}
            <span>{it.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
