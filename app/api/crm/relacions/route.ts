import { NextResponse, type NextRequest } from "next/server";

import { FITXES, esFitxa } from "@/domini/crm-fitxes";
import { cercaOpcions } from "@/serveis/crm-manteniment";

/**
 * Cerca per als desplegables de relació. Va pel servidor, com tota la resta:
 * el navegador no parla mai amb la base de dades. El middleware ja exigeix sessió.
 *
 * Amb `camp` i `valor` la cerca es limita a qui pengi d'aquella fitxa: és el
 * que fa que el contacte d'una activitat només ofereixi la gent del compte.
 */
export async function GET(peticio: NextRequest) {
  const parametres = peticio.nextUrl.searchParams;
  const fitxa = parametres.get("fitxa") ?? "";
  const cerca = parametres.get("q") ?? "";
  const camp = parametres.get("camp") ?? "";
  const valor = parametres.get("valor") ?? "";

  // Qualsevol fitxa que pugui sortir en un desplegable, tingui pestanya o no.
  if (!esFitxa(fitxa)) {
    return NextResponse.json({ error: "Fitxa desconeguda." }, { status: 400 });
  }

  // El camp del filtre ha de ser un camp de debò de la fitxa que es consulta:
  // el que arriba del navegador no mana sobre quina consulta es munta.
  if (camp && !FITXES[fitxa].camps.some((c) => c.nom === camp)) {
    return NextResponse.json({ error: "Aquest camp no existeix." }, { status: 400 });
  }

  try {
    const de = camp && valor ? { camp, valor } : null;
    return NextResponse.json({ opcions: await cercaOpcions(fitxa, cerca, undefined, de) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
