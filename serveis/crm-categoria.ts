/**
 * Les franges de la categoria i la categoria de cada client.
 *
 * Les franges viuen a `crm_categories` i es canvien a Configuració. La
 * categoria es desa al camp `categoria` de cada client, així que es veu igual
 * a tot arreu on surten clients (llista, fitxa, selector, segments, mapa). La
 * calcula la passada de clients, amb el resum de facturació, i es recalcula a
 * tots els clients de cop quan es desen franges noves. El potencial no hi té
 * res a veure: el posa a mà qui porta el compte.
 */
import "server-only";

import { actualitzaItems, agrupaPer, creaItems, llistaTot, type Condicio } from "@/apis/directus/crm";
import { FITXES, condicionsExcloses } from "@/domini/crm-fitxes";
import { ORDRE_FRANGES, llegeixFranges, categoriaDe, validaFranges, type Franja } from "@/domini/crm-categoria";

const COLLECCIO = "crm_categories";
const LOT = 100;

type FilaFranja = { id: string; lletra: string | null; des_de: number | string | null };

export class ErrorCategoria extends Error {}

export async function frangesDeCategoria(): Promise<Franja[]> {
  return llegeixFranges(await llistaTot<FilaFranja>(COLLECCIO, ["id", "lletra", "des_de"]));
}

/**
 * Posa a cada client la lletra que li toca per la facturació de l'exercici
 * passat, que ja porta el seu resum. Només escriu els que canvien.
 */
export async function recalculaCategories(franges?: Franja[]): Promise<number> {
  const [llindars, clients] = await Promise.all([
    franges ?? frangesDeCategoria(),
    llistaTot<{ id: string; facturacio_any_1: number | string | null; categoria: string | null }>(
      FITXES.clients.colleccio,
      ["id", "facturacio_any_1", "categoria"],
    ),
  ]);

  const canvis = clients
    .map((client) => ({ id: client.id, anterior: client.categoria, categoria: categoriaDe(Number(client.facturacio_any_1) || 0, llindars) }))
    .filter((client) => client.categoria !== client.anterior)
    .map(({ id, categoria }) => ({ id, categoria }));

  for (let i = 0; i < canvis.length; i += LOT) await actualitzaItems(FITXES.clients.colleccio, canvis.slice(i, i + LOT));
  return canvis.length;
}

/** Desa les franges i recalcula la categoria de tots els clients. Torna quants han canviat de lletra. */
export async function desaFranges(franges: Franja[]): Promise<number> {
  const error = validaFranges(franges);
  if (error) throw new ErrorCategoria(error);

  const existents = await llistaTot<FilaFranja>(COLLECCIO, ["id", "lletra"]);
  const perLletra = new Map(existents.map((fila) => [fila.lletra, fila.id]));
  const netes = ORDRE_FRANGES.map((lletra) => franges.find((f) => f.lletra === lletra)!);

  await actualitzaItems(
    COLLECCIO,
    netes.filter((f) => perLletra.has(f.lletra)).map((f) => ({ id: perLletra.get(f.lletra)!, des_de: f.desDe })),
  );
  await creaItems(COLLECCIO, netes.filter((f) => !perLletra.has(f.lletra)).map((f) => ({ lletra: f.lletra, des_de: f.desDe })));

  return recalculaCategories(netes);
}

/** Quants clients hi ha a cada lletra, només dels que surten al CRM: sense els de baixa ni els d'altres tipus. */
export async function clientsPerCategoria(): Promise<Record<string, number>> {
  const excloses = condicionsExcloses(FITXES.clients);
  const files = await agrupaPer(FITXES.clients.colleccio, "categoria", excloses.length > 0 ? ({ _and: excloses } as Condicio) : undefined);
  return Object.fromEntries(files.map((fila) => [fila.valor, fila.quants]));
}
