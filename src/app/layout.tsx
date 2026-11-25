import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jeu — les nouveautés par plateforme",
  description: "Les nouveaux jeux vidéo du jour, de la semaine et du mois, plateforme par plateforme.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <Link href="/" className="logo">🎮 Jeu</Link>
          <nav>
            <Link href="/">Plateformes</Link>
            <Link href="/recommandations">Recommandations</Link>
            <Link href="/mes-notes">Mes notes</Link>
            <Link href="/profil">Mon profil</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          Données des jeux fournies par <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>.
        </footer>
      </body>
    </html>
  );
}
