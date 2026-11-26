"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CardTabs } from "@/components/CardTabs";
import { RARITIES } from "@/lib/cards";
import { cloudEnabled, getLeaderboard, getMyRank, useCloud, type RankRow } from "@/lib/cloud";
import { FINISH_MULTIPLIER, RARITY_POINTS, VITRAIL_POINTS } from "@/lib/score";

const fmt = (n: number) => n.toLocaleString("fr-FR");
const medal = (rank: number | null) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank ? `${rank}` : "–");

export default function LeaderboardPage() {
  const cloud = useCloud();
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [me, setMe] = useState<RankRow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!cloudEnabled) return;
    getLeaderboard(100)
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (cloud.status !== "signedIn") return setMe(null);
    getMyRank().then(setMe).catch(() => setMe(null));
  }, [cloud.status, cloud.userId]);

  return (
    <>
      <h1>Classement des collectionneurs</h1>
      <CardTabs active="classement" />

      <p className="muted">Chaque carte différente de ton album te rapporte des points selon sa rareté :</p>
      <ul className="points-scale">
        {RARITIES.map((r) => (
          <li key={r.id}>
            <span className="dot" style={{ background: r.color }} /> {r.label} : <strong>{RARITY_POINTS[r.id]}</strong>
          </li>
        ))}
        <li>🪟 Vitrail numéroté : <strong>{VITRAIL_POINTS}</strong></li>
      </ul>
      <p className="muted small">
        Les doublons ne comptent pas. Une carte en finition argent vaut ×{FINISH_MULTIPLIER.argent}, en or ×
        {FINISH_MULTIPLIER.or}. Les points sont calculés par le serveur à partir de ta collection : impossible de tricher.
      </p>

      {!cloudEnabled ? (
        <p className="notice">Le classement a besoin des comptes en ligne, qui ne sont pas activés sur ce site.</p>
      ) : (
        <>
          <MyRank me={me} signedIn={cloud.status === "signedIn"} />

          <h2>Top 100</h2>
          {failed ? (
            <p className="notice">Le classement n&apos;est pas disponible pour le moment, réessaie plus tard.</p>
          ) : rows === null ? (
            <p className="muted">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="muted">Personne n&apos;est encore classé. Choisis ton nom dans ton profil et sois le premier !</p>
          ) : (
            <table className="rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th className="num">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.username} className={me?.username === r.username ? "me" : undefined}>
                    <td className="pos">{medal(r.rank)}</td>
                    <td className="name">{r.username}</td>
                    <td className="num">{fmt(r.score)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}

function MyRank({ me, signedIn }: { me: RankRow | null; signedIn: boolean }) {
  if (!signedIn) {
    return (
      <p className="notice">
        <Link href="/connexion">Connecte-toi</Link> pour voir ta place dans le classement.
      </p>
    );
  }
  if (!me) return null;
  return (
    <div className="rank-me">
      <span className="rank-big">{me.rank ? medal(me.rank) : "–"}</span>
      <div className="rank-text">
        <strong>{me.username ?? "Toi"}</strong> · {fmt(me.score)} point{me.score > 1 ? "s" : ""}
        <div className="muted small">
          {!me.username ? (
            <>
              Tu n&apos;apparais pas encore : <Link href="/profil">choisis ton nom d&apos;utilisateur</Link>.
            </>
          ) : me.score === 0 ? (
            <>
              Ouvre ton premier <Link href="/cartes">booster</Link> pour entrer dans le classement.
            </>
          ) : (
            <>Ta place parmi tous les joueurs.</>
          )}
        </div>
      </div>
    </div>
  );
}
