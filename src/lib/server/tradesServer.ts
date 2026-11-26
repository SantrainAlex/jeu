/**
 * Les échanges de cartes côté serveur (clé service_role) : chercher un joueur, proposer, accepter, refuser, annuler.
 * Le navigateur ne fait que demander ; ici on vérifie les deux collections et on fait l'échange en une seule fois
 * dans la base (fonction apply_trade), pour qu'aucune carte ne soit dupliquée ni perdue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection } from "../data";
import { EXPIRE_MS, TRADE_LIMITS, applyTrade, itemsFrom, tradableCards, type TradeAction, type TradeItem, type TradeStatus, type TradeView, type TradesList } from "../trades";
import { loadCards } from "./cardsServer";

export class TradeError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

type TradeRow = {
  id: string;
  from_user: string;
  to_user: string;
  give: TradeItem[];
  want: TradeItem[];
  status: TradeStatus;
  created_at: string;
  resolved_at: string | null;
};

const COLS = "id, from_user, to_user, give, want, status, created_at, resolved_at";

export async function usernameOf(sb: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await sb.from("profiles").select("username").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

/** Trouve un joueur par son nom (sans tenir compte des majuscules). */
export async function findPlayer(sb: SupabaseClient, name: string): Promise<{ userId: string; username: string } | null> {
  const pattern = name.trim().replace(/[\\%_]/g, "\\$&");
  const { data, error } = await sb.from("profiles").select("user_id, username").ilike("username", pattern).limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row ? { userId: row.user_id, username: row.username } : null;
}

/**
 * Les joueurs dont le nom contient ces lettres (ceux qui commencent par elles d'abord), sans toi.
 * Seulement le nom et les points du classement, comme le classement public.
 */
export async function searchPlayers(sb: SupabaseClient, me: string, text: string): Promise<{ players: { username: string; score: number }[] }> {
  const q = text.trim().replace(/[\\%_]/g, "\\$&");
  const LIMIT = 8;
  const [starts, contains] = await Promise.all([
    sb.from("profiles").select("user_id, username").ilike("username", `${q}%`).neq("user_id", me).order("username").limit(LIMIT),
    sb.from("profiles").select("user_id, username").ilike("username", `%${q}%`).neq("user_id", me).order("username").limit(LIMIT * 2),
  ]);
  if (starts.error) throw starts.error;
  if (contains.error) throw contains.error;
  const seen = new Set<string>();
  const found = [...(starts.data ?? []), ...(contains.data ?? [])]
    .filter((p) => !seen.has(p.user_id) && seen.add(p.user_id))
    .slice(0, LIMIT) as { user_id: string; username: string }[];
  if (!found.length) return { players: [] };
  const { data: cards, error } = await sb.from("user_cards").select("user_id, score").in("user_id", found.map((p) => p.user_id));
  if (error) throw error;
  const score = new Map((cards ?? []).map((c) => [c.user_id as string, c.score as number]));
  return { players: found.map((p) => ({ username: p.username, score: score.get(p.user_id) ?? 0 })) };
}

/** Les offres restées sans réponse trop longtemps passent en « expirée ». */
async function expireOld(sb: SupabaseClient, userId: string) {
  const limit = new Date(Date.now() - EXPIRE_MS).toISOString();
  const { error } = await sb
    .from("card_trades")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("created_at", limit)
    .or(`from_user.eq.${userId},to_user.eq.${userId}`);
  if (error) throw error;
}

async function countOpen(sb: SupabaseClient, column: "from_user" | "to_user", userId: string, other?: string) {
  let q = sb.from("card_trades").select("id", { count: "exact", head: true }).eq("status", "pending").eq(column, userId);
  if (other) q = q.eq("to_user", other);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Les doublons qu'un joueur peut échanger (pour choisir ce qu'on lui demande). */
export async function playerCards(sb: SupabaseClient, me: string, name: string) {
  const p = await findPlayer(sb, name);
  if (!p) throw new TradeError("Aucun joueur ne porte ce nom.", 404);
  if (p.userId === me) throw new TradeError("C'est toi ! Cherche le nom d'un autre joueur.", 400);
  const { collection } = await loadCards(sb, p.userId);
  return { username: p.username, cards: tradableCards(collection) };
}

/** Tes offres reçues et envoyées en attente, et les 10 dernières terminées. */
export async function listTrades(sb: SupabaseClient, me: string): Promise<TradesList> {
  await expireOld(sb, me);
  const [pending, done] = await Promise.all([
    sb.from("card_trades").select(COLS).eq("status", "pending").or(`from_user.eq.${me},to_user.eq.${me}`).order("created_at", { ascending: false }).limit(TRADE_LIMITS.openReceived + TRADE_LIMITS.openSent),
    sb.from("card_trades").select(COLS).neq("status", "pending").or(`from_user.eq.${me},to_user.eq.${me}`).order("resolved_at", { ascending: false }).limit(10),
  ]);
  if (pending.error) throw pending.error;
  if (done.error) throw done.error;
  const rows = [...(pending.data as TradeRow[]), ...(done.data as TradeRow[])];

  const ids = [...new Set([me, ...rows.flatMap((r) => [r.from_user, r.to_user])])];
  const { data: profiles, error } = await sb.from("profiles").select("user_id, username").in("user_id", ids);
  if (error) throw error;
  const names = new Map((profiles ?? []).map((p) => [p.user_id as string, p.username as string]));

  const view = (r: TradeRow): TradeView => {
    const sent = r.from_user === me;
    return {
      id: r.id,
      sent,
      other: names.get(sent ? r.to_user : r.from_user) ?? "Joueur supprimé",
      give: r.give,
      want: r.want,
      status: r.status,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
      expiresAt: new Date(Date.parse(r.created_at) + EXPIRE_MS).toISOString(),
    };
  };
  const open = (pending.data as TradeRow[]).map(view);
  return {
    username: names.get(me) ?? null,
    received: open.filter((t) => !t.sent),
    sent: open.filter((t) => t.sent),
    history: (done.data as TradeRow[]).map(view),
  };
}

