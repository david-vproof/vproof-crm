import { NextResponse, type NextRequest } from "next/server";

import { llegeixCriteris, llegeixMode } from "@/domini/crm-segments";
import { cercaClients, dadesSelectorClients } from "@/serveis/crm-clients";

/**
 * El selector de clients del CRM. GET porta els segments i les opcions dels
 * filtres; POST cerca. Va pel servidor, com tota la resta, i el middleware ja
 * exigeix sessió.
 */
export async function GET() {
  try {
    return NextResponse.json(await dadesSelectorClients());
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

export async function POST(peticio: NextRequest) {
  let cos: unknown;
  try {
    cos = await peticio.json();
  } catch {
    return NextResponse.json({ error: "Cos no vàlid." }, { status: 400 });
  }

  const { cerca, filtres, segmentat, senseSegment, mode, criteris } = (cos ?? {}) as Record<string, unknown>;
  // El que arriba del navegador no és de fiar: només text als filtres i criteris validats.
  const netsFiltres =
    filtres && typeof filtres === "object"
      ? Object.fromEntries(Object.entries(filtres as Record<string, unknown>).map(([camp, valor]) => [camp, String(valor ?? "")]))
      : {};

  try {
    return NextResponse.json(
      await cercaClients({
        cerca: typeof cerca === "string" ? cerca : "",
        filtres: netsFiltres,
        definicio: segmentat === true ? { mode: llegeixMode(mode), criteris: llegeixCriteris(criteris) } : null,
        senseSegment: senseSegment === true,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
