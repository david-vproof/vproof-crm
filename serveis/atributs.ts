/**
 * Els atributs dels clients (vegeu `domini/atributs.ts`), a `crm_client_atributs`.
 * Són del CRM i no de l'ERP: la sincronització no els toca.
 */
import "server-only";

import { agrupaPer, creaItems, esborraItem, llistaAmbTotal, obteItem } from "@/apis/sqlite/crm";
import { type Atribut, mateixAtribut, netejaAtribut } from "@/domini/atributs";

const COLLECCIO = "crm_client_atributs";

type FilaAtribut = {
  id: string;
  text: string | null;
  date_created: string | null;
  activitat: { assumpte: string | null } | null;
  comercial: { first_name: string | null; last_name: string | null } | null;
};

/** Els atributs d'un client, en l'ordre en què es van posar. */
export async function atributsDelClient(client: string): Promise<Atribut[]> {
  const { files } = await llistaAmbTotal<FilaAtribut>(COLLECCIO, {
    camps: ["id", "text", "date_created", "activitat.assumpte", "comercial.first_name", "comercial.last_name"],
    ordre: "date_created",
    limit: -1,
    condicions: [{ client: { _eq: client } }],
  });
  return files.map((fila) => ({
    id: fila.id,
    text: fila.text ?? "",
    creat: fila.date_created,
    qui: [fila.comercial?.first_name, fila.comercial?.last_name].filter(Boolean).join(" ") || null,
    activitat: fila.activitat?.assumpte ?? null,
  }));
}

/**
 * Afegeix atributs a un client. Els que ja té (sense mirar majúscules) no es
 * repeteixen. Torna quants n'ha afegit de nous.
 */
export async function afegeixAtributs(
  client: string,
  textos: string[],
  { activitat = null, comercial = null }: { activitat?: string | null; comercial?: string | null } = {},
): Promise<number> {
  const ja = (await atributsDelClient(client)).map((atribut) => atribut.text);
  const nous: string[] = [];
  for (const brut of textos) {
    const text = netejaAtribut(brut);
    if (!text || [...ja, ...nous].some((previ) => mateixAtribut(previ, text))) continue;
    nous.push(text);
  }
  if (nous.length === 0) return 0;
  await creaItems(
    COLLECCIO,
    nous.map((text) => ({ client, text, ...(activitat ? { activitat } : {}), ...(comercial ? { comercial } : {}) })),
  );
  return nous.length;
}

/** Treu un atribut. Torna el client de qui era, per refrescar-ne la fitxa. */
export async function esborraAtribut(id: string): Promise<string | null> {
  const atribut = await obteItem<{ client: string | null }>(COLLECCIO, id, ["client"]);
  if (!atribut) return null;
  await esborraItem(COLLECCIO, id);
  return atribut.client;
}

/**
 * Els clients que tenen algun atribut, per posar-los la «A» a les llistes.
 * D'una sola consulta agrupada: la taula és petita i així no cal passar-hi els
 * ids de cada llista, que no cabrien a l'adreça.
 */
export async function clientsAmbAtributs(): Promise<Set<string>> {
  const grups = await agrupaPer(COLLECCIO, "client");
  return new Set(grups.filter((grup) => grup.quants > 0).map((grup) => grup.valor));
}
