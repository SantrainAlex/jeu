"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cloudEnabled, getUsername, saveUsername, useCloud } from "@/lib/cloud";
import { usernameError } from "@/lib/score";

/** Choisir ou modifier son nom d'utilisateur (celui qui apparaît dans le classement). */
export function UsernameForm() {
  const cloud = useCloud();
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (cloud.status !== "signedIn") return;
    let alive = true;
    getUsername()
      .then((u) => {
        if (!alive) return;
        setCurrent(u);
        setValue(u ?? "");
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [cloud.status, cloud.userId]);

  if (!cloudEnabled) return null;

  if (cloud.status !== "signedIn") {
    return (
      <div className="account-box">
        <h2 className="box-title">Mon nom d&apos;utilisateur</h2>
        <p className="muted">
          <Link href="/connexion">Connecte-toi</Link> pour choisir ton nom et apparaître dans le{" "}
          <Link href="/cartes/classement">classement des collectionneurs</Link>.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    const invalid = usernameError(name);
    if (invalid) return setMessage({ ok: false, text: invalid });
    setSaving(true);
    const error = await saveUsername(name);
    setSaving(false);
    if (error) return setMessage({ ok: false, text: error });
    setCurrent(name);
    setValue(name);
    setMessage({ ok: true, text: "C'est enregistré !" });
  }

  const unchanged = value.trim() === (current ?? "");

  return (
    <form className="account-box" onSubmit={submit}>
      <h2 className="box-title">Mon nom d&apos;utilisateur</h2>
      <p className="muted small">
        C&apos;est le nom que les autres joueurs voient dans le{" "}
        <Link href="/cartes/classement">classement des collectionneurs</Link>. Ton e-mail reste privé.
      </p>
      <label htmlFor="username" className="muted small">Nom (3 à 20 caractères, sans espace)</label>
      <div className="search">
        <input
          id="username"
          type="text"
          autoComplete="nickname"
          maxLength={20}
          placeholder="ex. Alex_Gamer"
          disabled={!loaded}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
        />
        <button type="submit" disabled={!loaded || saving || unchanged || !value.trim()}>
          {saving ? "Enregistrement…" : current ? "Modifier" : "Enregistrer"}
        </button>
      </div>
      {message && <p className={message.ok ? "sync" : "notice"}>{message.text}</p>}
    </form>
  );
}
