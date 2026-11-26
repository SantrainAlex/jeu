"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AccountLink } from "./AccountLink";
import { HeaderSearch, HeaderSearchFallback } from "./HeaderSearch";
import { SITE_NAME } from "@/lib/site";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";

type Item = { href: string; label: string; icon: IconName; match: (p: string) => boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Jeux", icon: "gamepad", match: (p) => p === "/" || p.startsWith("/plateforme") },
  { href: "/recommandations", label: "Pour toi", icon: "sparkle", match: (p) => p.startsWith("/recommandations") },
  { href: "/cartes", label: "Cartes", icon: "cards", match: (p) => p.startsWith("/cartes") },
  { href: "/mes-notes", label: "Mes notes", icon: "notes", match: (p) => p.startsWith("/mes-notes") },
  { href: "/profil", label: "Profil", icon: "user", match: (p) => p.startsWith("/profil") || p.startsWith("/connexion") },
];

/** En-tête fixe (ordinateur) et barre d'onglets en bas de l'écran (téléphone). */
export function SiteNav() {
  const path = usePathname() ?? "/";
  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand" aria-label={`${SITE_NAME}, accueil`}>
          <Logo size={28} />
        </Link>
        <nav className="top-nav" aria-label="Navigation principale">
          {ITEMS.map((it) => (
            <Link key={it.href} href={it.href} className={it.match(path) ? "active" : undefined} aria-current={it.match(path) ? "page" : undefined}>
              <Icon name={it.icon} size={18} />
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
            <Icon name={it.icon} size={22} />
            <span>{it.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
