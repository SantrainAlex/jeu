"use client";

import Link from "next/link";
import { useState } from "react";
import { cloudEnabled, sendMagicLink, signOut, useCloud } from "@/lib/cloud";
import { useStore } from "@/lib/store";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const cloud = useCloud();
  const [{ ratings, collection }] = useStore();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!cloudEnabled) {
    return (
      <>
        <h1>Connexion</h1>
        <p className="notice">
          Les comptes ne sont pas encore activés sur ce site. Ajoute <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans <code>.env.local</code> (voir le README).
        </p>
      </>
    );
  }

  if (cloud.status === "loading") return <h1>Connexion…</h1>;

  if (cloud.status === "signedIn") {
    const syncLabel = {
      idle: "",
      saving: "Enregistrement…",
      saved: "Tout est enregistré sur ton compte",
      error: "Enregistrement impossible pour le moment, on réessaiera à ta prochaine action",
    }[cloud.sync];
    return (
      <>
        <h1>Mon compte</h1>
        <div className="account-box">
          <p>
            Connecté avec <strong>{cloud.email}</strong>
          </p>
          <p className="muted">
            {Object.keys(ratings).length} jeux notés · {Object.keys(collection.cards).length} cartes ·{" "}
            {collection.vitraux.length} vitrail{collection.vitraux.length > 1 ? "x" : ""}
          </p>
          <p className={cloud.sync === "error" ? "sync error" : "sync"}>{syncLabel}</p>
          <p className="muted small">
            Ton profil, tes notes et tes cartes te suivent sur tous tes appareils : connecte-toi avec le même e-mail.
          </p>
          <div className="account-actions">
            <Link href="/profil" className="button">Mon profil</Link>
            <button type="button" className="button ghost" onClick={() => signOut()}>
              Se déconnecter
            </button>
          </div>
        </div>
      </>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const err = await sendMagicLink(email.trim());
    setSending(false);
    if (err) setError(err);
    else setSentTo(email.trim());
  };

  return (
    <>
      <h1>Se connecter</h1>
      {sentTo ? (
        <div className="account-box">
          <p className="big-emoji"><Icon name="check" size={28} /></p>
          <p>
            Un lien de connexion vient d&apos;être envoyé à <strong>{sentTo}</strong>.
          </p>
          <p className="muted">
            Ouvre l&apos;e-mail et clique sur le lien : tu reviendras ici, connecté. Pense à regarder dans les spams.
          </p>
          <button type="button" className="button ghost" onClick={() => setSentTo(null)}>
            Changer d&apos;adresse
          </button>
        </div>
      ) : (
        <form className="account-box" onSubmit={submit}>
          <p>Pas de mot de passe : entre ton e-mail, tu recevras un lien pour te connecter.</p>
          <label htmlFor="email" className="muted small">Adresse e-mail</label>
          <div className="search">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="toi@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" disabled={sending}>
              {sending ? "Envoi…" : "Recevoir le lien"}
            </button>
          </div>
          {error && <p className="notice">{error}</p>}
          <p className="muted small">
            Première fois ? Le compte est créé automatiquement. Ce que tu as déjà noté ou collectionné sur ce navigateur
            sera ajouté à ton compte.
          </p>
        </form>
      )}
    </>
  );
}
