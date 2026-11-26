"use client";

import Link from "next/link";
import { PLATFORMS } from "@/lib/platforms";
import { togglePlatform, useStore } from "@/lib/store";
import { UsernameForm } from "@/components/UsernameForm";

export default function ProfilePage() {
  const [{ profile, ratings }, ready] = useStore();
  const count = Object.keys(ratings).length;

  return (
    <>
      <h1>Mon profil</h1>
      <UsernameForm />

      <h2>Mes plateformes</h2>
      <p className="muted">
        Coche les plateformes que tu possèdes ou qui t&apos;intéressent : elles passeront en premier sur le site
        et serviront à choisir tes recommandations.
      </p>

      <table className="profile-table">
        <thead>
          <tr>
            <th>Plateforme</th>
            <th>Je l&apos;ai</th>
            <th>M&apos;intéresse</th>
          </tr>
        </thead>
        <tbody>
          {PLATFORMS.map((p) => (
            <tr key={p.slug}>
              <td>
                <span className="dot" style={{ background: p.color }} /> {p.name}
              </td>
              {(["owned", "interested"] as const).map((list) => (
                <td key={list}>
                  <input
                    type="checkbox"
                    aria-label={`${p.name} : ${list === "owned" ? "je l'ai" : "m'intéresse"}`}
                    disabled={!ready}
                    checked={profile[list].includes(p.slug)}
                    onChange={() => togglePlatform(list, p.slug)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted" style={{ marginTop: "1.5rem" }}>
        Tu as noté {count} jeu{count > 1 ? "x" : ""}. <Link href="/mes-notes">Voir mes notes</Link> ·{" "}
        <Link href="/recommandations">Mes recommandations</Link>
      </p>
      <p className="muted small">Ton profil et tes notes sont enregistrés dans ce navigateur.</p>
    </>
  );
}
