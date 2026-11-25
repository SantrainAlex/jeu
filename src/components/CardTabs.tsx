import Link from "next/link";

const TABS = [
  { key: "boosters", label: "Boosters", href: "/cartes" },
  { key: "album", label: "Mon album", href: "/cartes/album" },
  { key: "atelier", label: "Atelier", href: "/cartes/atelier" },
] as const;

/** Onglets de la partie cartes : boosters, album et atelier. */
export function CardTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="tabs" aria-label="Cartes">
      {TABS.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === active ? "tab active" : "tab"} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
