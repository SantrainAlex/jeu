import { NextResponse } from "next/server";
import { getCardPool } from "@/lib/cardPool";

/** GET /api/cartes : toutes les cartes qu'on peut obtenir dans un booster. */
export async function GET() {
  try {
    return NextResponse.json(await getCardPool());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
