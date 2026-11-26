/**
 * Les quêtes du jour, de la semaine et du mois (sans dépendance au navigateur, donc testables).
 * Chaque jour, chaque lundi et chaque 1er du mois (heure de Paris), de nouvelles quêtes tirées au hasard :
 * noter des jeux, ouvrir des boosters, obtenir une carte rare, compléter son album, passer à l'atelier…
 * Chaque quête finie rapporte une récompense UNE seule fois par période, ce qui remplace
 * l'ancien « +1 booster tous les 3 jeux notés », sans limite, qu'on pouvait répéter à l'infini.
 *
 * Avec les comptes, c'est le serveur qui compte les boosters ouverts, les cartes obtenues et les actions de l'atelier
 * (le navigateur ne peut pas les inventer), et c'est lui qui donne les récompenses.
 */
import type { PulledCard } from "./cards";
import type { Collection } from "./data";

/** Les trois sortes de quêtes : du jour, de la semaine (lundi → dimanche), du mois. */
export type Period = "day" | "week" | "month";

/** Ce que le serveur compte pendant la période (les notes, elles, sont lues dans tes données). */
export type Metric = "rated" | "opened" | "rare" | "fresh" | "workshop" | "recycled";
/** Le type de quête (au plus une de chaque par période) ; « all » = terminer toutes les autres. */
export type QuestId = Metric | "all";

export type Reward = { packs?: number; coins?: number };

export type Quest = { id: QuestId; icon: string; label: string; goal: number; reward: Reward };

type Variant = { goal: number; reward: Reward };
type Template = { id: Metric; icon: string; label: (n: number) => string; variants: Record<Period, Variant[]> };

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/**
 * Toutes les quêtes possibles. Pour chaque période, 3 sont tirées au hasard (avec un objectif qui varie),
 * plus une 4e « termine toutes les quêtes ». Le tirage dépend seulement de la date :
 * tout le monde a les mêmes quêtes en même temps, et le serveur peut le refaire pour vérifier.
 */
export const QUEST_TEMPLATES: Template[] = [
  {
    id: "rated",
    icon: "⭐",
    label: (n) => `Note ${n} ${plural(n, "jeu", "jeux")}`,
    variants: {
      day: [
        { goal: 2, reward: { coins: 20 } },
        { goal: 3, reward: { packs: 1 } },
        { goal: 5, reward: { packs: 1, coins: 15 } },
      ],
      week: [
        { goal: 10, reward: { packs: 2 } },
        { goal: 15, reward: { packs: 2, coins: 50 } },
      ],
      month: [
        { goal: 30, reward: { packs: 3, coins: 100 } },
        { goal: 50, reward: { packs: 5 } },
      ],
    },
  },
  {
    id: "opened",
    icon: "🎁",
    label: (n) => `Ouvre ${n} boosters`,
    variants: {
      day: [
        { goal: 2, reward: { coins: 15 } },
        { goal: 3, reward: { coins: 25 } },
        { goal: 4, reward: { coins: 35 } },
      ],
      week: [
        { goal: 15, reward: { coins: 100 } },
        { goal: 25, reward: { coins: 160 } },
      ],
      month: [
        { goal: 60, reward: { coins: 400 } },
        { goal: 90, reward: { packs: 2, coins: 400 } },
      ],
    },
  },
  {
    id: "rare",
    icon: "💎",
    label: (n) => (n > 1 ? `Obtiens ${n} cartes Rares ou mieux` : "Obtiens une carte Rare ou mieux"),
    variants: {
      day: [
        { goal: 1, reward: { coins: 20 } },
        { goal: 2, reward: { coins: 40 } },
      ],
      week: [
        { goal: 6, reward: { coins: 100 } },
        { goal: 10, reward: { packs: 1, coins: 80 } },
      ],
      month: [
        { goal: 25, reward: { coins: 400 } },
        { goal: 40, reward: { packs: 2, coins: 400 } },
      ],
    },
  },
  {
    id: "fresh",
    icon: "📒",
    label: (n) => `Ajoute ${n} nouvelles cartes à ton album`,
    variants: {
      day: [
        { goal: 3, reward: { coins: 20 } },
        { goal: 5, reward: { coins: 35 } },
      ],
      week: [
        { goal: 15, reward: { coins: 100 } },
        { goal: 25, reward: { packs: 1, coins: 100 } },
      ],
      month: [
        { goal: 60, reward: { coins: 400 } },
        { goal: 100, reward: { packs: 3, coins: 300 } },
      ],
    },
  },
  {
    id: "workshop",
    icon: "🛠️",
    label: (n) => (n > 1 ? `Fais ${n} actions à l'atelier` : "Fais une action à l'atelier"),
    variants: {
      day: [{ goal: 1, reward: { coins: 15 } }],
      week: [{ goal: 5, reward: { coins: 60 } }],
      month: [{ goal: 15, reward: { coins: 200 } }],
    },
  },
  {
    id: "recycled",
    icon: "♻️",
    label: (n) => `Recycle ${n} doublons à l'atelier`,
    variants: {
      day: [
        { goal: 3, reward: { coins: 15 } },
        { goal: 6, reward: { coins: 30 } },
      ],
      week: [
        { goal: 20, reward: { coins: 80 } },
        { goal: 40, reward: { coins: 150 } },
      ],
      month: [
        { goal: 80, reward: { coins: 300 } },
        { goal: 150, reward: { packs: 2, coins: 300 } },
      ],
    },
  },
];

