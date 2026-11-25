import type { MetadataRoute } from "next";

/** Fiche de l'application : permet d'installer le site sur l'écran d'accueil du téléphone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jeu — les nouveautés par plateforme",
    short_name: "Jeu",
    description: "Les nouveaux jeux vidéo par plateforme, tes notes, tes recommandations et tes cartes à collectionner.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0b0f",
    theme_color: "#0a0b0f",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
