/**
 * Accès à la base réservé au serveur, avec la clé « service_role » (SUPABASE_SERVICE_ROLE_KEY).
 * Cette clé ne quitte jamais le serveur (à ne jamais importer depuis un fichier "use client") :
 * c'est elle seule qui peut modifier les collections de cartes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_COLLECTION, normalize, type Collection } from "../data";
import { ratedToday } from "../quests";

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

/** Le joueur qui fait la demande, d'après le jeton de connexion envoyé par le navigateur (null si invalide). */
export async function userFromRequest(sb: SupabaseClient, req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export type CardsRow = { collection: Collection; version: number };

/** La collection du joueur et son numéro de version (sert à refuser deux modifications en même temps). */
export async function loadCards(sb: SupabaseClient, userId: string): Promise<CardsRow> {
  const { data, error } = await sb.from("user_cards").select("collection, version").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return { collection: normalize({ collection: data.collection }).collection, version: data.version };
  const { error: e } = await sb
    .from("user_cards")
    .upsert({ user_id: userId, collection: EMPTY_COLLECTION, version: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
  if (e) throw e;
  return loadCards(sb, userId);
}

/**
 * Enregistre la nouvelle collection seulement si personne ne l'a modifiée entre-temps (même version).
 * Renvoie false si une autre demande est passée avant : c'est ce qui empêche d'ouvrir deux fois le même booster
 * en envoyant plusieurs demandes en même temps.
 */
export async function saveCards(sb: SupabaseClient, userId: string, row: CardsRow, next: Collection): Promise<boolean> {
  const { data, error } = await sb
    .from("user_cards")
    .update({ collection: next, version: row.version + 1, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("version", row.version)
    .select("user_id");
  if (error) throw error;
  return (data?.length ?? 0) === 1;
}

export type RatingsInfo = { total: number; today: number };

/**
 * Les notes du joueur : combien de jeux notés en tout (passage à l'ancien système de bonus)
 * et combien de jeux différents notés aujourd'hui (quête « Note N jeux »).
 * Ces notes viennent du navigateur, mais elles ne rapportent qu'une récompense par jour au maximum.
 */
export async function ratingsInfo(sb: SupabaseClient, userId: string, now = Date.now()): Promise<RatingsInfo> {
  const { data, error } = await sb.from("user_data").select("data->ratings").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const ratings = (data as { ratings?: unknown } | null)?.ratings;
  if (!ratings || typeof ratings !== "object") return { total: 0, today: 0 };
  const list = ratings as Record<string, { stars?: unknown; ratedAt?: unknown }>;
  const total = Object.values(list).filter((r) => r && typeof r.stars === "number" && r.stars >= 1 && r.stars <= 5).length;
  return { total, today: ratedToday(list, now) };
}

/** Vitraux restants dans le stock partagé. */
export async function vitrailsLeft(sb: SupabaseClient): Promise<number> {
  const { data } = await sb.from("vitrail_stock").select("total, given").eq("id", 1).single();
  return data ? Math.max(0, data.total - data.given) : 0;
}

/** Réserve un numéro de vitrail (null s'il n'en reste plus). */
export async function claimVitrail(sb: SupabaseClient): Promise<number | null> {
  const { data, error } = await sb.rpc("claim_vitrail");
  return error ? null : ((data as number | null) ?? null);
}
