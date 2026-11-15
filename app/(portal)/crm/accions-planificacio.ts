"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { llegeixCriteris, llegeixMode } from "@/domini/crm-segments";
import { GALETA_SESSIO, verificaToken } from "@/lib/sessio";
import { ErrorFitxa, desaFitxa } from "@/serveis/crm-manteniment";

export type EstatSegmentPlanificat = { error?: string; fet?: string };

/**
 * Desa com a segment la cerca d'una planificació, si es vol. Passa pel mateix
 * camí que el formulari de segments: la mateixa validació i el mateix rastre
 * de qui l'ha creat.
 */
export async function desaSegmentPlanificatAccio(dades: {
  nom: string;
  codi: string;
  mode: string;
  criteris: unknown;
}): Promise<EstatSegmentPlanificat> {
  const nom = String(dades.nom ?? "").trim();
  if (!nom) return { error: "Cal un nom per desar el segment." };

  // Els criteris arriben del navegador: es tornen a validar.
  const criteris = llegeixCriteris(dades.criteris);
  if (criteris.length === 0) return { error: "Aquesta tria no té cap criteri per desar." };

  const formulari = new FormData();
  formulari.set("nom", nom);
  formulari.set("codi", String(dades.codi ?? "").trim());
  formulari.set("estat", "actiu");
  formulari.set("mode", llegeixMode(dades.mode));
  formulari.set("criteris", JSON.stringify(criteris));

  try {
    const sessio = await verificaToken((await cookies()).get(GALETA_SESSIO)?.value);
    await desaFitxa("segments", null, formulari, sessio?.id ?? null);
  } catch (error) {
    if (error instanceof ErrorFitxa) return { error: error.message };
    return { error: `No s'ha pogut desar: ${(error as Error).message}` };
  }

  revalidatePath("/crm", "layout");
  return { fet: `Segment «${nom}» desat. Ja surt al Planificador.` };
}
