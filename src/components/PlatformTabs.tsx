import Link from "next/link";
import { PERIODS, type Period, type Platform } from "@/lib/platforms";
import { Icon } from "./Icon";

/** Onglets d'une plateforme : nouveautés (jour, semaine, mois) et catalogue complet. */
export function PlatformTabs({ platform, active }: { platform: Platform; active: Period | "catalogue" }) {
  const tabs = [
    ...(Object.keys(PERIODS) as Period[]).map((p) => ({
      key: p,
      label: PERIODS[p].label,
      href: `/plateforme/${platform.slug}?periode=${p}`,
    })),
    { key: "catalogue", label: "Catalogue", href: `/plateforme/${platform.slug}/catalogue` },
  ];
  return (
    <>
      <p><Link href="/" className="muted back-link"><Icon name="chevron-left" size={16} /> Toutes les plateformes</Link></p>
      <h1>{platform.name}</h1>
      <nav className="tabs" aria-label="Sections">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} className={t.key === active ? "tab active" : "tab"} aria-current={t.key === active ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
