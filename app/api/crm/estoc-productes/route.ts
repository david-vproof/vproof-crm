import { NextResponse } from "next/server";

import { estocDelCataleg } from "@/serveis/crm-productes";

/**
 * L'estoc de tots els productes del catàleg, en viu de l'ERP, per al selector
 * de productes. Va a part del catàleg: l'API de DELSOL de tant en tant es penja, i
 * el selector ha de sortir igual. El middleware ja exigeix sessió.
 */
export async function GET() {
  try {
    return NextResponse.json({ estocs: await estocDelCataleg() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
