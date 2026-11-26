"use client";

/**
 * Comptes en ligne avec Supabase : connexion par lien magique envoyé par e-mail,
 * et synchronisation du profil, des notes et de la collection avec le compte.
 * Sans les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, le site marche sans comptes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import type { CardAction, CardActionResult } from "./cardRules";
import { EMPTY, EMPTY_COLLECTION, isEmpty, normalize, type Collection, type Data } from "./data";
import { onUserChange, read, replaceAll, setCollection } from "./store";
import { mergeData } from "./sync";
import { toSummaries, type PerfReport, type PerfSummary } from "./perf";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(URL && ANON_KEY);

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  client ??= createClient(URL!, ANON_KEY!, { auth: { persistSession: true, detectSessionInUrl: true } });
  return client;
}

// ---------- État de la connexion, lisible par les composants ----------

export type CloudState = {
  status: "disabled" | "loading" | "signedOut" | "signedIn";
  email: string | null;
  userId: string | null;
  sync: "idle" | "saving" | "saved" | "error";
};

let state: CloudState = { status: cloudEnabled ? "loading" : "disabled", email: null, userId: null, sync: "idle" };
const listeners = new Set<() => void>();
function setState(patch: Partial<CloudState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const SERVER_STATE: CloudState = { status: "loading", email: null, userId: null, sync: "idle" };

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => (cloudEnabled ? SERVER_STATE : state),
  );
}

// ---------- Synchronisation ----------

async function pull(userId: string): Promise<Data | null> {
  const { data, error } = await supabase()!.from("user_data").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? normalize(data.data) : null;
}

/** La collection de cartes du compte (lecture seule : seul le serveur du site peut la modifier). */
async function pullCards(userId: string): Promise<Collection> {
  const { data, error } = await supabase()!.from("user_cards").select("collection").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? normalize({ collection: data.collection }).collection : EMPTY_COLLECTION;
}

