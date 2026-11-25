"use client";

import { useRouter } from "next/navigation";

/** Retour à la page précédente (ou à l'accueil si on arrive directement sur la fiche). */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="back-button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      ← Retour
    </button>
  );
}
