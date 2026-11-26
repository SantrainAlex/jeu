/**
 * Les quêtes du jour (sans dépendance au navigateur, donc testables).
 * Chaque jour (heure de Paris), de nouvelles quêtes tirées au hasard : noter des jeux, ouvrir des boosters,
 * obtenir une carte rare, compléter son album, passer à l'atelier… Chaque quête finie rapporte une récompense UNE seule fois par jour, ce qui remplace
 * l'ancien « +1 booster tous les 3 jeux notés », sans limite, qu'on pouvait répéter à l'infini.
 *
 * Avec les comptes, c'est le serveur qui compte les boosters ouverts, les cartes obtenues et les actions de l'atelier
 * (le navigateur ne peut pas les inventer), et c'est lui qui donne les récompenses.
 */
import type { PulledCard } from "./cards";
import type { Collection } from "./data";

/** Ce que le serveur compte pendant la journée (les notes, elles, sont lues dans tes données). */
export type Metric = "rated" | "opened" | "rare" | "fresh" | "workshop" | "recycled";
/** Le type de quête (au plus une de chaque par jour) ; « all » = terminer toutes les autres. */
export type QuestId = Metric | "all";

export type Reward = { packs?: number; coins?: number };

export type Quest = { id: QuestId; icon: string; label: string; goal: number; reward: Reward };

type Variant = { goal: number; reward: Reward };
type Template = { id: Metric; icon: string; label: (n: number) => string; variants: Variant[] };

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/**
 * Toutes les quêtes possibles. Chaque jour, 3 sont tirées au hasard (avec un objectif qui varie),
 * plus une 4e « termine toutes les quêtes du jour ». Le tirage dépend seulement de la date :
 * tout le monde a les mêmes quêtes le même jour, et le serveur peut le refaire pour vérifier.
 */
export const QUEST_TEMPLATES: Template[] = [
  {
    id: "rated",
    icon: "⭐",
    label: (n) => `Note ${n} ${plural(n, "jeu", "jeux")}`,
    variants: [
      { goal: 2, reward: { coins: 20 } },
      { goal: 3, reward: { packs: 1 } },
      { goal: 5, reward: { packs: 1, coins: 15 } },
    ],
  },
  {
    id: "opened",
    icon: "🎁",
    label: (n) => `Ouvre ${n} boosters`,
    variants: [
      { goal: 2, reward: { coins: 15 } },
      { goal: 3, reward: { coins: 25 } },
      { goal: 4, reward: { coins: 35 } },
    ],
  },
  {
    id: "rare",
    icon: "💎",
    label: (n) => (n > 1 ? `Obtiens ${n} cartes Rares ou mieux` : "Obtiens une carte Rare ou mieux"),
    variants: [
      { goal: 1, reward: { coins: 20 } },
      { goal: 2, reward: { coins: 40 } },
    ],
  },
  {
    id: "fresh",
    icon: "📒",
    label: (n) => `Ajoute ${n} nouvelles cartes à ton album`,
    variants: [
      { goal: 3, reward: { coins: 20 } },
      { goal: 5, reward: { coins: 35 } },
    ],
  },
  {
    id: "workshop",
    icon: "🛠️",
    label: () => "Fais une action à l'atelier",
    variants: [{ goal: 1, reward: { coins: 15 } }],
  },
  {
    id: "recycled",
    icon: "♻️",
    label: (n) => `Recycle ${n} doublons à l'atelier`,
    variants: [
      { goal: 3, reward: { coins: 15 } },
      { goal: 6, reward: { coins: 30 } },
    ],
  },
];

/** Nombre de quêtes tirées chaque jour (sans compter « termine toutes les quêtes »). */
export const QUESTS_PER_DAY = 3;
export const ALL_REWARD: Reward = { packs: 1 };

export const QUEST_IDS: QuestId[] = [...QUEST_TEMPLATES.map((t) => t.id), "all"];

