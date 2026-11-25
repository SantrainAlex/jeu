import { NextResponse, type NextRequest } from "next/server";
import { getPlatform } from "@/lib/platforms";
import { getCandidates } from "@/lib/rawg";

/**
 * GET /api/recommandations?genres=action,rpg&platforms=switch,pc
 * Renvoie des jeux candidats ; le classement selon tes notes se fait dans le navigateur.
 * (Passer par ici garde la clé RAWG secrète, côté serveur.)
 */
export async function GET(req: NextRequest) {
  const list = (name: string) =>
    (req.nextUrl.searchParams.get(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const genres = list("genres").slice(0, 5);
  if (genres.length === 0) return NextResponse.json({ games: [], demo: !process.env.RAWG_API_KEY });

  const platformIds = list("platforms").flatMap((slug) => getPlatform(slug)?.rawgIds ?? []);
  try {
    return NextResponse.json(await getCandidates(platformIds, genres));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