/** Fait une action d'échange. Renvoie ta collection à jour quand elle a changé (échange accepté). */
export async function runTrade(sb: SupabaseClient, me: string, action: TradeAction): Promise<{ message: string; collection?: Collection }> {
  await expireOld(sb, me);

  if (action.type === "propose") {
    if (!(await usernameOf(sb, me))) throw new TradeError("Choisis d'abord ton nom d'utilisateur dans ton profil, pour que l'autre joueur sache qui propose.", 400);
    const target = await findPlayer(sb, action.to);
    if (!target) throw new TradeError("Aucun joueur ne porte ce nom.", 404);
    if (target.userId === me) throw new TradeError("Tu ne peux pas échanger avec toi-même.", 400);

    if ((await countOpen(sb, "from_user", me)) >= TRADE_LIMITS.openSent)
      throw new TradeError(`Tu as déjà ${TRADE_LIMITS.openSent} offres en attente : attends une réponse ou annules-en une.`);
    if ((await countOpen(sb, "from_user", me, target.userId)) >= TRADE_LIMITS.openToSamePlayer)
      throw new TradeError(`Tu as déjà ${TRADE_LIMITS.openToSamePlayer} offres en attente avec ${target.username}.`);
    if ((await countOpen(sb, "to_user", target.userId)) >= TRADE_LIMITS.openReceived)
      throw new TradeError(`${target.username} a déjà trop d'offres en attente, réessaie plus tard.`);

    const [mine, theirs] = await Promise.all([loadCards(sb, me), loadCards(sb, target.userId)]);
    const give = itemsFrom(mine.collection, action.give);
    if (!give) throw new TradeError("Tu n'as plus assez de doublons des cartes que tu proposes.");
    const want = itemsFrom(theirs.collection, action.want);
    if (!want) throw new TradeError(`${target.username} n'a plus assez de doublons des cartes que tu demandes.`);

    const { error } = await sb.from("card_trades").insert({ from_user: me, to_user: target.userId, give, want });
    if (error) throw error;
    return { message: `Offre envoyée à ${target.username} ! Tu verras ici sa réponse.` };
  }

  if (action.type === "cancel" || action.type === "refuse") {
    const { data, error } = await sb
      .from("card_trades")
      .update({ status: action.type === "cancel" ? "cancelled" : "refused", resolved_at: new Date().toISOString() })
      .eq("id", action.id)
      .eq("status", "pending")
      .eq(action.type === "cancel" ? "from_user" : "to_user", me)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new TradeError("Cette offre n'est plus en attente.");
    return { message: action.type === "cancel" ? "Offre annulée." : "Offre refusée." };
  }

  // accepter : seul celui qui reçoit l'offre peut le faire
  const { data, error } = await sb.from("card_trades").select(COLS).eq("id", action.id).eq("to_user", me).maybeSingle();
  if (error) throw error;
  const trade = data as TradeRow | null;
  if (!trade || trade.status !== "pending") throw new TradeError("Cette offre n'est plus en attente.");

  const lines = { give: trade.give.map(({ id, n }) => ({ id, n })), want: trade.want.map(({ id, n }) => ({ id, n })) };
  for (let attempt = 0; attempt < 3; attempt++) {
    const [from, to] = await Promise.all([loadCards(sb, trade.from_user), loadCards(sb, me)]);
    if (!itemsFrom(from.collection, lines.give)) throw new TradeError("L'autre joueur n'a plus les cartes qu'il te propose. Tu peux refuser cette offre.");
    const done = applyTrade(from.collection, to.collection, lines);
    if (!done) throw new TradeError("Tu n'as plus assez de doublons des cartes demandées.");

    const { data: res, error: e } = await sb.rpc("apply_trade", {
      trade: trade.id,
      from_id: trade.from_user,
      from_version: from.version,
      from_coll: done.from,
      to_id: me,
      to_version: to.version,
      to_coll: done.to,
    });
    if (e) throw e;
    if (res === "ok") return { message: "Échange réussi ! Les cartes sont dans ton album.", collection: done.to };
    if (res === "closed") throw new TradeError("Cette offre n'est plus en attente.");
    // 'stale' : une des deux collections a changé pendant ce temps, on recommence avec les cartes à jour
  }
  throw new TradeError("Trop de changements en même temps, réessaie.");
}
