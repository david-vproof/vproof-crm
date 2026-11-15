import { NextResponse, type NextRequest } from "next/server";

import { abastDeLaSessio } from "@/lib/sessio-actual";
import { calendariDelPlanner, setmanaDelPlanner } from "@/serveis/crm-planner";

/**
 * El calendari del Planner en JSON, per triar-hi un dia des d'un modal (el
 * selector de vins): `?m=AAAA-MM` el mes, o `?pv=setmana&s=AAAA-MM-DD` la
 * setmana. És l'agenda de qui té la sessió oberta: la seva, o la de tothom si
 * és administrador. Va pel servidor, i el middleware ja exigeix sessió.
 */
export async function GET(peticio: NextRequest) {
  const params = peticio.nextUrl.searchParams;
  const { deQui } = await abastDeLaSessio();
  try {
    if (params.get("pv") === "setmana") return NextResponse.json(await setmanaDelPlanner(params.get("s") ?? undefined, deQui));
    return NextResponse.json(await calendariDelPlanner(params.get("m") ?? undefined, deQui));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
