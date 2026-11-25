"use client";

import { useEffect } from "react";
import { startCloud } from "@/lib/cloud";

/** Démarre la connexion au compte dès l'ouverture du site (ne s'affiche pas). */
export function CloudStarter() {
  useEffect(() => startCloud(), []);
  return null;
}
