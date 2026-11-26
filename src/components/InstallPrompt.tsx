"use client";

import { useEffect, useState } from "react";
import { DISMISS_KEY, type InstallPlatform, detectPlatform, isDismissed } from "@/lib/install";
import { SITE_NAME } from "@/lib/site";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Partager" role="img" className="install-inline-icon">
    <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

function safeGet(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* navigation privée : tant pis */ }
}

/**
 * Sur téléphone, propose d'installer le site comme une application.
 * Android : bouton « Installer » (fenêtre du navigateur).
 * iPhone : rappel du geste « Partager → Sur l'écran d'accueil ».
 * Refermée, la bannière ne revient pas avant 30 jours. Rien ne s'affiche si l'app est déjà installée.
 */
export function InstallPrompt() {
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const p = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);
    if (standalone || p === "other" || isDismissed(safeGet(DISMISS_KEY))) return;
    setPlatform(p);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      timer = setTimeout(() => setVisible(true), 2500);
    };
    const onInstalled = () => { setVisible(false); setDeferred(null); };

    if (p === "ios") {
      timer = setTimeout(() => setVisible(true), 2500);
    } else {
      // Chrome, Edge, Samsung Internet : on attend que le navigateur confirme que l'installation est possible.
      window.addEventListener("beforeinstallprompt", onPrompt);
    }
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const close = () => {
    safeSet(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setVisible(false);
    else close();
  };

  if (!visible) return null;

  return (
    <div className="install-banner" role="dialog" aria-label="Installer l'application">
      {/* eslint-disable-next-line @next/next/no-img-element -- petite icône fixe */}
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="install-icon" />
      <div className="install-text">
        <strong>Installe l&apos;app {SITE_NAME}</strong>
        {platform === "ios" ? (
          <span>
            Touche <ShareIcon /> <b>Partager</b>, puis <b>Sur l&apos;écran d&apos;accueil</b>.
          </span>
        ) : (
          <span>En plein écran, depuis ton accueil.</span>
        )}
      </div>
      {platform === "android" && deferred && (
        <button type="button" className="button install-cta" onClick={install}>
          Installer
        </button>
      )}
      <button type="button" className="install-close" onClick={close} aria-label="Fermer">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
