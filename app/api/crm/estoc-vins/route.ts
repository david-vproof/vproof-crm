import { NextResponse } from "next/server";

import { estocDelCataleg } from "@/serveis/crm-vins";

/**
 * L'estoc de tots els vins del catàleg, en viu de FactuSol, per al selector
 * de vins. Va a part del catàleg: l'API de DELSOL de tant en tant es penja, i
 * el selector ha de sortir igual. El middleware ja exigeix sessió.
 */
export async function GET() {
  try {
    return NextResponse.json({ estocs: await estocDelCataleg() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
