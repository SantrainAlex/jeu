"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cloudEnabled, deletePerf, getMyPerf, getPerfSummary, savePerf, useCloud } from "@/lib/cloud";
import {
  bestPlatform,
  FPS_VALUES,
  parseReport,
  RESOLUTIONS,
  resolutionLabel,
  smoothnessText,
  type PerfReport,
  type PerfSummary,
} from "@/lib/perf";

type Plat = { slug: string; short: string; color: string };
type Draft = Partial<PerfReport>;

/**
 * « D'après les joueurs » : la résolution et les FPS que les joueurs constatent sur chaque plateforme,
 * et un petit formulaire pour donner son propre avis. Cachée tant que la table n'existe pas dans Supabase.
 */
export function PlayerPerf({ gameId, platforms }: { gameId: number; platforms: Plat[] }) {
  const cloud = useCloud();
  const [summary, setSummary] = useState<PerfSummary[] | null>(null);
  const [mine, setMine] = useState<PerfReport[]>([]);
  const [draft, setDraft] = useState<Draft>({ platform: platforms[0]?.slug });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    getPerfSummary(gameId).then((s) => alive && setSummary(s));
    return () => {
      alive = false;
    };
  }, [gameId]);

  useEffect(() => {
    if (cloud.status !== "signedIn") return setMine([]);
    let alive = true;
    getMyPerf(gameId).then((m) => alive && setMine(m));
    return () => {
      alive = false;
    };
  }, [gameId, cloud.status, cloud.userId]);

  // quand on change de plateforme, on reprend son avis déjà donné (s'il existe)
  const pick = (platform: string) => {
    setDraft(mine.find((m) => m.platform === platform) ?? { platform });
    setMessage(null);
  };
  useEffect(() => {
    if (draft.platform && !draft.resolution) {
      const old = mine.find((m) => m.platform === draft.platform);
      if (old) setDraft(old);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);

  if (!cloudEnabled || summary === null || platforms.length === 0) return null;

  const byPlatform = new Map(summary.map((s) => [s.platform, s]));
  const best = bestPlatform(summary);
  const nameOf = (slug: string) => platforms.find((p) => p.slug === slug)?.short ?? slug;
  const existing = mine.find((m) => m.platform === draft.platform);
  const report = parseReport(draft);
  const set = (patch: Draft) => {
    setDraft((d) => ({ ...d, ...patch }));
    setMessage(null);
  };

  async function refresh() {
    const [s, m] = await Promise.all([getPerfSummary(gameId), getMyPerf(gameId)]);
    if (s) setSummary(s);
    setMine(m);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!report) return;
    setSaving(true);
    const error = await savePerf(gameId, report);
    if (!error) await refresh();
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: "Merci, ton avis est enregistré !" });
  }

  async function remove() {
    if (!draft.platform) return;
    setSaving(true);
    const error = await deletePerf(gameId, draft.platform);
    if (!error) {
      await refresh();
      setDraft({ platform: draft.platform });
    }
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: "Ton avis est retiré." });
  }

  return (
    <div className="player-perf">
      <h3>D&apos;après les joueurs</h3>
      {best && (
        <p className="perf-best">
          C&apos;est sur <strong>{nameOf(best.platform)}</strong> que le jeu tourne le mieux d&apos;après les joueurs.
        </p>
      )}
      <div className="perf-table" role="table" aria-label="Résolution et FPS par plateforme">
        {platforms.map((p) => {
          const s = byPlatform.get(p.slug);
          return (
            <div key={p.slug} className="perf-row" role="row">
              <span className="perf-plat" role="cell">{p.short}</span>
              {s ? (
                <>
                  <span role="cell"><strong>{resolutionLabel(s.resolution)}</strong></span>
                  <span role="cell"><strong>{s.fps} FPS</strong></span>
                  <span role="cell" className="muted">{smoothnessText(s.stablePct)}</span>
                  <span role="cell" className="muted small">{s.votes} avis</span>
                </>
              ) : (
                <span role="cell" className="muted perf-none">Pas encore d&apos;avis</span>
              )}
            </div>
          );
        })}
      </div>

      {cloud.status !== "signedIn" ? (
        <p className="muted small perf-login">
          Tu y as joué ? <Link href="/connexion">Connecte-toi</Link> pour dire comment il tourne chez toi.
        </p>
      ) : (
        <form className="perf-form" onSubmit={submit}>
          <p className="muted small">Tu y as joué ? Dis comment il tourne chez toi.</p>
          <Choice label="Plateforme">
            {platforms.map((p) => (
              <ChipButton key={p.slug} active={draft.platform === p.slug} onClick={() => pick(p.slug)}>
                {p.short}
                {mine.some((m) => m.platform === p.slug) && " ✓"}
              </ChipButton>
            ))}
          </Choice>
          <Choice label="Résolution">
            {RESOLUTIONS.map((r) => (
              <ChipButton key={r} active={draft.resolution === r} onClick={() => set({ resolution: r })}>
                {resolutionLabel(r)}
              </ChipButton>
            ))}
          </Choice>
          <Choice label="FPS">
            {FPS_VALUES.map((f) => (
              <ChipButton key={f} active={draft.fps === f} onClick={() => set({ fps: f })}>
                {f}
              </ChipButton>
            ))}
          </Choice>
          <Choice label="Fluidité">
            <ChipButton active={draft.stable === true} onClick={() => set({ stable: true })}>
              Fluide
            </ChipButton>
            <ChipButton active={draft.stable === false} onClick={() => set({ stable: false })}>
              Ça rame parfois
            </ChipButton>
          </Choice>
          <div className="perf-actions">
            <button type="submit" className="perf-submit" disabled={!report || saving}>
              {saving ? "Enregistrement…" : existing ? "Modifier mon avis" : "Envoyer mon avis"}
            </button>
            {existing && (
              <button type="button" className="chip" onClick={remove} disabled={saving}>
                Retirer mon avis
              </button>
            )}
          </div>
          {message && <p className={message.ok ? "sync" : "notice"}>{message.text}</p>}
        </form>
      )}
    </div>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="filter-row">
      <span className="filter-label">{label}</span>
      <div className="filter-chips">{children}</div>
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`chip${active ? " active" : ""}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}
