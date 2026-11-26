import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redeemCode, type PromoCode } from "@/lib/promo";
import { withLegacyBonus } from "@/lib/quests";
import { adminClient, loadCards, ratingsInfo, saveCards, userFromRequest } from "@/lib/server/cardsServer";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Les codes ajoutés dans la table `promo_codes` de Supabase (aucun si la table n'existe pas encore). */
async function tableCodes(sb: SupabaseClient): Promise<PromoCode[]> {
  const { data, error } = await sb.from("promo_codes").select("code, packs, coins, active, expires_at");
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[jeu] codes promo :", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    code: String(r.code),
    reward: { packs: Number(r.packs) || 0, coins: Number(r.coins) || 0 },
    active: r.active !== false,
    expiresAt: r.expires_at ?? null,
  }));
}

/**
 * POST /api/code-promo { code } : utilise un code promo.
 * Le serveur vérifie que le code existe et que ce compte ne l'a pas déjà utilisé, puis donne la récompense.
 * Le navigateur ne choisit jamais la récompense.
 */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return fail("Le serveur des cartes n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY manquante).", 503);

  const userId = await userFromRequest(sb, req);
  if (!userId) return fail("Connecte-toi pour utiliser un code promo.", 401);

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  if (!body || typeof body.code !== "string") return fail("Demande invalide.", 400);

  try {
    const codes = await tableCodes(sb);
    const ratings = await ratingsInfo(sb, userId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await loadCards(sb, userId);
      const result = redeemCode(withLegacyBonus(row.collection, ratings.total), body.code, codes);
      if ("error" in result) return fail(result.error, 409);
      // enregistré seulement si la collection n'a pas changé entre-temps : deux demandes en même temps ne passent pas toutes les deux
      if (await saveCards(sb, userId, row, result.collection)) return NextResponse.json(result);
    }
    return fail("Trop de demandes en même temps, réessaie.", 409);
  } catch (e) {
    console.error("[jeu] code promo :", (e as Error).message);
    return fail("Le serveur ne répond pas, réessaie dans un instant.", 502);
  }
}
