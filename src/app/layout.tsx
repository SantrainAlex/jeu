import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Inter, JetBrains_Mono } from "next/font/google";
import { CloudStarter } from "@/components/CloudStarter";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";
import { SITE_NAME, SITE_TITLE } from "@/lib/site";

// Titres « gaming », texte lisible, et chiffres à chasse fixe (notes, pourcentages, numéros)
const display = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: "Les nouveaux jeux vidéo du jour, de la semaine et du mois, plateforme par plateforme.",
  applicationName: SITE_NAME,
  // iPhone : nom, icône et barre d'état quand le site est ajouté à l'écran d'accueil
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0a0b0f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
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
