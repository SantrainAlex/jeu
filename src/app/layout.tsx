import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CloudStarter } from "@/components/CloudStarter";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";
import { SITE_NAME, SITE_TITLE } from "@/lib/site";

// Design Raidly : Bricolage Grotesque pour les titres, Schibsted Grotesk pour le texte,
// Martian Mono pour les chiffres et les surtitres.
// Les polices sont rangées avec le site (dossier fonts/) : la mise en ligne ne dépend pas de Google Fonts,
// qui faisait parfois échouer la construction sur Vercel.
const display = localFont({
  src: "./fonts/bricolage-grotesque-latin-var.woff2",
  weight: "500 800",
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: "./fonts/schibsted-grotesk-latin-var.woff2",
  weight: "400 800",
  variable: "--font-body",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/martian-mono-latin-var.woff2",
  weight: "400 700",
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: "Les nouveaux jeux vidéo du jour, de la semaine et du mois, plateforme par plateforme.",
  applicationName: SITE_NAME,
  // iPhone : nom, icône et barre d'état quand le site est ajouté à l'écran d'accueil
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#13110e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" data-theme="dark" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <CloudStarter />
        <SiteNav />
        <main className="container">{children}</main>
        <footer className="site-footer">
          Données des jeux fournies par <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a> et{" "}
          <a href="https://www.igdb.com" target="_blank" rel="noreferrer">IGDB</a>.
        </footer>
        <InstallPrompt />
      </body>
    </html>
  );
}
