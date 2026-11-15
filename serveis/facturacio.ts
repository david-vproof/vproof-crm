/**
 * La facturació dels clients: F_FAC, i a l'any en curs també els albarans de
 * F_ALB encara no facturats → crm_facturacio.
 *
 * No té passada pròpia: va just després de cada passada de clients, que és la
 * que deixa al dia a quina fitxa del CRM correspon cada codi de client. Llegeix
 * els tres exercicis de la finestra (dos enrere i l'actual) agrupats per client
 * i mes, i deixa Directus igual: crea, actualitza i esborra els mesos que
 * calgui. És una còpia de l'ERP, així que aquí esborrar no perd res de ningú.
 */
import "server-only";

import { actualitzaItems, creaItems, esborraItems, llistaAmbTotal, llistaTot } from "@/apis/directus/crm";
import { llistaAlbaransPendentsDExercici, llistaFacturacioDExercici } from "@/apis/factusol";
import { FITXES } from "@/domini/crm-fitxes";
import { ESTAT_CLIENT_BAIXA } from "@/domini/factusol-vocabulari";
import {
  ambAlbaransPendents,
  diferenciesFacturacio,
  exercicisDeFacturacio,
  mesosDeFactusol,
  resumFacturacio,
  resumPerClient,
  type FilaFacturacio,
  type MesFacturat,
  type ResumFacturacio,
} from "@/domini/facturacio";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { categoriaDe } from "@/domini/crm-categoria";
import { frangesDeCategoria } from "@/serveis/crm-categoria";

const COLLECCIO = "crm_facturacio";
const LOT = 100;

async function perLots<T>(files: T[], escriu: (lot: T[]) => Promise<unknown>) {
  for (let i = 0; i < files.length; i += LOT) await escriu(files.slice(i, i + LOT));
}

export type ResultatFacturacio = {
  mesos: number;
  creats: number;
  actualitzats: number;
  esborrats: number;
  iguals: number;
  exercicisSenseLlegir: number[];
  /** Clients amb el resum de la llista posat al dia. */
  resums: number;
};

/** Un valor del resum tal com es compara: Directus torna els decimals com a text. */
function normalitza(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : String(valor);
}

/**
 * Desa a cada client el resum que ensenya, ordena i filtra la llista de
 * clients. Es calcula a partir del que ja hi ha a `crm_facturacio` i només
 * s'escriuen els clients que han canviat.
 */
async function desaResumsDeClients(ara: Date) {
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

export async function sincronitzaFacturacio(ara: Date): Promise<ResultatFacturacio> {
  const exercicis = exercicisDeFacturacio(ara);
  const actual = exercicis[exercicis.length - 1];

  // D'un en un: cada exercici és una base de dades a part i porta el seu testimoni.
  const erp: MesFacturat[] = [];
  const llegits: number[] = [];
  for (const exercici of exercicis) {
    try {
      const mesos = mesosDeFactusol(exercici, await llistaFacturacioDExercici(exercici));
      // Si els albarans no es poden llegir, l'exercici queda sense llegir i no se'n toca res:
      // desar només les factures faria baixar els clients d'un dia per l'altre.
      erp.push(...(exercici === actual ? ambAlbaransPendents(exercici, mesos, await llistaAlbaransPendentsDExercici(exercici)) : mesos));
      llegits.push(exercici);
    } catch {
      // Un exercici que no respon no para la resta; els seus mesos es deixen com estaven.
    }
  }

  const [directus, clients] = await Promise.all([
    llistaTot<FilaFacturacio>(COLLECCIO, ["id", "client", "codi_client_erp", "exercici", "mes", "base", "factures"]),
    llistaTot<{ id: string; codi_erp: number | null; estat: string | null; erp_absent_des_de: string | null }>(
      FITXES.clients.colleccio,
      ["id", "codi_erp", "estat", "erp_absent_des_de"],
    ),
  ]);

  // Els clients de baixa, o que ja no són a l'ERP, no porten facturació: no surten enlloc.
  const perCodi = new Map(
    clients
      .filter((client) => client.codi_erp !== null && !client.erp_absent_des_de && client.estat !== ESTAT_CLIENT_BAIXA.valor)
      .map((client) => [Number(client.codi_erp), client.id]),
  );

  const diferencies = diferenciesFacturacio(erp, directus, perCodi, llegits, exercicis[0]);
  const instant = ara.toISOString();
  await perLots(diferencies.crear, (lot) => creaItems(COLLECCIO, lot.map((fila) => ({ ...fila, erp_sincronitzat_el: instant }))));
  await perLots(diferencies.actualitzar, (lot) =>
    actualitzaItems(COLLECCIO, lot.map((fila) => ({ ...fila, erp_sincronitzat_el: instant }))),
  );
  await perLots(diferencies.esborrar, (lot) => esborraItems(COLLECCIO, lot));
  // Amb els mesos al dia, el resum de cada client per a la llista.
  const resums = await desaResumsDeClients(ara);

  return {
    resums,
    mesos: erp.length,
    creats: diferencies.crear.length,
    actualitzats: diferencies.actualitzar.length,
    esborrats: diferencies.esborrar.length,
    iguals: diferencies.iguals,
    exercicisSenseLlegir: exercicis.filter((exercici) => !llegits.includes(exercici)),
  };
}

/** El tros de text que la facturació afegeix al registre de la passada de clients. */
export function descriuFacturacio(resultat: ResultatFacturacio) {
  return (
    `Facturació: ${resultat.mesos} mesos de client llegits, ${resultat.creats} nous, ${resultat.actualitzats} actualitzats, ` +
    `${resultat.esborrats} esborrats i ${resultat.iguals} sense canvis; ${resultat.resums} resums de client posats al dia.` +
    (resultat.exercicisSenseLlegir.length
      ? ` No s'ha pogut llegir l'exercici ${resultat.exercicisSenseLlegir.join(", ")}.`
      : "")
  );
}

/** Les xifres de facturació d'un client, per la seva fitxa del CRM o pel seu codi de FactuSol. */
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
