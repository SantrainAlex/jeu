/**
 * Points de collection pour le classement (sans dépendance au navigateur, donc testable).
 * Le vrai calcul du classement est fait par la base (fonction `collection_score` dans supabase/schema.sql) :
 * ce fichier suit exactement les mêmes règles, pour afficher le barème et tes points sur le site.
 *
 * - chaque carte DIFFÉRENTE que tu possèdes rapporte des points selon sa rareté ;
 * - les doublons ne comptent pas (sinon il suffirait d'ouvrir des boosters à la chaîne) ;
 * - une carte en finition argent compte double, en or triple (ces finitions coûtent des doublons) ;
 * - chaque vitrail numéroté rapporte un gros bonus.
 */
import type { Rarity } from "./cards";
import { copies, type Collection, type Finish } from "./data";

export const RARITY_POINTS: Record<Rarity, number> = {
  commune: 1,
  rare: 3,
  epique: 10,
  legendaire: 25,
  mythique: 100,
};

export const FINISH_MULTIPLIER: Record<Finish, number> = { argent: 2, or: 3 };

export const VITRAIL_POINTS = 150;

export function collectionScore(c: Collection): number {
  let score = 0;
  for (const o of Object.values(c.cards)) {
    if (copies(o) < 1) continue;
    score += (RARITY_POINTS[o.card.rarity] ?? 0) * (o.finish ? FINISH_MULTIPLIER[o.finish] : 1);
  }
  return score + c.vitraux.length * VITRAIL_POINTS;
}

// ---------- Nom d'utilisateur ----------

/** 3 à 20 caractères : lettres (accents compris), chiffres, tiret, point et tiret bas. Même règle que la base. */
export const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,20}$/u;

/** Message d'erreur pour un nom refusé, ou null s'il est valide. */
export function usernameError(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return "Ton nom doit faire au moins 3 caractères.";
  if (n.length > 20) return "Ton nom doit faire 20 caractères maximum.";
  if (!USERNAME_RE.test(n)) return "Seulement des lettres, des chiffres, et les signes - _ . (pas d'espace).";
  return null;
}
