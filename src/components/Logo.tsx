import { SITE_NAME } from "@/lib/site";

/** Logo Raidly : un autocollant au coin plié qui porte un R, suivi du nom du site. */
export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo" role="img" aria-label={SITE_NAME}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path className="logo-b" d="M9 3H21L29 11V23A6 6 0 0 1 23 29H9A6 6 0 0 1 3 23V9A6 6 0 0 1 9 3Z" />
        <path className="logo-f" d="M21 3L29 11H23A2 2 0 0 1 21 9Z" />
        <path className="logo-r" d="M10.5 23V9.5H16A4 4 0 0 1 16 17.5H10.5M15 17.5L20.5 23" />
      </svg>
      {wordmark && (
        <span className="logo-w" aria-hidden="true" style={{ fontSize: Math.round(size * 0.78) }}>
          {SITE_NAME}
        </span>
      )}
    </span>
  );
}
