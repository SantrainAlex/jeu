/**
 * Infos de la boutique Steam (API publique, sans clé) : prise en charge de la manette,
 * configuration PC demandée et description en français.
 */

export type Controller = "full" | "partial" | null;
export type Requirement = { label: string; value: string };
export type PcRequirements = { minimum: Requirement[]; recommended: Requirement[] };

export type SteamInfo = {
  controller: Controller;
  pc: PcRequirements | null;
  /** courte description en français (null si Steam n'en a pas) */
  shortFr: string | null;
};

/** Numéro du jeu sur Steam, lu dans le lien de sa page (store.steampowered.com/app/123/…). */
export function steamAppId(stores: { url: string }[]): number | null {
  for (const s of stores) {
    const m = /store\.steampowered\.com\/app\/(\d+)/.exec(s.url);
    if (m) return Number(m[1]);
  }
  return null;
}

const decode = (t: string) =>
  t
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** Noms des lignes de configuration en français. */
const LABELS: Record<string, string> = {
  os: "Système",
  "système d'exploitation": "Système",
  "système d'exploitation *": "Système",
  processor: "Processeur",
  processeur: "Processeur",
  memory: "Mémoire",
  mémoire: "Mémoire",
  graphics: "Carte graphique",
  graphiques: "Carte graphique",
  "carte graphique": "Carte graphique",
  directx: "DirectX",
  storage: "Stockage",
  stockage: "Stockage",
  "espace disque": "Stockage",
  network: "Réseau",
  réseau: "Réseau",
  "sound card": "Carte son",
  "carte son": "Carte son",
  "additional notes": "Remarques",
  "notes supplémentaires": "Remarques",
};

/**
 * Lit une configuration Steam (du HTML du type « <li><strong>Processeur :</strong> Intel i5</li> »)
 * et la transforme en lignes « nom / valeur ».
 */
export function parseRequirements(html: string | undefined): Requirement[] {
  if (!html) return [];
  const rows: Requirement[] = [];
  for (const m of html.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
    const item = m[1];
    const label = /<strong>([\s\S]*?)<\/strong>/i.exec(item);
    if (!label) continue;
    const name = text(label[1]).replace(/\s*:\s*$/, "").trim();
    const value = text(item.replace(label[0], ""));
    if (!name || !value) continue;
    rows.push({ label: LABELS[name.toLowerCase()] ?? name, value });
  }
  return rows.slice(0, 8);
}

type AppDetails = {
  controller_support?: string;
  categories?: { id: number }[];
  short_description?: string;
  pc_requirements?: { minimum?: string; recommended?: string } | [];
};

/** Transforme la réponse Steam en infos pour la fiche. */
export function toSteamInfo(d: AppDetails): SteamInfo {
  const cats = (d.categories ?? []).map((c) => c.id);
  // catégories Steam : 28 = manette entièrement prise en charge, 18 = en partie
  const controller: Controller =
    d.controller_support === "full" || cats.includes(28)
      ? "full"
      : d.controller_support === "partial" || cats.includes(18)
        ? "partial"
        : null;
  const req = Array.isArray(d.pc_requirements) ? {} : (d.pc_requirements ?? {});
  const minimum = parseRequirements(req.minimum);
  const recommended = parseRequirements(req.recommended);
  const short = d.short_description ? text(d.short_description) : "";
  return {
    controller,
    pc: minimum.length || recommended.length ? { minimum, recommended } : null,
    shortFr: short.length >= 40 ? short : null,
  };
}

/** Infos Steam d'un jeu, en français (null si Steam ne connaît pas ce numéro). */
export async function steamInfo(appId: number): Promise<SteamInfo | null> {
  const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=french&cc=fr`, {
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Steam a répondu ${res.status}`);
  const body = (await res.json()) as Record<string, { success: boolean; data?: AppDetails }>;
  const entry = body[String(appId)];
  return entry?.success && entry.data ? toSteamInfo(entry.data) : null;
}
