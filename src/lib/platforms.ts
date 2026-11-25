export type Platform = {
  slug: string;
  name: string;
  /** Identifiants des plateformes dans l'API RAWG */
  rawgIds: number[];
  /** Identifiants des plateformes dans l'API IGDB */
  igdbIds: number[];
  color: string;
};

export const PLATFORMS: Platform[] = [
  { slug: "switch", name: "Nintendo Switch", rawgIds: [7], igdbIds: [130], color: "#e60012" },
  { slug: "pc", name: "PC", rawgIds: [4], igdbIds: [6], color: "#4a90d9" },
  { slug: "ps5", name: "PlayStation 5", rawgIds: [187], igdbIds: [167], color: "#2e6bd6" },
  { slug: "ps4", name: "PlayStation 4", rawgIds: [18], igdbIds: [48], color: "#1f4fa8" },
  { slug: "xbox", name: "Xbox Series X|S", rawgIds: [186], igdbIds: [169], color: "#107c10" },
  { slug: "xbox-one", name: "Xbox One", rawgIds: [1], igdbIds: [49], color: "#2b8a2b" },
  { slug: "mobile", name: "Mobile (iOS / Android)", rawgIds: [3, 21], igdbIds: [39, 34], color: "#8e44ad" },
];

export function getPlatform(slug: string): Platform | undefined {
  return PLATFORMS.find((p) => p.slug === slug);
}

export const PERIODS = {
  jour: { label: "Du jour", days: 1 },
  semaine: { label: "De la semaine", days: 7 },
  mois: { label: "Du mois", days: 30 },
} as const;

export type Period = keyof typeof PERIODS;

export function parsePeriod(value: string | undefined): Period {
  return value === "jour" || value === "mois" ? value : "semaine";
}
