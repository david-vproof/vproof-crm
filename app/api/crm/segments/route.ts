import { NextResponse, type NextRequest } from "next/server";

import { llegeixCriteris, llegeixMode } from "@/domini/crm-segments";
import { provaSegment } from "@/serveis/crm-segments";

/**
 * Prova d'un segment mentre s'està muntant: quants comptes hi entrarien i
 * quins són els primers. Va pel servidor, com tota la resta; el middleware ja
 * exigeix sessió.
 */
export async function POST(peticio: NextRequest) {
  let cos: unknown;
  try {
    cos = await peticio.json();
  } catch {
    return NextResponse.json({ error: "Cos no vàlid." }, { status: 400 });
  }

  const { mode, criteris } = (cos ?? {}) as { mode?: unknown; criteris?: unknown };

  try {
    const resultat = await provaSegment({ mode: llegeixMode(mode), criteris: llegeixCriteris(criteris) });
    return NextResponse.json(resultat);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
