"use client";

/**
 * Point d'entrée unique des pages pour agir sur les cartes.
 * - Comptes activés : la demande part au serveur, qui vérifie tout (voir /api/cartes/action).
 * - Site sans comptes (Supabase pas configuré) : tout se passe dans le navigateur, comme avant.
 */
import type { Card } from "./cards";
import { applyBuyBooster, applyWorkshop, type CardAction } from "./cardRules";
import { withLegacyBonus } from "./quests";
import { cloudEnabled, serverCardAction, type ServerCardResult } from "./cloud";
import { claimLocalQuest, openLocalBooster, read, updateCollection } from "./store";

let busy = false;

export async function runCardAction(action: CardAction, pool: Card[]): Promise<ServerCardResult> {
  // une seule action à la fois depuis cette page (double clic…) ; le serveur bloque de toute façon les doublons
  if (busy) return { error: "Une action est déjà en cours." };
  busy = true;
  try {
    if (cloudEnabled) return await serverCardAction(action);
    if (action.type === "booster") {
      const pulled = openLocalBooster(pool);
      return pulled ? { collection: read().collection, pulled } : { error: "Plus de booster pour l'instant." };
    }
    if (action.type === "claimQuest") {
      const reward = claimLocalQuest(action);
      return reward ? { collection: read().collection, reward } : { error: "Cette quête n'est pas encore finie." };
    }
    if (action.type === "buyBooster") {
      const ratings = Object.keys(read().ratings).length;
      return updateCollection((c) => applyBuyBooster(withLegacyBonus(c, ratings))) ?? { error: "Pas assez de pièces pour acheter un booster." };
    }
    return updateCollection((c) => applyWorkshop(c, action, pool)) ?? { error: "Action impossible." };
  } finally {
    busy = false;
  }
}
