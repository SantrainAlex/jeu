"use client";

import Link from "next/link";
import { cloudEnabled, useCloud } from "@/lib/cloud";

/** Lien « Se connecter » ou « Mon compte » dans le menu. */
export function AccountLink() {
  const cloud = useCloud();
  if (!cloudEnabled) return null;
  if (cloud.status === "signedIn") {
    return (
      <Link href="/connexion" className="account-link" title={cloud.email ?? undefined}>
        👤 Mon compte
      </Link>
    );
  }
  return (
    <Link href="/connexion" className="account-link login">
      Se connecter
    </Link>
  );
}
