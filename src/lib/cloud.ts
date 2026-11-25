"use client";

/**
 * Comptes en ligne avec Supabase : connexion par lien magique envoyé par e-mail,
 * et synchronisation du profil, des notes et de la collection avec le compte.
 * Sans les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY, le site marche sans comptes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { EMPTY, isEmpty, normalize, type Data } from "./data";
import { onUserChange, read, replaceAll, type VitrailStock } from "./store";
import { mergeData } from "./sync";

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

async function push(userId: string, data: Data) {
  setState({ sync: "saving" });
  const { error } = await supabase()!
    .from("user_data")
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
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

/** À la connexion : on fusionne ce navigateur avec le compte, puis on renvoie le résultat. */
async function syncOnSignIn(userId: string) {
  try {
    const cloud = await pull(userId);
    const local = read();
    const merged = cloud ? mergeData(local, cloud) : local;
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
  if (pushTimer && state.userId) {
    clearTimeout(pushTimer);
    await push(state.userId, read());
  }
  await supabase()?.auth.signOut();
}

/** Le stock partagé de vitraux, si tu es connecté. */
export async function getVitrailStock(): Promise<VitrailStock | null> {
  const sb = supabase();
  if (!sb || state.status !== "signedIn") return null;
  const { data, error } = await sb.from("vitrail_stock").select("total, given").eq("id", 1).single();
  if (error || !data) return null;
  return {
    left: Math.max(0, data.total - data.given),
    claim: async () => {
      const { data: n, error: e } = await sb.rpc("claim_vitrail");
      return e ? null : ((n as number | null) ?? null);
    },
  };
}

/** Nombre de vitraux restants dans le stock partagé (visible même sans être connecté). */
export async function getVitrailsLeft(): Promise<number | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("vitrail_stock").select("total, given").eq("id", 1).single();
  return data ? Math.max(0, data.total - data.given) : null;
}
