/**
 * Les codes promo : un joueur connecté tape un code et reçoit des boosters et/ou des pièces, une seule fois par compte.
 * Les règles sont ici, sans dépendance au navigateur ; c'est le serveur (/api/code-promo) qui les applique.
 */
import type { Collection } from "./data";
import type { Reward } from "./quests";

export type PromoCode = { code: string; reward: Reward; active?: boolean; expiresAt?: string | null };

/**
 * Les codes de base, toujours disponibles même sans table dans Supabase.
 * Pour en ajouter un sans toucher au code : une ligne dans la table `promo_codes` de Supabase
 * (une ligne de la table avec le même code remplace celui d'ici, par exemple pour le désactiver).
 */
export const BUILTIN_CODES: PromoCode[] = [{ code: "BIENVENUE", reward: { packs: 1, coins: 100 } }];

/** « Bienvenue », « bienvenue », « BIEN VENUE » ou « bienvenüe » donnent tous « BIENVENUE ». */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 60) return null;
  const code = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return code.length >= 2 && code.length <= 30 ? code : null;
}

/** Le code tel qu'il est connu (table Supabase d'abord, puis codes de base), ou null s'il n'existe pas. */
export function findCode(code: string, fromTable: PromoCode[] = []): PromoCode | null {
  const byCode = (list: PromoCode[]) => list.find((p) => normalizeCode(p.code) === code);
  return byCode(fromTable) ?? byCode(BUILTIN_CODES) ?? null;
}

export type PromoResult = { collection: Collection; reward: Reward; code: string } | { error: string };

/** Applique un code à la collection. Refuse un code inconnu, désactivé, expiré ou déjà utilisé sur ce compte. */
export function redeemCode(c: Collection, raw: unknown, fromTable: PromoCode[] = [], now = Date.now()): PromoResult {
  const code = normalizeCode(raw);
  const promo = code && findCode(code, fromTable);
  if (!code || !promo || promo.active === false) return { error: "Ce code n'existe pas. Vérifie l'orthographe." };
  if (promo.expiresAt && Date.parse(promo.expiresAt) <= now) return { error: "Ce code n'est plus valable." };
  if ((c.promoCodes ?? []).includes(code)) return { error: "Tu as déjà utilisé ce code." };
  const packs = Math.max(0, Math.floor(promo.reward.packs ?? 0));
  const coins = Math.max(0, Math.floor(promo.reward.coins ?? 0));
  return {
    code,
    reward: { packs, coins },
    collection: {
      ...c,
      extraPacks: (c.extraPacks ?? 0) + packs,
      coinsEarned: c.coinsEarned + coins,
      promoCodes: [...(c.promoCodes ?? []), code],
    },
  };
}
