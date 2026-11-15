/**
 * Tancar una activitat i els deures que en surten.
 *
 * Tancar no és desar un camp: és un pas amb el seu propi moment, on es diu com
 * ha anat i què queda per fer. El «com ha anat» va al `resultat` de l'activitat
 * i el «què queda» es converteix en tasques del CRM, penjades de l'activitat
 * que les ha demanades i del compte a qui toquen.
 *
 * Que siguin tasques i no un camp propi és el que fa que després es puguin
 * arrossegar: la propera activitat del mateix compte pregunta quines en queden
 * de pendents, vinguin de la visita anterior o de la de fa tres mesos.
 */
import "server-only";

import {
  actualitzaItem,
  agrupaPer,
  comptaToDosPendents,
  creaItems,
  llistaDeuresDe,
  llistaToDosFets,
  llistaToDosPendents,
  obteItem,
  type FilaDeure,
  type FilaToDo,
} from "@/apis/directus/crm";
import { llegeixDeures, ordenaDeures, type Deure } from "@/domini/crm-deures";
import { FITXES, PENDENT, activitatTancada, esLletra, esResultatTancament } from "@/domini/crm-fitxes";
import { avuiLocal, momentLocal } from "@/domini/crm-planner";
import { nomDelTipus, type DefinicioTipus } from "@/domini/crm-tipus-activitat";
import { ordenaFets, ordenaToDos, type ToDo } from "@/domini/crm-todo";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { nomDeLloc } from "@/lib/format";
import { afegeixAtributs } from "@/serveis/atributs";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

const ACTIVITATS = FITXES.activitats.colleccio;
const TASQUES = "crm_tasques";

export class ErrorTancament extends Error {}
export class ErrorToDo extends Error {}

/** A qui pertany una activitat: el compte si en té, i si no, el lead. */
export type Amo = { camp: "client" | "lead"; id: string } | null;

export function amoDeLActivitat(valors: Record<string, unknown>): Amo {
  const client = valors.client;
  if (typeof client === "string" && client) return { camp: "client", id: client };
  if (client && typeof client === "object" && "id" in client) {
    return { camp: "client", id: String((client as { id: unknown }).id) };
  }
  const lead = valors.lead;
  if (typeof lead === "string" && lead) return { camp: "lead", id: lead };
  if (lead && typeof lead === "object" && "id" in lead) {
    return { camp: "lead", id: String((lead as { id: unknown }).id) };
  }
  return null;
}

/** «Visita de tardor · 8 set», per dir d'on ve un deure. Sense activitat, «Apuntat a mà» i el dia que es va apuntar. */
function situa(fila: FilaDeure) {
  const assumpte = fila.activitat ? (fila.activitat.assumpte ?? "una activitat") : "Apuntat a mà";
  const moment = momentLocal(fila.activitat ? fila.activitat.data : fila.date_created);
  return moment ? `${assumpte} · ${moment.dia.slice(8)}/${moment.dia.slice(5, 7)}` : assumpte;
}

function aDeure(fila: FilaDeure): Deure {
  return {
    id: fila.id,
    text: fila.titol ?? "Sense títol",
    // Cancel·lada compta com a tancada: ni queda per fer ni s'ha de tornar a treure.
    fet: fila.estat === "feta" || fila.estat === "cancellada",
    prioritat: fila.prioritat ?? "normal",
    venciment: fila.venciment ?? "",
    activitat: fila.activitat?.id ?? "",
    origen: situa(fila),
  };
}

/**
 * Tots els deures d'un compte, fets i per fer: és el que ensenya la seva
 * pestanya, on el que es vol és repassar què li deuen i marcar-ho.
 */
/**
 * Els clients que tenen algun To-Do pendent, per posar-los la «!» a les llistes.
 * Els fets i els cancel·lats no compten. D'una sola consulta agrupada.
 */
export async function clientsAmbDeures(): Promise<Set<string>> {
  const grups = await agrupaPer(TASQUES, "client", {
    _and: [
      { client: { _nnull: true } },
      { _or: [{ estat: { _null: true } }, { estat: { _nin: ["feta", "cancellada"] } }] },
    ],
  });
  return new Set(grups.filter((grup) => grup.quants > 0).map((grup) => grup.valor));
}

/** Els To-Do pendents d'un client, per al modal de la «!». */
export async function deuresPendentsDelClient(client: string): Promise<Deure[]> {
  return (await deuresDe({ camp: "client", id: client })).filter((deure) => !deure.fet);
}

export async function deuresDe(amo: Amo): Promise<Deure[]> {
  if (!amo) return [];
  return ordenaDeures((await llistaDeuresDe(amo.camp, amo.id)).map(aDeure));
}

