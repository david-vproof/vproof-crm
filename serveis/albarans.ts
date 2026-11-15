/**
 * Els albarans d'un client, per a la pestanya de facturació de la seva fitxa.
 * Es llegeixen de la còpia que en manté la sincronització a Directus
 * (`crm_albarans` i les seves línies), no de FactuSol en directe.
 */
import "server-only";

import { llistaAmbTotal } from "@/apis/directus/crm";
import type { AlbaraDeFitxa } from "@/domini/albarans";

const COLLECCIO = "crm_albarans";

/** Albarans per pàgina a la fitxa. Cadascun pot portar moltes línies. */
export const ALBARANS_PER_PAGINA = 10;

const CAMPS = [
  "id", "serie", "numero", "data",
  "linies.id", "linies.posicio", "linies.descripcio", "linies.erp_article", "linies.quantitat", "linies.preu",
  "linies.descompte", "linies.import", "linies.erp_absent_des_de",
  "linies.article.id", "linies.article.nom", "linies.article.imatge",
];

export type AlbaransDelClient = { files: AlbaraDeFitxa[]; total: number; pagina: number; perPagina: number };

/** Els albarans vigents d'un client, els més nous primer. */
export async function albaransDelClient(client: string, pagina = 1): Promise<AlbaransDelClient> {
  const paginaSegura = Math.max(1, pagina);
  const { files, total } = await llistaAmbTotal<AlbaraDeFitxa>(COLLECCIO, {
    camps: CAMPS,
    ordre: "-data,-numero",
    limit: ALBARANS_PER_PAGINA,
    salta: (paginaSegura - 1) * ALBARANS_PER_PAGINA,
    condicions: [{ client: { _eq: client } }, { erp_absent_des_de: { _null: true } }],
  });
  return { files, total, pagina: paginaSegura, perPagina: ALBARANS_PER_PAGINA };
}