/** Petit générateur de hasard qui donne toujours la même suite pour la même date. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Les quêtes d'un jour (AAAA-MM-JJ), toujours les mêmes pour ce jour-là. */
export function questsForDay(day: string): Quest[] {
  const random = seeded(`quetes:${day}`);
  const pool = [...QUEST_TEMPLATES];
  const picked: Template[] = [];
  while (picked.length < QUESTS_PER_DAY && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  // toujours dans le même ordre d'affichage, quel que soit le tirage
  picked.sort((a, b) => QUEST_TEMPLATES.indexOf(a) - QUEST_TEMPLATES.indexOf(b));
  const quests: Quest[] = picked.map((t) => {
    const v = t.variants[Math.floor(random() * t.variants.length)];
    return { id: t.id, icon: t.icon, label: t.label(v.goal), goal: v.goal, reward: v.reward };
  });
  return [...quests, { id: "all", icon: "🏆", label: "Termine toutes les quêtes du jour", goal: quests.length, reward: ALL_REWARD }];
}

/** Avancement des quêtes pour un jour donné (enregistré dans la collection, modifié seulement par le serveur). */
export type QuestState = {
  /** jour à l'heure de Paris, AAAA-MM-JJ */
  day: string;
  /** ce qui a été fait aujourd'hui : boosters ouverts, cartes rares, nouvelles cartes, actions et doublons recyclés */
  counts: Partial<Record<Exclude<Metric, "rated">, number>>;
  /** quêtes dont la récompense a déjà été récupérée aujourd'hui */
  claimed: QuestId[];
};

const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Le jour à l'heure de Paris (AAAA-MM-JJ) : les quêtes changent à minuit, heure française. */
export function parisDay(now: number | Date = Date.now()): string {
  return PARIS.format(now);
}

const PARIS_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Millisecondes avant minuit à Paris (l'heure des nouvelles quêtes). */
export function msUntilReset(now = Date.now()): number {
  const [h, m, sec] = PARIS_TIME.format(now).split(":").map(Number);
  const elapsed = ((h * 60 + m) * 60 + sec) * 1000 + (now % 1000);
  return Math.max(0, 24 * 3600 * 1000 - elapsed);
}

/** Les quêtes du jour : si l'avancement enregistré date d'un autre jour, tout repart de zéro. */
export function questsToday(c: Pick<Collection, "quests">, now = Date.now()): QuestState {
  const day = parisDay(now);
  const q = c.quests;
  if (q && q.day === day) return { day, counts: { ...q.counts }, claimed: [...(q.claimed ?? [])] };
  return { day, counts: {}, claimed: [] };
}

/** Nombre de jeux DIFFÉRENTS notés aujourd'hui (heure de Paris). */
export function ratedToday(ratings: Record<string, { stars?: unknown; ratedAt?: unknown }> | null | undefined, now = Date.now()) {
  const day = parisDay(now);
  return Object.values(ratings ?? {}).filter((r) => {
    if (!r || typeof r.stars !== "number" || r.stars < 1 || r.stars > 5 || typeof r.ratedAt !== "string") return false;
    const t = Date.parse(r.ratedAt);
    return Number.isFinite(t) && parisDay(t) === day;
  }).length;
}

function bump(c: Collection, add: QuestState["counts"], now: number): Collection {
  const q = questsToday(c, now);
  const counts = { ...q.counts };
  for (const [k, v] of Object.entries(add) as [keyof QuestState["counts"], number][]) counts[k] = (counts[k] ?? 0) + v;
  return { ...c, quests: { ...q, counts } };
}

/** Une carte Rare, Épique, Légendaire, Mythique ou un vitrail. */
const isRareOrBetter = (c: PulledCard) => Boolean(c.vitrail) || c.rarity !== "commune";

/** Note qu'un booster vient d'être ouvert : cartes Rares ou mieux, nouvelles cartes pour l'album. */
export function recordBooster(c: Collection, pulled: PulledCard[], now = Date.now()): Collection {
  return bump(c, { opened: 1, rare: pulled.filter(isRareOrBetter).length, fresh: pulled.filter((p) => p.isNew).length }, now);
}

/** Note qu'une action de l'atelier a été faite (et combien de doublons ont été recyclés). */
export function recordWorkshop(c: Collection, recycled: number, now = Date.now()): Collection {
  return bump(c, { workshop: 1, recycled }, now);
}

export type QuestView = Quest & { progress: number; done: boolean; claimed: boolean };

/** Où en est chaque quête du jour. `rated` = jeux différents notés aujourd'hui (voir ratedToday). */
export function questBoard(c: Pick<Collection, "quests">, rated: number, now = Date.now()): QuestView[] {
  const q = questsToday(c, now);
  const value = (id: Metric) => (id === "rated" ? rated : (q.counts[id] ?? 0));
  const list = questsForDay(q.day);
  const base = list
    .filter((x) => x.id !== "all")
    .map((x) => {
      const progress = Math.min(x.goal, value(x.id as Metric));
      return { ...x, progress, done: progress >= x.goal, claimed: q.claimed.includes(x.id) };
    });
  const all = list.find((x) => x.id === "all")!;
  const doneCount = base.filter((x) => x.done).length;
  return [...base, { ...all, progress: doneCount, done: doneCount >= all.goal, claimed: q.claimed.includes("all") }];
}

/**
 * Récupère la récompense d'une quête finie. Renvoie null si elle ne fait pas partie des quêtes du jour,
 * n'est pas finie ou a déjà été récupérée aujourd'hui : dans ce cas rien ne change.
 */
export function claimQuest(
  c: Collection,
  id: QuestId,
  rated: number,
  now = Date.now(),
): { collection: Collection; reward: Reward } | null {
  const quest = questBoard(c, rated, now).find((x) => x.id === id);
  if (!quest || !quest.done || quest.claimed) return null;
  const q = questsToday(c, now);
  const { packs = 0, coins = 0 } = quest.reward;
  return {
    reward: quest.reward,
    collection: {
      ...c,
      extraPacks: (c.extraPacks ?? 0) + packs,
      coinsEarned: c.coinsEarned + coins,
      quests: { ...q, claimed: [...q.claimed, id] },
    },
  };
}

/**
 * Passage à l'ancien système : les boosters « tous les 3 jeux notés » gagnés mais pas encore ouverts sont gardés,
 * au plus 3, comme boosters en plus. On ne le fait qu'une fois (ensuite `extraPacks` existe).
 */
export const LEGACY_BONUS_MAX = 3;
export function withLegacyBonus(c: Collection, ratingsCount: number): Collection {
  if (c.extraPacks !== undefined) return c;
  const pending = Math.max(0, Math.floor(ratingsCount / 3) - (c.bonusClaimed ?? 0));
  return { ...c, extraPacks: Math.min(LEGACY_BONUS_MAX, pending) };
}

/** « 1 booster », « 25 pièces », « 1 booster + 10 pièces ». */
export function rewardLabel(r: Reward) {
  const parts: string[] = [];
  if (r.packs) parts.push(`${r.packs} booster${r.packs > 1 ? "s" : ""}`);
  if (r.coins) parts.push(`${r.coins} pièces`);
  return parts.join(" + ");
}