export type DeuresDeLaFitxa = {
  /**
   * El que arrossega el compte d'altres activitats: hi entren els de totes,
   * no només els de l'anterior, perquè un deure que no s'ha tancat en dues
   * visites és justament el que no s'ha de perdre de vista. Només els pendents:
   * els ja fets d'altres visites no són feina d'aquesta.
   */
  arrossegats: Deure[];
  /** El que ha deixat aquesta activitat en tancar-se, fets i per fer. */
  propis: Deure[];
};

/**
 * Els deures que envolten una activitat. Es demana una sola vegada i es
 * reparteix aquí: són les mateixes tasques mirades des de dos costats.
 */
export async function deuresDeLaFitxa(amo: Amo, activitat: string): Promise<DeuresDeLaFitxa> {
  if (!amo) return { arrossegats: [], propis: [] };
  const deures = (await llistaDeuresDe(amo.camp, amo.id)).map(aDeure);
  // Una activitat encara sense id no en té cap de pròpia: els apuntats a mà tampoc tenen activitat, i no són seus.
  const seu = (d: Deure) => Boolean(activitat) && d.activitat === activitat;

  return {
    arrossegats: ordenaDeures(deures.filter((d) => !seu(d) && !d.fet)),
    propis: ordenaDeures(deures.filter(seu)),
  };
}

/**
 * Apunta un To-Do a la fitxa d'un client, sense cap activitat al darrere.
 *
 * El client es llegeix abans de crear-lo perquè la lectura passa per l'abast de
 * qui ho demana i crear una tasca no: així ningú n'apunta a un client que no veu.
 */
export async function apuntaToDo(
  client: string,
  apunt: { text: unknown; venciment?: string },
  comercial: string | null,
): Promise<void> {
  const [titol] = llegeixDeures([apunt.text]);
  if (!titol) throw new ErrorToDo("Escriu el To-Do.");

  const compte = await obteItem<{ id: string }>(FITXES.clients.colleccio, client, ["id"]);
  if (!compte) throw new ErrorToDo("Aquest client no hi és.");

  // Repetir el mateix To-Do és una relliscada, no dues feines.
  const pendents = await deuresPendentsDelClient(client);
  if (pendents.some((deure) => deure.text.toLowerCase() === titol.toLowerCase())) {
    throw new ErrorToDo("Aquest client ja té aquest To-Do pendent.");
  }

  await creaItems(TASQUES, [
    {
      titol,
      estat: "pendent",
      prioritat: "normal",
      client,
      ...(comercial ? { responsable: comercial } : {}),
      ...(apunt.venciment ? { venciment: apunt.venciment } : {}),
    },
  ]);
}

export type Tancament = {
  resultat: string;
  /** Els deures, tal com han arribat del formulari. */
  deures: unknown;
  /** Venciment comú, si se n'hi ha posat un. */
  venciment?: string;
  /** Atributs nous del client, ja nets (vegeu `llegeixAtributsJson`). Només si l'activitat és d'un client. */
  atributs?: string[];
};

/**
 * Tanca l'activitat: hi deixa el resultat i converteix els deures en tasques.
 *
 * Les tasques es creen d'una sola petició. Si no n'hi ha cap, tancar segueix
 * valent: hi ha visites que no deixen feina, i obligar a inventar-ne una seria
 * pitjor que deixar-ho en blanc.
 */
export async function tancaActivitat(
  id: string,
  tancament: Tancament,
  comercial: string | null,
): Promise<{ deures: number; atributs: number }> {
  if (!esResultatTancament(tancament.resultat)) {
    throw new ErrorTancament("Cal dir com ha anat l'activitat.");
  }

  const valors = await obteItem<Record<string, unknown>>(ACTIVITATS, id, ["id", "client", "lead"]);
  if (!valors) throw new ErrorTancament("Aquesta activitat ja no hi és.");

  const textos = llegeixDeures(tancament.deures);
  const amo = amoDeLActivitat(valors);

  // El resum ja és un camp del formulari, just a sobre: aquí només el resultat.
  await actualitzaItem(ACTIVITATS, id, { resultat: tancament.resultat });

  if (textos.length > 0) {
    await creaItems(
      TASQUES,
      textos.map((text) => ({
        titol: text,
        estat: "pendent",
        prioritat: "normal",
        activitat: id,
        ...(amo ? { [amo.camp]: amo.id } : {}),
        ...(comercial ? { responsable: comercial } : {}),
        ...(tancament.venciment ? { venciment: tancament.venciment } : {}),
      })),
    );
  }

  // El que s'ha après del client, com a atributs seus. Un lead encara no en té.
  const atributs =
    amo?.camp === "client" && tancament.atributs?.length
      ? await afegeixAtributs(amo.id, tancament.atributs, { activitat: id, comercial })
      : 0;

  return { deures: textos.length, atributs };
}

/** Torna a obrir una activitat tancada. Els deures que va deixar es queden. */
export async function reobreActivitat(id: string) {
  await actualitzaItem(ACTIVITATS, id, { resultat: PENDENT });
}

