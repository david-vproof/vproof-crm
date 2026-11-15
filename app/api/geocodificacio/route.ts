import { NextResponse, type NextRequest } from "next/server";

import { ErrorLimitGeocodificacio, cercaLlocs } from "@/apis/geocodificacio";

/**
 * Cerca de llocs per al mapa petit de la fitxa. Va pel servidor perquè
 * Nominatim vol un User-Agent propi i un ritme d'una consulta per segon, i
 * això només es pot garantir des d'aquí. El middleware ja exigeix sessió.
 */
export async function GET(peticio: NextRequest) {
  const q = peticio.nextUrl.searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ llocs: await cercaLlocs(q) });
  } catch (error) {
    const estat = error instanceof ErrorLimitGeocodificacio ? 429 : 502;
    return NextResponse.json({ error: (error as Error).message }, { status: estat });
  }
}
