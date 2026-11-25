"use client";

import Link from "next/link";
import { cloudEnabled, useCloud } from "@/lib/cloud";

/** Bouton « Se connecter » ou pastille du compte, en haut à droite. */
export function AccountLink() {
  const cloud = useCloud();
  if (!cloudEnabled) return <span className="account-spacer" />;
  if (cloud.status === "signedIn") {
    const initial = (cloud.email ?? "?").slice(0, 1).toUpperCase();
    return (
      <Link href="/connexion" className="account-avatar" title={cloud.email ?? "Mon compte"} aria-label="Mon compte">
        {initial}
      </Link>
    );
  }
  return (
    <Link href="/connexion" className="account-link login">
      Se connecter
    </Link>
  );
}