/** Marca o desmarca un deure. Marcar-lo li posa el dia que s'ha tancat. */
export async function marcaDeure(id: string, fet: boolean) {
  await actualitzaItem(TASQUES, id, {
    estat: fet ? "feta" : "pendent",
    completada_el: fet ? new Date().toISOString() : null,
  });
}

// ------------------------------------------------------------ pantalla To-Do

function text(valor: string | null | undefined) {
  return valor ?? "";
}

/** La clau de dia d'una marca de temps, segons el fus del negoci. */
function diaDe(marca: string | null) {
  return momentLocal(marca)?.dia ?? "";
}

function compteDe(fila: FilaToDo): ToDo["compte"] {
  if (fila.client) {
    return {
      mena: "client",
      id: fila.client.id,
      nom: text(fila.client.nom_comercial) || "Client sense nom",
      poblacio: nomDeLloc(fila.client.poblacio),
      telefon: text(fila.client.telefon),
      categoria: esLletra(fila.client.categoria) ? fila.client.categoria : null,
      potencial: esLletra(fila.client.potencial) ? fila.client.potencial : null,
      facturacio: Object.fromEntries(CAMPS_RESUM_FACTURACIO.map((camp) => [camp, fila.client?.[camp] ?? null])),
    };
  }
  if (fila.lead) {
    return {
      mena: "lead",
      id: fila.lead.id,
      nom: text(fila.lead.nom) || "Lead sense nom",
      poblacio: nomDeLloc(fila.lead.poblacio),
      telefon: text(fila.lead.telefon),
      categoria: null,
      potencial: null,
      facturacio: null,
    };
  }
  return null;
}

function aToDo(fila: FilaToDo, definicions: DefinicioTipus[]): ToDo {
  const estat = text(fila.estat) || "pendent";
  const moment = fila.activitat ? momentLocal(fila.activitat.data) : null;
  const nomResponsable = [fila.responsable?.first_name, fila.responsable?.last_name].filter(Boolean).join(" ").trim();

  return {
    id: fila.id,
    text: text(fila.titol) || "Sense títol",
    descripcio: text(fila.descripcio).trim(),
    fet: estat === "feta" || estat === "cancellada",
    estat,
    prioritat: text(fila.prioritat) || "normal",
    // El venciment és una data sense hora: la clau del dia tal qual.
    venciment: text(fila.venciment).slice(0, 10),
    completadaEl: diaDe(fila.completada_el),
    creatEl: diaDe(fila.date_created),
    responsable: fila.responsable ? { id: fila.responsable.id, nom: nomResponsable || "Algú de l'equip" } : null,
    activitat: fila.activitat
      ? {
          id: fila.activitat.id,
          assumpte: text(fila.activitat.assumpte) || "Sense assumpte",
          dia: moment?.dia ?? "",
          hora: moment?.hora ?? "",
          tipus: nomDelTipus(definicions, text(fila.activitat.tipus)),
          resultat: text(fila.activitat.resultat),
          tancada: activitatTancada(fila.activitat),
        }
      : null,
    compte: compteDe(fila),
    oportunitat: fila.oportunitat
      ? { id: fila.oportunitat.id, titol: text(fila.oportunitat.titol) || "Sense títol", etapa: text(fila.oportunitat.etapa) }
      : null,
  };
}

export type PantallaToDo = {
  /** Clau del dia d'avui, segons el fus del negoci: és amb el que es mesuren els venciments. */
  avui: string;
  pendents: ToDo[];
  /** Els darrers tancats, només si s'han demanat. */
  fets: ToDo[];
};

/**
 * Tot el que queda per fer, per a la pantalla de To-Do. Amb `responsable`,
 * només el seu i el que no té ningú assignat; sense (qui ho veu tot), el de
 * tothom. Els fets es porten a part i només si es demanen: la pantalla és
 * del que queda, i els fets s'hi consulten de tant en tant.
 */
export async function toDosPerFer(responsable: string | null, { ambFets = false } = {}): Promise<PantallaToDo> {
  const [pendents, fets, definicions] = await Promise.all([
    llistaToDosPendents(responsable),
    ambFets ? llistaToDosFets(responsable) : Promise.resolve([]),
    tipusActivitat(),
  ]);
  return {
    avui: avuiLocal(),
    pendents: ordenaToDos(pendents.map((fila) => aToDo(fila, definicions))),
    fets: ordenaFets(fets.map((fila) => aToDo(fila, definicions))),
  };
}

/** Quants To-Do queden pendents, per al comptador de la capçalera. */
export async function comptaToDos(responsable: string | null): Promise<number> {
  return comptaToDosPendents(responsable);
}

/**
 * Marca o desmarca un To-Do des de la pantalla de To-Do. És el mateix que
 * `marcaDeure`: hi és amb nom propi perquè qui llegeixi l'acció sàpiga d'on ve.
 */
export const marcaToDo = marcaDeure;
