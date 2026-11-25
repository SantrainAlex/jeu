import type { Data } from "./data";

const latestDay = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Fusionne les données de ce navigateur avec celles du compte, sans rien perdre :
 * - notes : on garde tout, et la plus récente si un jeu est noté des deux côtés ;
 * - plateformes : réunion des deux listes ;
 * - cartes : le plus grand nombre d'exemplaires de chaque carte (pas la somme, pour ne pas compter deux fois
 *   une collection déjà envoyée), tous les vitraux, et les compteurs de boosters les plus avancés.
 */
export function mergeData(local: Data, cloud: Data): Data {
  const ratings = { ...cloud.ratings };
  for (const [id, r] of Object.entries(local.ratings)) {
    const other = ratings[id];
    if (!other || r.ratedAt > other.ratedAt) ratings[id] = r;
  }

  const cards = { ...cloud.collection.cards };
  for (const [id, entry] of Object.entries(local.collection.cards)) {
    const other = cards[id];
    if (!other) cards[id] = entry;
    else
      cards[id] = {
        card: other.card,
        count: Math.max(other.count, entry.count),
        firstAt: other.firstAt < entry.firstAt ? other.firstAt : entry.firstAt,
      };
  }

  const vitraux = [...cloud.collection.vitraux];
  for (const v of local.collection.vitraux) {
    if (!vitraux.some((x) => x.number === v.number && x.card.id === v.card.id)) vitraux.push(v);
  }

  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

  return {
    profile: {
      owned: union(cloud.profile.owned, local.profile.owned),
      interested: union(cloud.profile.interested, local.profile.interested),
    },
    ratings,
    collection: {
      cards,
      vitraux,
      lastFreeDay: latestDay(local.collection.lastFreeDay, cloud.collection.lastFreeDay),
      bonusClaimed: Math.max(local.collection.bonusClaimed, cloud.collection.bonusClaimed),
      packsOpened: Math.max(local.collection.packsOpened, cloud.collection.packsOpened),
      vitrailsGiven: Math.max(local.collection.vitrailsGiven, cloud.collection.vitrailsGiven),
    },
  };
}
