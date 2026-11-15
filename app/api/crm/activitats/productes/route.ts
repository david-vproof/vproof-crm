import { NextResponse, type NextRequest } from "next/server";

import { abastDeLaSessio } from "@/lib/sessio-actual";
import { MAXIM_PRODUCTES_PER_ACTIVITAT, posaProductesALesVisites } from "@/serveis/crm-productes";

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** Fins a quants clients d'un dia es poden donar d'un cop: més és un error, no una agenda. */
const MAXIM_CLIENTS = 500;

function llistaDIds(brut: unknown, maxim: number): string[] | null {
  if (!Array.isArray(brut) || brut.length > maxim) return null;
  const ids = brut.filter((valor): valor is string => typeof valor === "string" && UUID.test(valor));
  return ids.length === brut.length ? [...new Set(ids)] : null;
}

/**
 * Posa els productes de la cistella del selector a les activitats d'un dia de
 * visita: `{ dia, clients, articles }`. A cada activitat del dia d'un dels
 * clients o leads donats s'hi afegeixen els productes que no tingués; cap no se'n treu.
 * Només hi entren les activitats que veu qui té la sessió oberta, com a
 * l'agenda.
 */
export async function POST(peticio: NextRequest) {
  const cos = (await peticio.json().catch(() => null)) as { dia?: unknown; clients?: unknown; articles?: unknown } | null;
  const dia = typeof cos?.dia === "string" ? cos.dia : "";
  if (!DIA.test(dia)) return NextResponse.json({ error: "Cal un dia (AAAA-MM-DD)." }, { status: 400 });
  const clients = llistaDIds(cos?.clients, MAXIM_CLIENTS);
  if (!clients || clients.length === 0) return NextResponse.json({ error: "Cal dir de quins clients són les visites." }, { status: 400 });
  const articles = llistaDIds(cos?.articles, MAXIM_PRODUCTES_PER_ACTIVITAT);
  if (!articles || articles.length === 0) {
    return NextResponse.json(
      { error: `Cal entre 1 i ${MAXIM_PRODUCTES_PER_ACTIVITAT} productes: més no en caben en una activitat.` },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await posaProductesALesVisites(dia, (await abastDeLaSessio()).deQui, clients, articles));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
