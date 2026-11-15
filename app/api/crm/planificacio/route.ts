import { NextResponse, type NextRequest } from "next/server";

import { comptesPerPlanificar } from "@/serveis/crm-segments";

/**
 * Els clients triats per a una planificació, amb el que se'n veu en un segment
 * (activitats, horari, facturació…). Va pel servidor, com tota la resta; el
 * middleware ja exigeix sessió.
 */
export async function POST(peticio: NextRequest) {
  let cos: unknown;
  try {
    cos = await peticio.json();
  } catch {
    return NextResponse.json({ error: "Cos no vàlid." }, { status: 400 });
  }

  const ids = (cos as { ids?: unknown })?.ids;
  if (!Array.isArray(ids)) return NextResponse.json({ error: "Falten els clients." }, { status: 400 });

  try {
    return NextResponse.json({ comptes: await comptesPerPlanificar(ids.map(String)) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
