import { GridSkeleton } from "@/components/GridSkeleton";

// Affiché instantanément quand on ouvre une plateforme, le temps que les jeux arrivent.
export default function Loading() {
  return (
    <>
      <div className="line skeleton-title" />
      <div className="line" style={{ width: 320, height: 36, borderRadius: 999, margin: "1rem 0 1.5rem" }} />
      <GridSkeleton />
    </>
  );
}
