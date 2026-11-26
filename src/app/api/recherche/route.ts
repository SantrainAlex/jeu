import { NextResponse } from "next/server";
import { suggestGames } from "@/lib/games";
import { gameHref } from "@/lib/details";

/** Suggestions de la barre de recherche : /api/recherche?q=ins → quelques jeux (nom, année, image, adresse de la fiche). */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ games: [] });
  try {
    const games = await suggestGames(q);
    return NextResponse.json(
      {
        games: games.map((g) => ({
          id: g.id,
          name: g.name,
          year: g.released ? g.released.slice(0, 4) : null,
          image: g.image,
          href: gameHref(g),
        })),
      },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (e) {
    console.error("[jeu] suggestions indisponibles :", (e as Error).message);
    return NextResponse.json({ games: [] }, { status: 502 });
  }
}
