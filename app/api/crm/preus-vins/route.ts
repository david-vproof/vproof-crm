import { NextResponse } from "next/server";

import { preusDelCataleg } from "@/serveis/crm-vins";

/**
 * El preu de tots els vins del catàleg a la tarifa de venda al major, en viu
 * de FactuSol, per als selectors de vins. Va a part del catàleg, com l'estoc:
 * si l'ERP no respon, el selector surt igual, sense preus. El middleware ja
 * exigeix sessió.
 */
export async function GET() {
  try {
    return NextResponse.json(await preusDelCataleg());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
