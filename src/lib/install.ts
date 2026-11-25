/** Détection de l'appareil pour proposer l'installation de l'application. */

export type InstallPlatform = "ios" | "android" | "other";

export function detectPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // Les iPad récents se présentent comme un Mac : on les reconnaît à l'écran tactile.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/** Durée pendant laquelle la bannière reste cachée après avoir été refermée. */
export const DISMISS_DAYS = 30;
export const DISMISS_KEY = "jeu:install-dismissed";

export function isDismissed(value: string | null, now = Date.now()): boolean {
  if (!value) return false;
  const at = Number(value);
  if (!Number.isFinite(at)) return false;
  return now - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}
