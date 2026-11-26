import { NextResponse } from "next/server";
import { getCardPool } from "@/lib/cardPool";
import { openPack, availablePacks, type PulledCard } from "@/lib/cards";
import { addPack, applyClaim, applyWorkshop, parseAction, type CardActionResult } from "@/lib/cardRules";
import { withLegacyBonus } from "@/lib/quests";
import {
  adminClient,
  claimVitrail,
  loadCards,
  ratingsInfo,
  saveCards,
  userFromRequest,
  vitrailsLeft,
} from "@/lib/server/cardsServer";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * POST /api/cartes/action : la seule façon de modifier une collection de cartes.
 * Le serveur vérifie qui tu es, si tu as le droit (booster disponible, doublons, pièces, quête finie…), tire les cartes
 * lui-même et enregistre le résultat. Le navigateur ne choisit jamais les cartes ni ses récompenses.
 */
export async function POST(req: Request) {
  const sb = adminClient();
  if (!sb) return fail("Le serveur des cartes n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY manquante).", 503);

  const userId = await userFromRequest(sb, req);
  if (!userId) return fail("Connecte-toi pour utiliser tes cartes.", 401);

  const action = parseAction(await req.json().catch(() => null));
  if (!action) return fail("Demande invalide.", 400);

  try {
    const { cards: pool } = await getCardPool();
    const ratings = await ratingsInfo(sb, userId);
    // le booster est tiré une seule fois ; si une autre demande passe en même temps, on revérifie avec les données à jour
    let drawn: PulledCard[] | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await loadCards(sb, userId);
      // les boosters bonus de l'ancien système (1 tous les 3 jeux notés) pas encore ouverts sont gardés, 3 au plus
      const collection = withLegacyBonus(row.collection, ratings.total);
      let result: CardActionResult | null;

      if (action.type === "booster") {
        if (availablePacks(collection).total === 0) return fail("Plus de booster pour l'instant.", 409);
        if (!drawn) {
          const left = await vitrailsLeft(sb);
          const { cards, vitrailUsed } = openPack(pool, { vitrailsLeft: left, nextVitrailNumber: 0 });
          if (vitrailUsed) {
            const i = cards.findIndex((c) => c.vitrail !== undefined);
            const n = await claimVitrail(sb);
            // plus de vitrail dans le stock partagé : la carte reste une carte normale
            if (n) cards[i] = { ...cards[i], vitrail: n };
            else delete cards[i].vitrail;
          }
          drawn = cards;
        }
        result = addPack(collection, drawn);
      } else if (action.type === "claimQuest") {
        result = applyClaim(collection, action, ratings.rated);
        if (!result) return fail("Cette quête n'est pas encore finie, ou sa récompense est déjà récupérée.", 409);
      } else {
        result = applyWorkshop(collection, action, pool);
      }

      if (!result) return fail("Action impossible avec ta collection actuelle.", 409);
      if (await saveCards(sb, userId, row, result.collection)) {
        return NextResponse.json({ ...result, vitrailsLeft: action.type === "booster" ? await vitrailsLeft(sb) : undefined });
      }
    }
    return fail("Trop de demandes en même temps, réessaie.", 409);
  } catch (e) {
    console.error("[jeu] action cartes :", (e as Error).message);
    return fail("Le serveur des cartes ne répond pas, réessaie dans un instant.", 502);
  }
}
