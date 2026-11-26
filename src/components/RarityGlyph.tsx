import type { Rarity } from "@/lib/cards";

/**
 * Symbole de rareté du design Raidly : chaque rareté a sa forme (cercle, losange, triangle, étoile,
 * hexagone percé, rosace), pour qu'on la reconnaisse sans la couleur.
 */
const GLYPH: Record<Rarity | "vitrail", string> = {
  commune: "M8 3a5 5 0 1 0 0 10 5 5 0 1 0 0-10z",
  rare: "M8 1.5L14.5 8 8 14.5 1.5 8z",
  epique: "M8 1.8l6.6 11.6H1.4z",
  legendaire: "M8 1l2.1 4.4 4.8.6-3.5 3.3.9 4.8L8 11.8l-4.3 2.3.9-4.8L1.1 6l4.8-.6z",
  mythique: "M8 1l6 3.5v7L8 15l-6-3.5v-7zM8 5.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 1 0 0-4.4z",
  vitrail: "M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13zM8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2",
};

export function RarityGlyph({ rarity, size = 14 }: { rarity: Rarity | "vitrail"; size?: number }) {
  const vitrail = rarity === "vitrail";
  return (
    <svg
      className={`rarity-glyph rarity-glyph-${rarity}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill={vitrail ? "none" : "currentColor"}
      fillRule="evenodd"
      stroke={vitrail ? "currentColor" : "none"}
      strokeWidth={vitrail ? 1.6 : undefined}
    >
      <path d={GLYPH[rarity]} />
    </svg>
  );
}
