/**
 * Où acheter un jeu : liens vers les boutiques (avec ton code d'affiliation s'il est configuré)
 * et prix du moment chez les boutiques PC officielles (IsThereAnyDeal).
 *
 * Variables d'environnement (toutes facultatives) :
 * - INSTANT_GAMING_IGR : ton code d'affiliation Instant Gaming (la valeur après « igr= » dans ton lien)
 * - AMAZON_TAG : ton identifiant Amazon Partenaires (ex. « monsite-21 »)
 * - ITAD_API_KEY : clé gratuite IsThereAnyDeal, pour afficher les prix des boutiques PC
 */

export type ShopLink = { shop: string; url: string; affiliate: boolean };

export type Offer = {
  shop: string;
  /** prix actuel et prix habituel, en euros */
  price: number;
  regular: number;
  /** réduction en pourcentage (0 si pas de promo) */
  cut: number;
  currency: string;
  url: string;
};

/** Liens « voir le prix » vers les boutiques, avec le code d'affiliation quand il est configuré. */
export function shopLinks(name: string, env: Record<string, string | undefined> = process.env): ShopLink[] {
  const q = encodeURIComponent(name);
  const ig = new URL(`https://www.instant-gaming.com/fr/rechercher/?q=${q}`);
  if (env.INSTANT_GAMING_IGR) ig.searchParams.set("igr", env.INSTANT_GAMING_IGR);
  const amazon = new URL(`https://www.amazon.fr/s?k=${q}&i=videogames`);
  if (env.AMAZON_TAG) amazon.searchParams.set("tag", env.AMAZON_TAG);
  return [
    { shop: "Instant Gaming", url: ig.toString(), affiliate: Boolean(env.INSTANT_GAMING_IGR) },
    { shop: "Amazon", url: amazon.toString(), affiliate: Boolean(env.AMAZON_TAG) },
  ];
}

export function hasPrices() {
  return Boolean(process.env.ITAD_API_KEY);
}

const ITAD = "https://api.isthereanydeal.com";

type ItadDeal = {
  shop: { name: string };
  price: { amount: number; currency: string };
  regular: { amount: number };
  cut: number;
  url: string;
};

/** Transforme les offres IsThereAnyDeal : les moins chères d'abord, une par boutique, 6 au plus. */
export function toOffers(deals: ItadDeal[], max = 6): Offer[] {
  const seen = new Set<string>();
  return [...deals]
    .sort((a, b) => a.price.amount - b.price.amount)
    .filter((d) => !seen.has(d.shop.name) && seen.add(d.shop.name))
    .slice(0, max)
    .map((d) => ({
      shop: d.shop.name,
      price: d.price.amount,
      regular: d.regular.amount,
      cut: d.cut,
      currency: d.price.currency,
      url: d.url,
    }));
}

/** Les prix du moment (en France) d'un jeu PC, trouvé par son titre. Liste vide si le jeu est inconnu. */
export async function getOffers(name: string): Promise<Offer[]> {
  const key = process.env.ITAD_API_KEY ?? "";
  const opts = { next: { revalidate: 21600 }, signal: AbortSignal.timeout(5000) }; // les prix : 6 heures de cache
  const lookup = await fetch(`${ITAD}/games/lookup/v1?${new URLSearchParams({ key, title: name })}`, opts);
  if (!lookup.ok) throw new Error(`IsThereAnyDeal a répondu ${lookup.status}`);
  const found = (await lookup.json()) as { found: boolean; game?: { id: string } };
  if (!found.found || !found.game) return [];

  const res = await fetch(`${ITAD}/games/prices/v3?${new URLSearchParams({ key, country: "FR" })}`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([found.game.id]),
  });
  if (!res.ok) throw new Error(`IsThereAnyDeal a répondu ${res.status}`);
  const [prices] = (await res.json()) as { deals: ItadDeal[] }[];
  return toOffers(prices?.deals ?? []);
}
