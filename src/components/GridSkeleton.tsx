/** Cartes grisées affichées pendant le chargement des jeux. */
export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="game-grid" aria-busy="true" aria-label="Chargement des jeux">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="game-card skeleton">
          <div className="game-image" />
          <div className="game-body">
            <div className="line" style={{ width: "70%" }} />
            <div className="line" style={{ width: "45%" }} />
            <div className="line" style={{ width: "55%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