/** Nombre de quêtes tirées pour chaque période (sans compter « termine toutes les quêtes »). */
export const QUESTS_PER_PERIOD = 3;

type PeriodInfo = {
  id: Period;
  /** « du jour », « de la semaine », « du mois » */
  of: string;
  tab: string;
  /** où l'avancement est rangé dans la collection */
  field: "quests" | "questsWeek" | "questsMonth";
  allReward: Reward;
};

export const PERIODS: PeriodInfo[] = [
  { id: "day", of: "du jour", tab: "Jour", field: "quests", allReward: { packs: 1 } },
  { id: "week", of: "de la semaine", tab: "Semaine", field: "questsWeek", allReward: { packs: 3 } },
  { id: "month", of: "du mois", tab: "Mois", field: "questsMonth", allReward: { packs: 6, coins: 500 } },
];

export const periodInfo = (p: Period) => PERIODS.find((x) => x.id === p)!;
export const isPeriod = (x: unknown): x is Period => PERIODS.some((p) => p.id === x);

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

/** Les quêtes d'une période (clé : AAAA-MM-JJ du jour ou du lundi, AAAA-MM du mois), toujours les mêmes pour elle. */
export function questsFor(period: Period, key: string): Quest[] {
  const random = seeded(period === "day" ? `quetes:${key}` : `quetes-${period}:${key}`);
  const pool = [...QUEST_TEMPLATES];
  const picked: Template[] = [];
  while (picked.length < QUESTS_PER_PERIOD && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  // toujours dans le même ordre d'affichage, quel que soit le tirage
  picked.sort((a, b) => QUEST_TEMPLATES.indexOf(a) - QUEST_TEMPLATES.indexOf(b));
  const quests: Quest[] = picked.map((t) => {
    const list = t.variants[period];
    const v = list[Math.floor(random() * list.length)];
    return { id: t.id, icon: t.icon, label: t.label(v.goal), goal: v.goal, reward: v.reward };
  });
  const info = periodInfo(period);
  return [
    ...quests,
    { id: "all", icon: "🏆", label: `Termine toutes les quêtes ${info.of}`, goal: quests.length, reward: info.allReward },
  ];
}

/** Les quêtes d'un jour (AAAA-MM-JJ). */
export const questsForDay = (day: string) => questsFor("day", day);

/** Avancement des quêtes d'une période (enregistré dans la collection, modifié seulement par le serveur). */
export type QuestState = {
  /** la période : jour AAAA-MM-JJ, semaine = date du lundi AAAA-MM-JJ, mois AAAA-MM (heure de Paris) */
  day: string;
  /** ce qui a été fait pendant la période : boosters ouverts, cartes rares, nouvelles cartes, actions et doublons recyclés */
  counts: Partial<Record<Exclude<Metric, "rated">, number>>;
  /** quêtes dont la récompense a déjà été récupérée pendant la période */
  claimed: QuestId[];
};

type QuestFields = Partial<Pick<Collection, "quests" | "questsWeek" | "questsMonth">>;

const PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Le jour à l'heure de Paris (AAAA-MM-JJ) : les quêtes changent à minuit, heure française. */
export function parisDay(now: number | Date = Date.now()): string {
  return PARIS.format(now);
}

const PARIS_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** Millisecondes avant minuit à Paris (l'heure des nouvelles quêtes du jour). */
export function msUntilReset(now = Date.now()): number {
  const [h, m, sec] = PARIS_TIME.format(now).split(":").map(Number);
  const elapsed = ((h * 60 + m) * 60 + sec) * 1000 + (now % 1000);
  return Math.max(0, 24 * 3600 * 1000 - elapsed);
}

const DAY_MS = 24 * 3600 * 1000;
/** Le jour de Paris sous forme de date UTC à minuit (pour compter les jours sans souci d'heure d'été). */
const asUtc = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** La clé de la période en cours : le jour, le lundi de la semaine, ou le mois (heure de Paris). */
export function periodKey(period: Period, now: number | Date = Date.now()): string {
  const day = parisDay(now);
  if (period === "day") return day;
  if (period === "month") return day.slice(0, 7);
  const t = asUtc(day);
  const sinceMonday = (new Date(t).getUTCDay() + 6) % 7;
  return ymd(t - sinceMonday * DAY_MS);
}

/**
 * Millisecondes avant les nouvelles quêtes : minuit, lundi minuit, ou le 1er du mois à minuit (heure de Paris).
 * (Juste pour l'affichage : peut se tromper d'une heure la nuit d'un changement d'heure.)
 */
export function msUntilPeriodEnd(period: Period, now = Date.now()): number {
  const tonight = msUntilReset(now);
  if (period === "day") return tonight;
  const d = new Date(asUtc(parisDay(now)));
  const daysLeft =
    period === "week"
      ? 6 - ((d.getUTCDay() + 6) % 7)
      : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate() - d.getUTCDate();
  return tonight + daysLeft * DAY_MS;
}

/** L'avancement d'une période : s'il date d'une période passée, tout repart de zéro. */
export function questState(c: QuestFields, period: Period, now = Date.now()): QuestState {
  const key = periodKey(period, now);
  const q = c[periodInfo(period).field];
  if (q && q.day === key) return { day: key, counts: { ...q.counts }, claimed: [...(q.claimed ?? [])] };
  return { day: key, counts: {}, claimed: [] };
}

/** Les quêtes du jour (voir questState). */
export const questsToday = (c: QuestFields, now = Date.now()) => questState(c, "day", now);

type RatingLike = { stars?: unknown; ratedAt?: unknown };

/** Nombre de jeux DIFFÉRENTS notés pendant la période en cours (heure de Paris). */
export function ratedIn(ratings: Record<string, RatingLike> | null | undefined, period: Period, now = Date.now()) {
  const key = periodKey(period, now);
  return Object.values(ratings ?? {}).filter((r) => {
    if (!r || typeof r.stars !== "number" || r.stars < 1 || r.stars > 5 || typeof r.ratedAt !== "string") return false;
    const t = Date.parse(r.ratedAt);
    return Number.isFinite(t) && periodKey(period, t) === key;
  }).length;
}

/** Nombre de jeux différents notés aujourd'hui. */
export const ratedToday = (ratings: Record<string, RatingLike> | null | undefined, now = Date.now()) => ratedIn(ratings, "day", now);

/** Jeux notés aujourd'hui, cette semaine et ce mois. */
export type RatedCounts = Record<Period, number>;
export function ratedCounts(ratings: Record<string, RatingLike> | null | undefined, now = Date.now()): RatedCounts {
  return { day: ratedIn(ratings, "day", now), week: ratedIn(ratings, "week", now), month: ratedIn(ratings, "month", now) };
}

/** Ajoute ce qui vient d'être fait aux quêtes du jour, de la semaine et du mois. */
function bump(c: Collection, add: QuestState["counts"], now: number): Collection {
  const next = { ...c };
  for (const p of PERIODS) {
    const q = questState(c, p.id, now);
    const counts = { ...q.counts };
    for (const [k, v] of Object.entries(add) as [keyof QuestState["counts"], number][]) counts[k] = (counts[k] ?? 0) + v;
    next[p.field] = { ...q, counts };
  }
  return next;
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

/** Où en est chaque quête de la période. `rated` = jeux différents notés pendant la période (voir ratedIn). */
export function questBoard(c: QuestFields, rated: number, now = Date.now(), period: Period = "day"): QuestView[] {
  const q = questState(c, period, now);
  const value = (id: Metric) => (id === "rated" ? rated : (q.counts[id] ?? 0));
  const list = questsFor(period, q.day);
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
 * Récupère la récompense d'une quête finie. Renvoie null si elle ne fait pas partie des quêtes de la période,
 * n'est pas finie ou a déjà été récupérée : dans ce cas rien ne change.
 */
export function claimQuest(
  c: Collection,
  id: QuestId,
  rated: number,
  now = Date.now(),
  period: Period = "day",
): { collection: Collection; reward: Reward } | null {
  const quest = questBoard(c, rated, now, period).find((x) => x.id === id);
  if (!quest || !quest.done || quest.claimed) return null;
  const q = questState(c, period, now);
  const { packs = 0, coins = 0 } = quest.reward;
  return {
    reward: quest.reward,
    collection: {
      ...c,
      extraPacks: (c.extraPacks ?? 0) + packs,
      coinsEarned: c.coinsEarned + coins,
      [periodInfo(period).field]: { ...q, claimed: [...q.claimed, id] },
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
