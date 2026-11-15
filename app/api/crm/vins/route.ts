import { NextResponse, type NextRequest } from "next/server";

import { cercaVins } from "@/serveis/crm-vins";

/**
 * La cerca del selector de vins de les activitats: els articles actius del
 * catàleg. Va pel servidor, com tota la resta, i el middleware ja exigeix sessió.
 */
export async function GET(peticio: NextRequest) {
  const cerca = (peticio.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  try {
    return NextResponse.json(await cercaVins(cerca));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
