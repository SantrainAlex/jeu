/** Affiché pendant le chargement de la fiche d'un jeu. */
export default function Loading() {
  return (
    <div className="game-page" aria-busy="true" aria-label="Chargement de la fiche">
      <div className="game-hero skeleton-block" style={{ minHeight: 320 }} />
      <div className="game-layout">
        <div className="game-main">
          <div className="skeleton-block" style={{ aspectRatio: "16 / 9", borderRadius: 14, marginTop: "2rem" }} />
        </div>
        <div className="game-aside">
          <div className="line" style={{ width: "60%", marginTop: "2rem" }} />
          <div className="line" style={{ width: "80%" }} />
          <div className="line" style={{ width: "50%" }} />
        </div>
      </div>
    </div>
  );
}
