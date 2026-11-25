/**
 * Règles des cartes à collectionner (sans dépendance au navigateur, donc testables).
 * Chaque jeu vidéo devient une carte avec une rareté. On ouvre des boosters de 5 cartes.
 */

export type Rarity = "commune" | "rare" | "epique" | "legendaire" | "mythique";

export const RARITIES: { id: Rarity; label: string; color: string; chance: number }[] = [
  // Chances par carte. Ton tableau faisait 100,04 % au total : la Commune est ajustée à 88,96 % pour faire 100 %.
  { id: "commune", label: "Commune", color: "#9ca3af", chance: 0.8896 },
  { id: "rare", label: "Rare", color: "#3b82f6", chance: 0.097 },
  { id: "epique", label: "Épique", color: "#a855f7", chance: 0.01 },
  { id: "legendaire", label: "Légendaire", color: "#eab308", chance: 0.0032 },
  { id: "mythique", label: "Mythique", color: "#ec4899", chance: 0.0002 },
];

export const PACK_SIZE = 5;

/** Chance qu'un pack contienne un vitrail numéroté (à la place d'une carte), tant qu'il en reste. */
export const VITRAIL_CHANCE = 1 / 500;
/** Nombre total de vitraux numérotés à distribuer. */
export const VITRAIL_TOTAL = 300;

export function rarityInfo(id: Rarity) {
  return RARITIES.find((r) => r.id === id)!;
}

/** Probabilité qu'un pack de 5 contienne au moins une carte de cette rareté : 1 - (1 - p)^5. */
export function packChance(cardChance: number, packSize = PACK_SIZE) {
  return 1 - Math.pow(1 - cardChance, packSize);
}

/** Les mêmes chiffres que ton tableau « Chances par pack ». */
export function oddsTable() {
  return RARITIES.map((r) => {
    const pack = packChance(r.chance);
    const n = 1 / pack;
    // « 1 pack sur 2,5 » : une décimale en dessous de 10, sinon un nombre entier
    return { ...r, pack, onePackIn: pack > 0.999 ? null : n < 10 ? Math.round(n * 10) / 10 : Math.round(n) };
  });
}

/** Tire une rareté selon les chances. `random` renvoie un nombre entre 0 et 1 (Math.random par défaut). */
export function rollRarity(random: () => number = Math.random): Rarity {
  let roll = random();
  // on part de la plus rare pour que les arrondis profitent à la Commune
  for (const r of [...RARITIES].reverse()) {
    if (roll < r.chance) return r.id;
    roll -= r.chance;
  }
  return "commune";
}

// ---------- Cartes ----------

export type Card = {
  /** identifiant du jeu (le même que pour les notes) */
  id: number;
  name: string;
  image: string | null;
  rarity: Rarity;
  released: string | null;
};

/** Seuils de rareté selon le classement de popularité du jeu (1 = le plus populaire). */
const RANK_TIERS: [number, Rarity][] = [
  [5, "mythique"],
  [20, "legendaire"],
  [50, "epique"],
  [110, "rare"],
];

/** Les jeux les plus populaires deviennent les cartes les plus rares. */
export function rarityForRank(rank: number): Rarity {
  for (const [max, rarity] of RANK_TIERS) if (rank <= max) return rarity;
  return "commune";
}

/** Carte sortie d'un booster ; `isNew` = tu ne l'avais pas encore. */
export type PulledCard = Card & { vitrail?: number; isNew?: boolean };

/**
 * Ouvre un booster : 5 cartes tirées au hasard selon les chances.
 * Si la chance du vitrail tombe (et qu'il en reste), une des cartes est remplacée par un vitrail numéroté.
 */
export function openPack(
  pool: Card[],
  opts: { vitrailsLeft: number; nextVitrailNumber: number; random?: () => number },
): { cards: PulledCard[]; vitrailUsed: boolean } {
  const random = opts.random ?? Math.random;
  const byRarity = new Map<Rarity, Card[]>();
  for (const c of pool) byRarity.set(c.rarity, [...(byRarity.get(c.rarity) ?? []), c]);

  const pick = (rarity: Rarity): Card => {
    // si une rareté n'a aucune carte (catalogue trop petit), on prend la rareté la plus proche
    const order = RARITIES.map((r) => r.id);
    const start = order.indexOf(rarity);
    const tries = [...order.slice(0, start + 1).reverse(), ...order.slice(start + 1)];
    for (const r of tries) {
      const list = byRarity.get(r);
      if (list?.length) return list[Math.floor(random() * list.length)];
    }
    throw new Error("Aucune carte disponible");
  };

  const cards: PulledCard[] = Array.from({ length: PACK_SIZE }, () => pick(rollRarity(random)));

  let vitrailUsed = false;
  if (opts.vitrailsLeft > 0 && random() < VITRAIL_CHANCE) {
    // le vitrail est toujours une carte prestigieuse (épique ou mieux), à la place de la dernière carte
    const prestige = pool.filter((c) => c.rarity !== "commune" && c.rarity !== "rare");
    const base = prestige.length ? prestige[Math.floor(random() * prestige.length)] : cards[PACK_SIZE - 1];
    cards[PACK_SIZE - 1] = { ...base, vitrail: opts.nextVitrailNumber };
    vitrailUsed = true;
  }

  // les cartes les plus rares à la fin, pour le suspense
  const rank = (c: PulledCard) => (c.vitrail ? 99 : RARITIES.findIndex((r) => r.id === c.rarity));
  cards.sort((a, b) => rank(a) - rank(b));
  return { cards, vitrailUsed };
}

// ---------- Boosters disponibles ----------

/** Un booster offert tous les N nouveaux jeux notés. */
export const RATINGS_PER_BONUS = 3;

/** Jour local au format AAAA-MM-JJ (le booster gratuit revient chaque jour à minuit). */
export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function availablePacks(state: { lastFreeDay: string | null; bonusClaimed: number }, ratingsCount: number, today = localDay()) {
  const free = state.lastFreeDay === today ? 0 : 1;
  const bonus = Math.max(0, Math.floor(ratingsCount / RATINGS_PER_BONUS) - state.bonusClaimed);
  return { free, bonus, total: free + bonus };
}
