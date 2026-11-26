"use client";

import Link from "next/link";
import { useState } from "react";
import { cloudEnabled, redeemPromoCode, useCloud } from "@/lib/cloud";
import { rewardLabel } from "@/lib/quests";

/** Saisir un code promo (ex. « Bienvenue ») pour recevoir des boosters ou des pièces. */
export function PromoCodeForm() {
  const cloud = useCloud();
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!cloudEnabled) return null;

  if (cloud.status !== "signedIn") {
    return (
      <div className="account-box">
        <h2 className="box-title">Code promo</h2>
        <p className="muted">
          <Link href="/connexion">Connecte-toi</Link> pour utiliser un code promo et recevoir des boosters ou des pièces.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || !value.trim()) return;
    setSending(true);
    const r = await redeemPromoCode(value);
    setSending(false);
    if ("error" in r) return setMessage({ ok: false, text: r.error });
    setValue("");
    setMessage({ ok: true, text: `Code validé ! Tu reçois ${rewardLabel(r.reward)}.` });
  }

  return (
    <form className="account-box" onSubmit={submit}>
      <h2 className="box-title">Code promo</h2>
      <p className="muted small">
        Tape un code pour recevoir des cadeaux. Chaque code ne marche qu&apos;une fois par compte. Les boosters
        reçus t&apos;attendent dans <Link href="/cartes">Boosters</Link>.
      </p>
      <label htmlFor="promo-code" className="muted small">Ton code</label>
      <div className="search">
        <input
          id="promo-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          placeholder="ex. BIENVENUE"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
        />
        <button type="submit" disabled={sending || !value.trim()}>
          {sending ? "Vérification…" : "Valider"}
        </button>
      </div>
      {message && <p className={message.ok ? "sync" : "notice"}>{message.text}</p>}
    </form>
  );
}
