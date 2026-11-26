import { Icon } from "./Icon";

/**
 * Texte d'un lien qui ouvre un autre site : le texte prend la place disponible (et passe à la ligne si besoin),
 * la flèche reste toujours au même endroit, à droite, sans jamais partir seule à la ligne.
 */
export function ExternalLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="ext-label">{children}</span>
      <Icon name="external" size={16} className="ext-icon" />
      <span className="sr-only"> (s&apos;ouvre dans un nouvel onglet)</span>
    </>
  );
}
