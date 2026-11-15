import { NextResponse, type NextRequest } from "next/server";

import { abastDeLaSessio } from "@/lib/sessio-actual";
import { clientsDelDia } from "@/serveis/crm-vins";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Els clients que es visiten un dia (`?dia=AAAA-MM-DD`), per al selector de
 * vins: els de les activitats del dia que veu qui té la sessió oberta.
 */
export async function GET(peticio: NextRequest) {
  const dia = peticio.nextUrl.searchParams.get("dia") ?? "";
  if (!DIA.test(dia)) return NextResponse.json({ error: "Cal un dia (AAAA-MM-DD)." }, { status: 400 });
  try {
    return NextResponse.json(await clientsDelDia(dia, (await abastDeLaSessio()).deQui));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
