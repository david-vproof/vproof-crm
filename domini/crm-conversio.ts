/**
 * Què passa amb el que penja d'un lead quan es converteix en client.
 *
 * Les seves activitats i els seus To-Do passen a ser també del client que n'ha
 * sortit, sense deixar de dir de quin lead vénen: així surten a la fitxa del
 * client i compten per a la seva periodicitat i la seva darrera visita, i si la
 * conversió es desfà o canvia de client, el segueixen.
 */
import { idDeRelacio } from "@/domini/crm-fitxes";

/** Una activitat o un To-Do d'un lead, amb el client que porta i el que té el seu lead. */
export type FilaDelLead = { id: string; client: unknown; lead: { client: unknown } | null };

/**
 * Les files que no porten el client que els toca, agrupades pel que han de
 * portar: el del seu lead, o cap (null) si el lead ja no està convertit.
 */
export function canvisDeClient(files: FilaDelLead[]): Map<string | null, string[]> {
  const canvis = new Map<string | null, string[]>();
  for (const fila of files) {
    if (!fila.lead) continue;
    const toca = idDeRelacio(fila.lead.client) || null;
    if ((idDeRelacio(fila.client) || null) === toca) continue;
    canvis.set(toca, [...(canvis.get(toca) ?? []), fila.id]);
  }
  return canvis;
}
