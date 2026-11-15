/**
 * Les fotos de les activitats, a la biblioteca de fitxers de Directus. Què es
 * desa i quan ho decideix `desaFitxa`, a `serveis/crm-manteniment.ts`.
 */
import "server-only";

import { idCarpeta, llegeixFitxer, obteItem, pujaFitxer } from "@/apis/directus/crm";
import { FITXES, esVisiblePer, idDeRelacio } from "@/domini/crm-fitxes";

/** La carpeta de Directus on van. La crea `scripts/crm-directus.mjs`; si no hi és, van a l'arrel. */
const CARPETA = "Fotos d'activitats";

export async function pujaFotoDActivitat(dades: Uint8Array<ArrayBuffer>, titol: string) {
  const carpeta = await idCarpeta(CARPETA).catch(() => null);
  return pujaFitxer({ nom: "activitat.jpg", tipus: "image/jpeg", dades, titol, carpeta });
}

/** La foto d'una activitat, per servir-la al navegador. Null si no en té o no és de qui la demana. */
export async function fotoDActivitat(id: string, deQui: string | null) {
  const fitxa = FITXES.activitats;
  const activitat = await obteItem<Record<string, unknown>>(fitxa.colleccio, id, ["foto", "comercial"]);
  if (!activitat || !esVisiblePer(fitxa, activitat, deQui)) return null;
  const fitxer = idDeRelacio(activitat.foto);
  if (!fitxer) return null;
  return { fitxer, resposta: await llegeixFitxer(fitxer) };
}
