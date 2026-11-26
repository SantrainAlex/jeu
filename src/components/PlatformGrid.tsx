"use client";

import Link from "next/link";
import { PLATFORMS, type Platform } from "@/lib/platforms";
import { useStore } from "@/lib/store";
import { Icon } from "./Icon";
import { PlatformMark } from "./PlatformMark";

function Card({ p, badge }: { p: Platform; badge?: string }) {
  return (
    <Link href={`/plateforme/${p.slug}`} className={badge ? "platform-card mine" : "platform-card"}>
      <PlatformMark slug={p.slug} />
      <span className="platform-name">
        {p.name}
        {badge && <small className="badge">{badge}</small>}
      </span>
      <Icon name="chevron-right" size={18} className="arrow" />
    </Link>
  );
}

export function PlatformGrid() {
  const [{ profile }] = useStore();
  const mine = PLATFORMS.filter((p) => profile.owned.includes(p.slug) || profile.interested.includes(p.slug));
  const others = PLATFORMS.filter((p) => !mine.includes(p));
  const badge = (p: Platform) => (profile.owned.includes(p.slug) ? "Je l'ai" : "M'intéresse");

  if (mine.length === 0) {
    return (
      <>
        <p className="notice">
          Astuce : indique tes plateformes dans <Link href="/profil">ton profil</Link> pour les voir en premier.
        </p>
        <div className="platform-grid">{PLATFORMS.map((p) => <Card key={p.slug} p={p} />)}</div>
      </>
    );
  }

  return (
    <>
      <h2>Mes plateformes</h2>
      <div className="platform-grid">{mine.map((p) => <Card key={p.slug} p={p} badge={badge(p)} />)}</div>
      {others.length > 0 && (
        <details className="others">
          <summary>Autres plateformes ({others.length})</summary>
          <div className="platform-grid">{others.map((p) => <Card key={p.slug} p={p} />)}</div>
        </details>
      )}
    </>
  );
}
