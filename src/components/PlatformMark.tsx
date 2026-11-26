import { getPlatform } from "@/lib/platforms";
import { Icon } from "./Icon";

/**
 * Repère d'une plateforme, reconnaissable d'un coup d'œil : la couleur de la marque et un sigle court
 * (NS, NS2, PS5, XS…). On n'utilise aucun logo déposé : seulement le nom, en abrégé.
 */
const CODE: Record<string, string> = {
  switch: "NS",
  "switch-2": "NS2",
  pc: "PC",
  ps5: "PS5",
  ps4: "PS4",
  xbox: "XS",
  "xbox-one": "XB1",
};

/** Texte clair ou foncé selon la couleur de fond, pour garder un bon contraste. */
function textOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  const white = 1.05 / (L + 0.05);
  const dark = (L + 0.05) / (0.0074 + 0.05); // fond #13110e
  return white >= dark ? "#ffffff" : "#13110e";
}

export function PlatformMark({ slug, size = "md" }: { slug: string; size?: "sm" | "md" }) {
  const p = getPlatform(slug);
  const color = p?.color ?? "#7a7062";
  const code = CODE[slug];
  return (
    <span
      className={`platform-mark platform-mark-${size}`}
      style={{ background: color, color: textOn(color) }}
      aria-hidden="true"
    >
      {code ?? <Icon name="phone" size={size === "sm" ? 12 : 22} />}
    </span>
  );
}
