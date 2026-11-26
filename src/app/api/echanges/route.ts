import { NextResponse } from "next/server";
import { adminClient, userFromRequest } from "@/lib/server/cardsServer";
import { TradeError, listTrades, playerCards, runTrade, searchPlayers } from "@/lib/server/tradesServer";
import { USERNAME, parseTradeAction } from "@/lib/trades";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

async function handle(req: Request, run: (sb: NonNullable<ReturnType<typeof adminClient>>, me: string) => Promise<unknown>) {
  const sb = adminClient();
  if (!sb) return fail("Le serveur des cartes n'est pas configuré (SUPABASE_SERVICE_ROLE_KEY manquante).", 503);
  const me = await userFromRequest(sb, req);
  if (!me) return fail("Connecte-toi pour échanger des cartes.", 401);
  try {
    return NextResponse.json(await run(sb, me));
  } catch (e) {
    if (e instanceof TradeError) return fail(e.message, e.status);
    const err = e as { message?: string; code?: string };
    console.error("[jeu] échanges :", err.message);
    // table pas encore créée dans Supabase
    if (err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST202") return fail("Les échanges ne sont pas encore activés sur le site.", 503);
    return fail("Le serveur des échanges ne répond pas, réessaie dans un instant.", 502);
  }
}

/**
 * GET /api/echanges : tes offres reçues, envoyées et terminées.
 * GET /api/echanges?joueur=Nom : les doublons que ce joueur peut échanger.
 * GET /api/echanges?chercher=al : les joueurs dont le nom contient ces lettres (suggestions sous le champ).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const search = params.get("chercher");
  if (search !== null) {
    if (!/^[\p{L}\p{N}_.-]{1,20}$/u.test(search.trim())) return NextResponse.json({ players: [] });
    return handle(req, (sb, me) => searchPlayers(sb, me, search));
  }
  const name = params.get("joueur");
  if (name !== null && !USERNAME.test(name.trim())) return fail("Ce nom n'est pas valide : 3 à 20 lettres, chiffres, - _ ou .", 400);
  return handle(req, (sb, me) => (name !== null ? playerCards(sb, me, name) : listTrades(sb, me)));
}

/** POST /api/echanges : proposer, accepter, refuser ou annuler un échange. */
export async function POST(req: Request) {
  const action = parseTradeAction(await req.json().catch(() => null));
  if (!action) return fail("Demande invalide.", 400);
  return handle(req, async (sb, me) => ({ ...(await runTrade(sb, me, action)), ...(await listTrades(sb, me)) }));
}
