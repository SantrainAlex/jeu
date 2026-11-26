import { NextResponse } from "next/server";
import { getOffers, hasPrices } from "@/lib/shops";

/** Prix du moment d'un jeu PC : /api/prix?name=… (demandés par la fiche après son affichage). */
export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.slice(0, 200).trim();
  if (!name) return NextResponse.json({ error: "nom du jeu manquant" }, { status: 400 });
  if (!hasPrices()) return NextResponse.json({ offers: [] });
  try {
    const offers = await getOffers(name);
    return NextResponse.json({ offers }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    console.error("[jeu] prix indisponibles :", (e as Error).message);
    return NextResponse.json({ offers: [] }, { status: 502 });
  }
}