/** Envoie le profil et les notes. La collection n'est jamais envoyée : le compte la refuserait de toute façon. */
async function push(userId: string, data: Data) {
  setState({ sync: "saving" });
  const { profile, ratings } = data;
  const { error } = await supabase()!
    .from("user_data")
    .upsert({ user_id: userId, data: { profile, ratings }, updated_at: new Date().toISOString() });
  setState({ sync: error ? "error" : "saved" });
  if (error) console.error("[jeu] sauvegarde du compte impossible :", error.message);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush() {
  if (!state.userId) return;
  const userId = state.userId;
  setState({ sync: "saving" });
  if (pushTimer) clearTimeout(pushTimer);
  // on regroupe les modifications rapprochées (plusieurs étoiles d'affilée…) en un seul envoi
  pushTimer = setTimeout(() => push(userId, read()), 800);
}

/** Envoie tout de suite les modifications en attente (ex. une note juste avant d'ouvrir un booster bonus). */
async function flushPush() {
  if (!pushTimer || !state.userId) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  await push(state.userId, read());
}

/**
 * À la connexion : on fusionne le profil et les notes de ce navigateur avec le compte.
 * Les cartes, elles, viennent uniquement du compte : celles gagnées sans être connecté ne sont pas reprises.
 */
async function syncOnSignIn(userId: string) {
  try {
    const [cloud, cards] = await Promise.all([pull(userId), pullCards(userId)]);
    const local = read();
    const merged = { ...(cloud ? mergeData(local, cloud) : local), collection: cards };
    replaceAll(merged);
    if (!cloud || !isEmpty(local)) await push(userId, merged);
    else setState({ sync: "saved" });
  } catch (e) {
    console.error("[jeu] synchronisation impossible :", (e as Error).message);
    setState({ sync: "error" });
  }
}

let started = false;

/** Démarre la gestion du compte (appelé une fois, au chargement du site). */
export function startCloud() {
  const sb = supabase();
  if (started || !sb) return;
  started = true;

  onUserChange(() => schedulePush());

  sb.auth.onAuthStateChange((event, session) => {
    const user = session?.user ?? null;
    if (!user) {
      if (event === "SIGNED_OUT") replaceAll(EMPTY); // on ne laisse pas tes données à la personne suivante
      setState({ status: "signedOut", email: null, userId: null, sync: "idle" });
      return;
    }
    const isNewUser = state.userId !== user.id;
    setState({ status: "signedIn", email: user.email ?? null, userId: user.id });
    // les appels à Supabase ne doivent pas se faire directement dans ce rappel
    if (isNewUser) setTimeout(() => syncOnSignIn(user.id), 0);
  });
}

// ---------- Actions ----------

/** Envoie le lien magique. Le lien ramène sur la page de connexion, qui termine la connexion. */
export async function sendMagicLink(email: string): Promise<string | null> {
  const sb = supabase();
  if (!sb) return "Les comptes ne sont pas configurés.";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/connexion` },
  });
  if (!error) return null;
  if (error.status === 429) return "Trop de demandes : attends quelques minutes avant de redemander un lien.";
  if (/fetch|network/i.test(error.message)) return "Impossible de joindre le serveur de connexion. Vérifie ta connexion internet et l'adresse Supabase dans .env.local.";
  if (/redirect/i.test(error.message)) return "Supabase refuse l'adresse de retour : ajoute-la dans Authentication → URL Configuration → Redirect URLs.";
  return error.message;
}

export async function signOut() {
  await flushPush();
  await supabase()?.auth.signOut();
}

export type ServerCardResult = (CardActionResult & { vitrailsLeft?: number }) | { error: string };

/**
 * Demande au serveur d'ouvrir un booster ou de faire une action de l'atelier.
 * C'est le serveur qui vérifie les règles, tire les cartes et enregistre ta collection ; on affiche ensuite sa réponse.
 */
export async function serverCardAction(action: CardAction): Promise<ServerCardResult> {
  const sb = supabase();
  if (!sb) return { error: "Les comptes ne sont pas configurés." };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Connecte-toi pour utiliser tes cartes." };
  await flushPush();
  try {
    const res = await fetch("/api/cartes/action", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(action),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // le serveur a refusé : on remet la collection à jour depuis le compte, au cas où elle aurait changé ailleurs
      if (state.userId) pullCards(state.userId).then(setCollection).catch(() => {});
      return { error: body.error ?? "Action impossible pour le moment." };
    }
    setCollection(body.collection);
    return body;
  } catch {
    return { error: "Impossible de joindre le serveur, vérifie ta connexion internet." };
  }
}

/** Nombre de vitraux restants dans le stock partagé (visible même sans être connecté). */
export async function getVitrailsLeft(): Promise<number | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("vitrail_stock").select("total, given").eq("id", 1).single();
  return data ? Math.max(0, data.total - data.given) : null;
}

// ---------- Nom d'utilisateur et classement ----------

/** Ton nom d'utilisateur (null si tu n'en as pas encore choisi). */
export async function getUsername(): Promise<string | null> {
  const sb = supabase();
  if (!sb || !state.userId) return null;
  const { data, error } = await sb.from("profiles").select("username").eq("user_id", state.userId).maybeSingle();
  if (error) throw error;
  return data?.username ?? null;
}

/** Enregistre ton nom d'utilisateur. Renvoie un message d'erreur, ou null si c'est bon. */
export async function saveUsername(username: string): Promise<string | null> {
  const sb = supabase();
  if (!sb || !state.userId) return "Connecte-toi pour choisir un nom.";
  const { error } = await sb
    .from("profiles")
    .upsert({ user_id: state.userId, username, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (!error) return null;
  if (error.code === "23505") return "Ce nom est déjà pris, choisis-en un autre.";
  if (error.code === "23514") return "Ce nom n'est pas autorisé : 3 à 20 lettres, chiffres, - _ ou .";
  if (error.code === "42P01" || /profiles/.test(error.message)) return "Le classement n'est pas encore activé sur le site.";
  return "Impossible d'enregistrer ton nom pour le moment, réessaie.";
}

export type RankRow = { rank: number | null; username: string | null; score: number };

/** Le haut du classement (nom et points seulement), visible même sans être connecté. */
export async function getLeaderboard(limit = 100): Promise<RankRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.rpc("leaderboard", { lim: limit });
  if (error) throw error;
  return (data as RankRow[]) ?? [];
}

/** Ta place, tes points et ton nom (null si tu n'es pas connecté). */
export async function getMyRank(): Promise<RankRow | null> {
  const sb = supabase();
  if (!sb || !state.userId) return null;
  const { data, error } = await sb.rpc("my_rank");
  if (error) throw error;
  return ((data as RankRow[]) ?? [])[0] ?? null;
}

// ---------- Avis résolution / FPS ----------

/**
 * Le résumé des avis des joueurs pour un jeu (visible même sans être connecté).
 * null si la fonction n'existe pas encore dans la base (SQL pas encore lancé) : la partie reste alors cachée.
 */
export async function getPerfSummary(gameId: number): Promise<PerfSummary[] | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("perf_summary", { gid: gameId });
  if (error) return null;
  return toSummaries(data);
}

/** Tes propres avis sur ce jeu (un par plateforme). */
export async function getMyPerf(gameId: number): Promise<PerfReport[]> {
  const sb = supabase();
  if (!sb || !state.userId) return [];
  const { data, error } = await sb.from("perf_reports").select("platform, resolution, fps, stable").eq("game_id", gameId);
  if (error) return [];
  return (data as PerfReport[]) ?? [];
}

/** Enregistre (ou remplace) ton avis pour une plateforme. Renvoie un message d'erreur, ou null si c'est bon. */
export async function savePerf(gameId: number, report: PerfReport): Promise<string | null> {
  const sb = supabase();
  if (!sb || !state.userId) return "Connecte-toi pour donner ton avis.";
  const { error } = await sb
    .from("perf_reports")
    .upsert({ user_id: state.userId, game_id: gameId, ...report, updated_at: new Date().toISOString() }, { onConflict: "user_id,game_id,platform" });
  return error ? "Impossible d'enregistrer ton avis pour le moment, réessaie." : null;
}

/** Retire ton avis pour une plateforme. */
export async function deletePerf(gameId: number, platform: string): Promise<string | null> {
  const sb = supabase();
  if (!sb || !state.userId) return "Connecte-toi pour donner ton avis.";
  const { error } = await sb.from("perf_reports").delete().eq("game_id", gameId).eq("platform", platform);
  return error ? "Impossible de retirer ton avis pour le moment, réessaie." : null;
}

// ---------- Échanges de cartes entre joueurs ----------

/**
 * Demande au serveur des échanges (/api/echanges). Le navigateur ne modifie jamais les cartes lui-même :
 * après un échange accepté, il reprend simplement la collection renvoyée par le serveur.
 */
export async function tradesRequest<T>(query = "", action?: unknown): Promise<T | { error: string }> {
  const sb = supabase();
  if (!sb) return { error: "Les comptes ne sont pas configurés." };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Connecte-toi pour échanger des cartes." };
  try {
    const res = await fetch(`/api/echanges${query}`, {
      method: action ? "POST" : "GET",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: action ? JSON.stringify(action) : undefined,
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error ?? "Action impossible pour le moment." };
    if (body.collection) setCollection(body.collection);
    return body as T;
  } catch {
    return { error: "Impossible de joindre le serveur, vérifie ta connexion internet." };
  }
}

/** Recharge ta collection depuis le compte (un autre joueur a pu accepter un de tes échanges). */
export async function refreshCards(): Promise<void> {
  if (!state.userId) return;
  await pullCards(state.userId).then(setCollection).catch(() => {});
}
