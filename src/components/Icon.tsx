/**
 * Icônes du design Raidly : grille 24, trait 2, bouts arrondis, couleur héritée du texte.
 * Elles remplacent les emojis dans l'interface.
 */
const PATHS = {
  gamepad: "M6 8h12a4 4 0 0 1 4 4v1.5a3.5 3.5 0 0 1-6.3 2.1L14.5 14h-5l-1.2 1.6A3.5 3.5 0 0 1 2 13.5V12a4 4 0 0 1 4-4zM7.5 10.5v3M6 12h3M15.5 11h.01M17.5 13h.01",
  sparkle: "M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
  cards: "M9 3h9a2 2 0 0 1 2 2v11M5 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z",
  notes: "M4 6h9M4 12h6M4 18h9M17.5 8l1.3 2.6 2.7.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.7-.4z",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM4.5 21a7.5 7.5 0 0 1 15 0",
  users: "M9 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 1 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M15.5 4.3a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5",
  login: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H3",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM20 20l-4-4",
  filter: "M4 6h16M7 12h10M10 18h4",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7",
  star: "M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6L12 17l-5.3 2.8 1-6-4.4-4.2 6-.9z",
  play: "M8 5.5v13a.5.5 0 0 0 .8.4l10-6.5a.5.5 0 0 0 0-.8l-10-6.5a.5.5 0 0 0-.8.4z",
  live: "M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3zM8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z",
  image: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 16l4.5-4.5 4 4 2-2L20 19M15.5 8.5h.01",
  video: "M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 10l5-3v10l-5-3",
  cart: "M3 4h2.2l2.3 11h10.3L20 7.5H6.3M9 19.5a1 1 0 1 0 0 .01M17 19.5a1 1 0 1 0 0 .01",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 7.5V12l3 2",
  calendar: "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8.5 3v4M15.5 3v4",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14",
  building: "M4 21h16M6 21V9.5L12 4l6 5.5V21M10 21v-5h4v5M10 11h4",
  tag: "M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0zM8 8h.01",
  modes: "M8 4a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM3 19a5 5 0 0 1 10 0M17 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5zM15 19.5h6.5a4 4 0 0 0-4.5-3.9",
  recycle: "M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3M18.5 3v4h-4M5.5 21v-4h4",
  coin: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM14.8 9.2c-.5-1-1.5-1.5-2.8-1.5-1.6 0-2.8.8-2.8 2.1 0 2.9 5.6 1.5 5.6 4.3 0 1.3-1.2 2.2-2.8 2.2-1.4 0-2.4-.6-2.9-1.6M12 6v1.7M12 16.3V18",
  wrench: "M14.7 3.5a5 5 0 0 0-4.9 6.6L3.5 16.4V20.5h4.1l6.3-6.3a5 5 0 0 0 6.6-4.9l-3 3-3.2-.5-.5-3.2z",
  booster: "M6.5 3h11l-1 2.5 1 2.5v13h-11V8l1-2.5zM6.5 8h11M10 13.5l2 1.5 2-1.5",
  album: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  lock: "M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2",
  monitor: "M3 4.5h18v11.5H3zM8 20h8M12 16v4",
  phone: "M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18h2",
  handheld: "M4 6h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 18H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 6zM7 6v12M17 6v12M4.8 10.5h.01M19.2 13.5h.01",
  console: "M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10.5 7h3M12 15.5h.01",
  chat: "M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5.5 4v-4.5V6A1.5 1.5 0 0 1 5 4.5z",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  "chevron-right": "M9.5 6l6 6-6 6",
  "chevron-left": "M14.5 6l-6 6 6 6",
  "chevron-down": "M6 9.5l6 6 6-6",
  menu: "M4 6h16M4 12h16M4 18h16",
  refresh: "M20 11a8 8 0 0 0-14.7-3.7M4 13a8 8 0 0 0 14.7 3.7M5 3.5v4h4M19 20.5v-4h-4",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 11v5.5M12 7.8h.01",
} as const;

export type IconName = keyof typeof PATHS;

const FILLABLE: Partial<Record<IconName, true>> = { star: true, play: true };

type Props = {
  name: IconName;
  size?: number;
  /** remplit l'étoile ou le triangle « lecture » */
  filled?: boolean;
  strokeWidth?: number;
  /** texte lu par les lecteurs d'écran ; sans lui, l'icône est décorative */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 20, filled, strokeWidth = 2, label, className }: Props) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled && FILLABLE[name] ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Icône d'une plateforme (aucun logo de marque redessiné : on écrit le nom à côté). */
export function platformIcon(slug: string): IconName {
  if (slug.startsWith("switch")) return "handheld";
  if (slug === "pc") return "monitor";
  if (slug === "mobile") return "phone";
  return "console";
}
