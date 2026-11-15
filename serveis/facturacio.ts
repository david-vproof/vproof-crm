/**
 * La facturació dels clients: `crm_facturacio`, una fila per client i mes amb
 * la base imposable (sense IVA). La portarà l'ERP (vprooferp); mentrestant la
 * taula és buida i les xifres surten a zero.
 *
 * D'aquí surt també el resum que cada client porta a la seva fitxa (i que
 * ordena i filtra la llista de clients) i la seva categoria, que es calcula amb
 * la facturació de l'exercici passat.
 */
import "server-only";

import { actualitzaItems, llistaAmbTotal, llistaTot } from "@/apis/sqlite/crm";
import { FITXES } from "@/domini/crm-fitxes";
import { resumFacturacio, resumPerClient, type ResumFacturacio } from "@/domini/facturacio";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { categoriaDe } from "@/domini/crm-categoria";
import { frangesDeCategoria } from "@/serveis/crm-categoria";

const COLLECCIO = "crm_facturacio";
const LOT = 100;

async function perLots<T>(files: T[], escriu: (lot: T[]) => Promise<unknown>) {
  for (let i = 0; i < files.length; i += LOT) await escriu(files.slice(i, i + LOT));
}

/** Un valor del resum tal com es compara: els decimals poden arribar com a text. */
function normalitza(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : String(valor);
}

/**
 * Desa a cada client el resum que ensenya, ordena i filtra la llista de
 * clients. Es calcula a partir del que ja hi ha a `crm_facturacio` i només
 * s'escriuen els clients que han canviat. S'ha de cridar després de cada
 * importació de facturació de l'ERP.
 */
export async function recalculaResumsDeClients(ara: Date) {
  const [mesos, clients, franges] = await Promise.all([
    llistaTot<{ client: string | null; exercici: number; mes: number; base: number | string }>(COLLECCIO, ["client", "exercici", "mes", "base"]),
    llistaTot<Record<string, unknown> & { id: string }>(FITXES.clients.colleccio, ["id", ...CAMPS_RESUM_FACTURACIO, "categoria"]),
    frangesDeCategoria(),
  ]);

  const perClient = new Map<string, typeof mesos>();
  for (const mes of mesos) {
    if (!mes.client) continue;
    const llista = perClient.get(mes.client);
    if (llista) llista.push(mes);
    else perClient.set(mes.client, [mes]);
  }

  const canvis: ({ id: string } & Record<string, unknown>)[] = [];
  for (const client of clients) {
    const resum = resumPerClient(resumFacturacio(perClient.get(client.id) ?? [], ara));
    // La categoria surt de la facturació de l'exercici passat, per les franges de Configuració.
    const nou: Record<string, unknown> = { ...resum, categoria: categoriaDe(resum.facturacio_any_1, franges) };
    const igual = [...CAMPS_RESUM_FACTURACIO, "categoria"].every((camp) => normalitza(client[camp]) === normalitza(nou[camp]));
    if (!igual) canvis.push({ id: client.id, ...nou });
  }

  await perLots(canvis, (lot) => actualitzaItems(FITXES.clients.colleccio, lot));
  return canvis.length;
}

/** Les xifres de facturació d'un client, per la seva fitxa del CRM o pel seu codi de l'ERP. */
export async function resumDeFacturacio(
  filtre: { camp: "client" | "codi_client_erp"; valor: string },
  ara = new Date(),
): Promise<ResumFacturacio> {
  const { files } = await llistaAmbTotal<{ exercici: number; mes: number; base: number | string }>(COLLECCIO, {
    camps: ["exercici", "mes", "base"],
    filtre,
    limit: -1,
  });
  return resumFacturacio(files, ara);
}
