import { NextResponse, type NextRequest } from "next/server";
import { getCandidates } from "@/lib/games";
import { getPlatform, type Platform } from "@/lib/platforms";

/**
 * GET /api/recommandations?genres=action,rpg&platforms=switch,pc
 * Renvoie des jeux candidats ; le classement selon tes notes se fait dans le navigateur.
 * (Passer par ici garde les clés RAWG et IGDB secrètes, côté serveur.)
 */
export async function GET(req: NextRequest) {
  const list = (name: string) =>
    (req.nextUrl.searchParams.get(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const genres = list("genres").slice(0, 5);
  if (genres.length === 0) return NextResponse.json({ games: [], demo: false, sources: [] });

  const platforms = list("platforms").map(getPlatform).filter((p): p is Platform => Boolean(p));
  try {
    return NextResponse.json(await getCandidates(platforms, genres));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
