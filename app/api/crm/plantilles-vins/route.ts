import { NextResponse, type NextRequest } from "next/server";

import { llegeixDadesDePlantilla } from "@/app/api/crm/plantilles-vins/dades";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { ErrorPlantilla, creaPlantilla, llistaPlantilles } from "@/serveis/plantilles-vins";

/** Les plantilles del configurador de vins, per nom. */
export async function GET() {
  try {
    return NextResponse.json({ plantilles: await llistaPlantilles() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

/** Desa la cistella com una plantilla nova. */
export async function POST(peticio: NextRequest) {
  try {
    const dades = llegeixDadesDePlantilla(await peticio.json().catch(() => null));
    const id = await creaPlantilla(dades, (await abastDeLaSessio()).jo);
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ErrorPlantilla) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
