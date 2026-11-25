import { NextResponse } from "next/server";
import { getLives, hasTwitch } from "@/lib/twitch";

/** Lives Twitch d'un jeu : /api/lives?name=…&igdb=… (demandés par la fiche après son affichage). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const name = params.get("name")?.slice(0, 200).trim();
  const igdb = Number(params.get("igdb"));
  if (!name) return NextResponse.json({ error: "nom du jeu manquant" }, { status: 400 });
  if (!hasTwitch()) return NextResponse.json({ available: false });
  try {
    const lives = await getLives({ name, igdbId: Number.isInteger(igdb) && igdb > 0 ? igdb : null });
    return NextResponse.json({ available: true, ...lives }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    console.error("[jeu] lives Twitch indisponibles :", (e as Error).message);
    return NextResponse.json({ available: false }, { status: 502 });
  }
}
