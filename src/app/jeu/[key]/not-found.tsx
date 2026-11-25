import Link from "next/link";

export default function NotFound() {
  return (
    <div className="game-page">
      <h1>Jeu introuvable</h1>
      <p className="muted">Ce jeu n&apos;existe pas ou n&apos;est plus disponible.</p>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/" className="button">Retour à l&apos;accueil</Link>
      </p>
    </div>
  );
}
