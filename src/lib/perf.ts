/** Avis des joueurs sur la résolution et les FPS d'un jeu, plateforme par plateforme. */

export const RESOLUTIONS = ["720p", "900p", "1080p", "1440p", "4k"] as const;
export const FPS_VALUES = [30, 40, 60, 120] as const;
/** Plateformes qu'on peut noter (les mêmes que dans la base, voir supabase/schema.sql). */
export const PERF_PLATFORMS = ["switch", "switch-2", "pc", "ps5", "ps4", "xbox", "xbox-one", "mobile"] as const;

export type Resolution = (typeof RESOLUTIONS)[number];
export type Fps = (typeof FPS_VALUES)[number];

/** Un avis : sur telle plateforme, le jeu tourne à telle résolution, tant de FPS, de façon fluide ou non. */
export type PerfReport = { platform: string; resolution: Resolution; fps: Fps; stable: boolean };

/** Le résumé des avis pour une plateforme (ce que tout le monde voit). */
export type PerfSummary = { platform: string; votes: number; resolution: Resolution; fps: Fps; stablePct: number };

export const resolutionLabel = (r: Resolution) => (r === "4k" ? "4K" : r);

/** Vérifie un avis avant de l'envoyer (null s'il est incomplet ou invalide). */
export function parseReport(x: Partial<PerfReport> | null | undefined): PerfReport | null {
  if (!x) return null;
  const { platform, resolution, fps, stable } = x;
  if (!platform || !(PERF_PLATFORMS as readonly string[]).includes(platform)) return null;
  if (!resolution || !(RESOLUTIONS as readonly string[]).includes(resolution)) return null;
  if (!fps || !(FPS_VALUES as readonly number[]).includes(fps)) return null;
  if (typeof stable !== "boolean") return null;
  return { platform, resolution, fps, stable };
}

/** Lit les lignes renvoyées par la base (perf_summary) et ne garde que celles qui sont valides. */
export function toSummaries(rows: unknown): PerfSummary[] {
  if (!Array.isArray(rows)) return [];
  const out: PerfSummary[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const report = parseReport({ platform: r.platform as string, resolution: r.resolution as Resolution, fps: r.fps as Fps, stable: true });
    const votes = Number(r.votes);
    if (!report || !(votes > 0)) continue;
    out.push({ platform: report.platform, resolution: report.resolution, fps: report.fps, votes, stablePct: Math.min(100, Math.max(0, Math.round(Number(r.stable_pct) || 0))) });
  }
  return out;
}

/** « Fluide » / « Quelques ralentissements » / « Souvent saccadé », d'après la part des joueurs qui le trouvent fluide. */
export function smoothnessText(stablePct: number): string {
  if (stablePct >= 70) return "Fluide";
  if (stablePct >= 40) return "Quelques ralentissements";
  return "Souvent saccadé";
}

/** La plateforme où le jeu tourne le mieux d'après les joueurs (au moins 2 avis), ou null. */
export function bestPlatform(list: PerfSummary[]): PerfSummary | null {
  const score = (s: PerfSummary) => s.fps * 10 + RESOLUTIONS.indexOf(s.resolution) * 8 + s.stablePct / 5;
  const candidates = list.filter((s) => s.votes >= 2);
  if (candidates.length < 2) return null;
  return candidates.reduce((best, s) => (score(s) > score(best) ? s : best));
}
