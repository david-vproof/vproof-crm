/**
 * Lectura en cru de les col·leccions del CRM.
 *
 * Aquí no es transforma res: només es demanen les dades a la base de dades
 * (vegeu `consulta.ts`, que parla el llenguatge de consulta de sempre). Qui
 * les converteix en el llenguatge del portal és `serveis/crm.ts`.
 */
import "server-only";

import { ambAgentDe, condicioDAbast, esColleccioDeClients } from "@/domini/abast";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { abastActual } from "@/lib/abast-actual";

import { ErrorDades } from "./client";
import { executa } from "./consulta";

/** La base de dades és local: sempre hi ha accés. Es conserva perquè els serveis ho pregunten. */
export function teAccesCrm() {
  return true;
}

export type FilaOportunitat = {
  id: string;
  titol: string | null;
  tipus_client: { nom: string | null } | null;
  etapa: string | null;
  valor: string | number | null;
  probabilitat: number | null;
  data_obertura: string | null;
  tancament_previst: string | null;
  data_tancament: string | null;
  etapa_assolida: number | null;
  comercial: string | null;
  client: { nom_comercial: string | null; codi_erp: number | null; poblacio: string | null } | null;
  lead: { nom: string | null; origen: string | null; poblacio: string | null; persona_contacte: string | null } | null;
  date_created: string | null;
};

export type FilaActivitat = {
  id: string;
  tipus: string | null;
  data: string | null;
  assumpte: string | null;
  resum: string | null;
  resultat: string | null;
  assistents: number | null;
  referencies: string | null;
  comercial: string | null;
  oportunitat: string | null;
  celler: { nom_comercial: string | null } | null;
  client: { id: string; nom_comercial: string | null; categoria: string | null; potencial: string | null } | null;
  lead: { id: string; nom: string | null } | null;
  date_created: string | null;
};

export type FilaTasca = {
  id: string;
  titol: string | null;
  venciment: string | null;
  estat: string | null;
  prioritat: string | null;
  responsable: string | null;
  oportunitat: string | null;
  client: { nom_comercial: string | null } | null;
  lead: { nom: string | null } | null;
};

/**
 * Una activitat tal com la vol l'agenda del dia: hi entren el telèfon, el
 * contacte i l'horari del compte, que és el que fa falta a la carretera i que
 * el calendari del Planner no necessita.
 */
export type FilaAgenda = {
  id: string;
  tipus: string | null;
  data: string | null;
  assumpte: string | null;
  durada_minuts: number | null;
  resultat: string | null;
  proper_pas: string | null;
  comercial: string | null;
  celler: { nom_comercial: string | null } | null;
  client: {
    id: string;
    nom_comercial: string | null;
    categoria: string | null;
    potencial: string | null;
    poblacio: string | null;
    telefon: string | null;
    horari_comercial: unknown;
    /** El resum de facturació: vegeu `CAMPS_RESUM_FACTURACIO`. */
    [resum: string]: unknown;
  } | null;
  lead: { nom: string | null; poblacio: string | null; telefon: string | null } | null;
  contacte: { nom: string | null; cognoms: string | null; telefon: string | null; mobil: string | null } | null;
};

export type Usuari = { id: string; first_name: string | null; last_name: string | null };

export type CrmEnCru = {
  oportunitats: FilaOportunitat[];
  activitats: FilaActivitat[];
  tasques: FilaTasca[];
  usuaris: Usuari[];
};

// ------------------------------------------------------------------- abast

const RUTA_ITEMS = /^\/items\/([a-z_]+)(?:\/([^/?]+))?$/;

/**
 * Tota petició a `/items` passa per l'abast de qui la fa (vegeu
 * `domini/abast.ts`): qui no ho veu tot només llegeix, canvia i esborra el
 * que és dels seus clients, i el que crea porta el seu agent. Es fa aquí, al
 * coll d'ampolla, perquè valgui per a totes les pantalles sense que cap se
 * n'hagi de recordar. Torna la ruta i el cos tal com s'han d'enviar.
 */
async function dinsDeLAbast(ruta: string, opcions: RequestInit): Promise<{ ruta: string; body?: BodyInit | null }> {
  const [cami, consulta = ""] = ruta.split("?");
  const parts = RUTA_ITEMS.exec(cami);
  if (!parts) return { ruta };
  const [, colleccio, id] = parts;
  if (!esColleccioDeClients(colleccio) && !["POST"].includes(opcions.method ?? "GET")) return { ruta };

  const abast = await abastActual();
  if (!abast) return { ruta };
  const condicio = condicioDAbast(colleccio, abast);
  const metode = opcions.method ?? "GET";

  if (metode === "GET") {
    if (!condicio) return { ruta };
    const parametres = new URLSearchParams(consulta);
    const existent = parametres.get("filter");
    parametres.set("filter", JSON.stringify(existent ? { _and: [JSON.parse(existent), condicio] } : condicio));
    return { ruta: `${cami}?${parametres}` };
  }

  if (metode === "POST") {
    if (typeof opcions.body !== "string") return { ruta };
    const cos = JSON.parse(opcions.body) as Record<string, unknown> | Record<string, unknown>[];
    const estampat = Array.isArray(cos) ? cos.map((fila) => ambAgentDe(colleccio, fila, abast)) : ambAgentDe(colleccio, cos, abast);
    return { ruta, body: JSON.stringify(estampat) };
  }

  // PATCH o DELETE: només sobre files que es veuen. Un id que no hi és, és com si no existís.
  if (condicio) {
    const ids = id
      ? [id]
      : typeof opcions.body === "string"
        ? ([] as { id?: string }[]).concat(JSON.parse(opcions.body)).map((fila) => String(fila.id ?? "")).filter(Boolean)
        : [];
    if (ids.length > 0) {
      const filtre = encodeURIComponent(JSON.stringify({ _and: [{ id: { _in: ids } }, condicio] }));
      const resposta = await cridaCrua(`/items/${colleccio}?fields=id&limit=-1&filter=${filtre}`);
      const { data } = (await resposta.json()) as { data?: { id: string }[] };
      if ((data?.length ?? 0) < ids.length) {
        throw new ErrorDades("credencials", "Aquesta fitxa no és de cap dels teus clients.", { estat: 403 });
      }
    }
  }
  return { ruta };
}

async function crida(ruta: string, opcions: RequestInit = {}) {
  const dins = await dinsDeLAbast(ruta, opcions);
  return cridaCrua(dins.ruta, dins.body !== undefined ? { ...opcions, body: dins.body } : opcions);
}

/** La crida a la base de dades tal qual, sense passar per l'abast: només per a l'abast mateix. */
async function cridaCrua(ruta: string, opcions: RequestInit = {}) {
  const resposta = await executa(ruta, opcions);

  if (!resposta.ok) {
    const cos = (await resposta.json().catch(() => ({}))) as { errors?: { message?: string }[] };
    const detall = cos.errors?.[0]?.message ?? "";

    if (resposta.status === 401 || resposta.status === 403) {
      // Un camp que no és al model: el motor ho diu amb el mateix text que deia Directus.
      const camp = /access fields? ("[^"]+"(?:, "[^"]+")*) in collection "([^"]+)"/.exec(detall);
      if (camp) {
        const camps = Array.from(camp[1].matchAll(/"([^"]+)"/g), (m) => m[1]);
        throw new ErrorDades(
          "configuracio",
          `${camps.length === 1 ? "El camp" : "Els camps"} ${camps.map((c) => `«${c}»`).join(", ")} no ${camps.length === 1 ? "existeix" : "existeixen"} ` +
            `a la taula ${camp[2]}. Revisa apis/sqlite/model.ts.`,
          { estat: resposta.status, camp: camps[0] },
        );
      }
      throw new ErrorDades("credencials", "Aquesta fitxa no existeix o no hi tens accés.", { estat: resposta.status });
    }
    // El codi HTTP hi va perquè qui escriu per lots pugui distingir un error de
    // dades (4xx: la fila no val) d'una fallada del servei (5xx).
    throw new ErrorDades("servei", detall || `${ruta} ha respost HTTP ${resposta.status}.`, { estat: resposta.status });
  }
  return resposta;
}

export async function llista<T>(ruta: string): Promise<T[]> {
  const { data } = (await (await crida(ruta)).json()) as { data?: T[] };
  return data ?? [];
}

// ------------------------------------------------------------------ filtres

export type Condicio = Record<string, unknown>;

/**
 * El filtre va en JSON i no desplegat a la query string: així dues condicions
 * `_or` (la cerca i la de qui la porta) no es trepitgen i es combinen amb `_and`.
 */
function filtre(condicions: Condicio[]) {
  const cos = condicions.length === 1 ? condicions[0] : { _and: condicions };
  return `filter=${encodeURIComponent(JSON.stringify(cos))}`;
}

/**
 * Les fitxes que porta algú, o ningú. Tothom veu tot el CRM, però el que té
 * comercial és de cadascú: una activitat amb comercial només la veu qui la
 * porta, i una sense comercial, tothom. Sense `qui` (credencials locals, que
 * no tenen id de la base de dades) no es filtra res.
 */
function deQui(camp: string, qui: string | null | undefined): Condicio[] {
  if (!qui || !camp) return [];
  return [{ _or: [{ [camp]: { _eq: qui } }, { [camp]: { _null: true } }] }];
}

// --------------------------------------------------------------- manteniment

export type Pagina<T> = { files: T[]; total: number };

export async function llistaAmbTotal<T>(
  colleccio: string,
  opcions: {
    camps: string[];
    cerca?: string;
    campsCerca?: string[];
    ordre?: string;
    limit?: number;
    salta?: number;
    filtre?: { camp: string; valor: string };
    ids?: string[];
    /** Només les que porta algú, o ningú: vegeu `deQui`. */
    deQui?: { camp: string; id: string };
    /** Condicions ja en el llenguatge de la base de dades, una per filtre de columna. */
    condicions?: Condicio[];
  },
): Promise<Pagina<T>> {
  const parts = [`fields=${opcions.camps.join(",")}`, "meta=filter_count"];
  if (opcions.ordre) parts.push(`sort=${opcions.ordre}`);
  if (opcions.limit !== undefined) parts.push(`limit=${opcions.limit}`);
  if (opcions.salta) parts.push(`offset=${opcions.salta}`);

  const condicions: Condicio[] = [];
  if (opcions.ids?.length) condicions.push({ id: { _in: opcions.ids } });
  if (opcions.filtre) condicions.push({ [opcions.filtre.camp]: { _eq: opcions.filtre.valor } });
  condicions.push(...deQui(opcions.deQui?.camp ?? "", opcions.deQui?.id));
  condicions.push(...(opcions.condicions ?? []));

  const terme = opcions.cerca?.trim();
  if (terme && opcions.campsCerca?.length) {
    // _icontains i no _contains: el de la base de dades distingeix majúscules i
    // «mas» no trobaria «Mas Rabassa».
    condicions.push({ _or: opcions.campsCerca.map((camp) => ({ [camp]: { _icontains: terme } })) });
  }
  if (condicions.length > 0) parts.push(filtre(condicions));

  const resposta = await crida(`/items/${colleccio}?${parts.join("&")}`);
  const cos = (await resposta.json()) as { data?: T[]; meta?: { filter_count?: number } };
  return { files: cos.data ?? [], total: cos.meta?.filter_count ?? cos.data?.length ?? 0 };
}

/**
 * Quants n'hi ha de cada valor d'un camp. Serveix per omplir un desplegable de
 * filtre amb els valors que realment hi ha, i no amb una llista inventada.
 */
export async function agrupaPer(
  colleccio: string,
  camp: string,
  condicio?: Condicio,
): Promise<{ valor: string; quants: number }[]> {
  const filtrat = condicio ? `&filter=${encodeURIComponent(JSON.stringify(condicio))}` : "";
  const ruta = `/items/${colleccio}?aggregate[count]=id&groupBy[]=${encodeURIComponent(camp)}&sort=${encodeURIComponent(camp)}&limit=-1${filtrat}`;
  const { data } = (await (await crida(ruta)).json()) as {
    data?: (Record<string, unknown> & { count?: { id?: string | number } })[];
  };
  return (data ?? [])
    .map((fila) => ({ valor: String(fila[camp] ?? "").trim(), quants: Number(fila.count?.id ?? 0) }))
    .filter((fila) => fila.valor !== "");
}

/**
 * Es demana per filtre i no per /items/colleccio/id perquè la base de dades respon 403
 * tant si l'element no existeix com si no hi tens accés, i això confon una
 * fitxa esborrada amb un problema de permisos. Amb filtre, «no hi és» arriba
 * com una llista buida i el 403 torna a voler dir només una cosa.
 */
export async function obteItem<T>(colleccio: string, id: string, camps: string[]): Promise<T | null> {
  const ruta = `/items/${colleccio}?limit=1&fields=${camps.join(",")}&${filtre([{ id: { _eq: id } }])}`;
  const { data } = (await (await crida(ruta)).json()) as { data?: T[] };
  return data?.[0] ?? null;
}

export async function creaItem(colleccio: string, dades: Record<string, unknown>): Promise<string> {
  const { data } = (await (await crida(`/items/${colleccio}?fields=id`, {
    method: "POST",
    body: JSON.stringify(dades),
  })).json()) as { data?: { id: string } };
  return data?.id ?? "";
}

/**
 * Crea diversos elements d'una tirada. La base de dades accepta un array al cos, i
 * així una tanda de vint activitats és una petició i no vint.
 */
export async function creaItems(colleccio: string, files: Record<string, unknown>[]): Promise<number> {
  if (files.length === 0) return 0;
  const { data } = (await (await crida(`/items/${colleccio}?fields=id`, {
    method: "POST",
    body: JSON.stringify(files),
  })).json()) as { data?: { id: string }[] };
  return data?.length ?? 0;
}

export async function actualitzaItem(colleccio: string, id: string, dades: Record<string, unknown>) {
  await crida(`/items/${colleccio}/${id}?fields=id`, { method: "PATCH", body: JSON.stringify(dades) });
}

/**
 * Actualitza diversos elements d'una tirada, cadascun amb el seu id dins de
 * les dades. La base de dades ho accepta com un array al cos del PATCH.
 */
export async function actualitzaItems(colleccio: string, files: ({ id: string } & Record<string, unknown>)[]) {
  if (files.length === 0) return;
  await crida(`/items/${colleccio}?fields=id`, { method: "PATCH", body: JSON.stringify(files) });
}

/** Totes les files d'una col·lecció, sense límit. Per a passades completes, no per a llistats. */
export async function llistaTot<T>(colleccio: string, camps: string[], ordre?: string): Promise<T[]> {
  const parts = [`fields=${camps.join(",")}`, "limit=-1"];
  if (ordre) parts.push(`sort=${ordre}`);
  const { data } = (await (await crida(`/items/${colleccio}?${parts.join("&")}`)).json()) as { data?: T[] };
  return data ?? [];
}

/**
 * Un singleton de la base de dades és una col·lecció amb un sol element: es llegeix
 * sense id i es desa amb PATCH, que el crea si encara no existeix.
 */
export async function llegeixSingleton<T>(colleccio: string, camps: string[]): Promise<T | null> {
  const { data } = (await (await crida(`/items/${colleccio}?fields=${camps.join(",")}`)).json()) as { data?: T | T[] };
  if (Array.isArray(data)) return data[0] ?? null;
  return data && Object.keys(data).length > 0 ? data : null;
}

export async function desaSingleton(colleccio: string, dades: Record<string, unknown>) {
  await crida(`/items/${colleccio}?fields=id`, { method: "PATCH", body: JSON.stringify(dades) });
}

export async function esborraItem(colleccio: string, id: string) {
  await crida(`/items/${colleccio}/${id}`, { method: "DELETE" });
}

// ------------------------------------------------------------------ fitxers

/** L'id d'una carpeta de fitxers pel nom, o null si no hi és: llavors es desa a l'arrel. */
export async function idCarpeta(nom: string): Promise<string | null> {
  const files = await llista<{ id: string }>(`/folders?limit=1&fields=id&filter[name][_eq]=${encodeURIComponent(nom)}`);
  return files[0]?.id ?? null;
}

/**
 * Puja un fitxer a la base de dades i en torna l'id. Els camps van abans del fitxer:
 * la base de dades només llegeix els que arriben primer.
 */
export async function pujaFitxer(fitxer: { nom: string; tipus: string; dades: Uint8Array<ArrayBuffer>; titol?: string; carpeta?: string | null }) {
  const formulari = new FormData();
  if (fitxer.carpeta) formulari.append("folder", fitxer.carpeta);
  if (fitxer.titol) formulari.append("title", fitxer.titol);
  formulari.append("file", new Blob([fitxer.dades], { type: fitxer.tipus }), fitxer.nom);
  const { data } = (await (await crida("/files?fields=id", { method: "POST", body: formulari })).json()) as { data?: { id: string } };
  if (!data?.id) throw new ErrorDades("servei", `La base de dades no ha tornat l'id de ${fitxer.nom}.`);
  return data.id;
}

export async function esborraFitxer(id: string) {
  await crida(`/files/${id}`, { method: "DELETE" });
}

/**
 * Un fitxer tal com el serveix la base de dades, per passar-lo al navegador sense que
 * aquest hi parli. `transformacio` són els paràmetres d'imatge de /assets
 * (amplada, alçada, format…).
 */
export async function llegeixFitxer(id: string, transformacio: Record<string, string> = {}) {
  const parametres = new URLSearchParams(transformacio).toString();
  return crida(`/assets/${encodeURIComponent(id)}${parametres ? `?${parametres}` : ""}`);
}

/** Esborra diversos elements d'una tirada: la base de dades accepta la llista d'ids al cos del DELETE. */
export async function esborraItems(colleccio: string, ids: string[]) {
  if (ids.length === 0) return;
  await crida(`/items/${colleccio}`, { method: "DELETE", body: JSON.stringify(ids) });
}

const CAMPS_OPORTUNITAT = [
  "id", "titol", "tipus_client.nom", "etapa", "valor", "probabilitat", "data_obertura", "tancament_previst",
  "data_tancament", "etapa_assolida", "comercial", "date_created",
  "client.nom_comercial", "client.codi_erp", "client.poblacio",
  "lead.nom", "lead.origen", "lead.poblacio", "lead.persona_contacte",
].join(",");

const CAMPS_ACTIVITAT = [
  "id", "tipus", "data", "assumpte", "resum", "assistents", "referencies", "comercial",
  // El resultat és el que diu si l'activitat és oberta o tancada.
  "resultat", "oportunitat", "date_created", "celler.nom_comercial",
  // L'id del compte és el que lliga l'activitat amb el seu segment.
  "client.id", "client.nom_comercial", "client.categoria", "client.potencial", "lead.id", "lead.nom",
].join(",");

const CAMPS_TASCA = [
  "id", "titol", "venciment", "estat", "prioritat", "responsable", "oportunitat",
  "client.nom_comercial", "lead.nom",
].join(",");

/** El tram d'un calendari: el «des de» inclòs i el «fins» exclòs. */
function entre(camp: string, desde: string, fins: string): Condicio[] {
  return [{ [camp]: { _gte: desde } }, { [camp]: { _lt: fins } }];
}

/**
 * Les activitats d'un interval, per al calendari. Es demana per rang i no tot
 * de cop perquè el Planner només ensenya un mes i les activitats són el que
 * més creix d'un CRM. Amb `comercial`, només les seves i les de ningú; amb
 * `agent`, només les del representant comercial de FactuSol (l'agent del
 * client o del lead, que l'activitat hereta).
 */
export async function llistaActivitatsEntre(
  desde: string,
  fins: string,
  comercial?: string | null,
  agent?: string | null,
): Promise<FilaActivitat[]> {
  const condicions = [
    ...entre("data", desde, fins),
    ...deQui("comercial", comercial),
    ...(agent ? [{ agent: { _eq: agent } }] : []),
  ];
  return llista<FilaActivitat>(
    `/items/crm_activitats?limit=-1&sort=data&fields=${CAMPS_ACTIVITAT}&${filtre(condicions)}`,
  );
}

const CAMPS_AGENDA = [
  "id", "tipus", "data", "assumpte", "durada_minuts", "resultat", "proper_pas", "comercial",
  "celler.nom_comercial",
  "client.id", "client.nom_comercial", "client.categoria", "client.potencial", "client.poblacio", "client.telefon",
  "client.horari_comercial",
  // Perquè l'agenda pinti el client amb la seva facturació, com els altres llistats.
  ...CAMPS_RESUM_FACTURACIO.map((camp) => `client.${camp}`),
  "lead.nom", "lead.poblacio", "lead.telefon",
  "contacte.nom", "contacte.cognoms", "contacte.telefon", "contacte.mobil",
].join(",");

/**
 * Les activitats d'un tram per a l'agenda del dia. El tram arriba ja en UTC i
 * és exacte: qui el calcula sap on comença i on acaba el dia d'aquí.
 */
export async function llistaAgendaEntre(
  desde: string,
  fins: string,
  comercial?: string | null,
): Promise<FilaAgenda[]> {
  const condicions = [...entre("data", desde, fins), ...deQui("comercial", comercial)];
  return llista<FilaAgenda>(`/items/crm_activitats?limit=-1&sort=data&fields=${CAMPS_AGENDA}&${filtre(condicions)}`);
}

/** Quantes activitats hi ha al tram, per al comptador de la pestanya. */
export async function comptaAgendaEntre(
  desde: string,
  fins: string,
  comercial?: string | null,
): Promise<number> {
  const condicions = [...entre("data", desde, fins), ...deQui("comercial", comercial)];
  const ruta = `/items/crm_activitats?limit=0&meta=filter_count&fields=id&${filtre(condicions)}`;
  const cos = (await (await crida(ruta)).json()) as { meta?: { filter_count?: number } };
  return cos.meta?.filter_count ?? 0;
}

/** Una tasca d'un compte, amb d'on ve: el tancament d'una activitat, o apuntada a mà i sense cap. */
export type FilaDeure = {
  id: string;
  titol: string | null;
  estat: string | null;
  prioritat: string | null;
  venciment: string | null;
  date_created: string | null;
  activitat: { id: string; assumpte: string | null; data: string | null } | null;
};

const CAMPS_DEURE = [
  "id", "titol", "estat", "prioritat", "venciment", "date_created",
  "activitat.id", "activitat.assumpte", "activitat.data",
].join(",");

/**
 * Els deures d'un compte o d'un lead: les tasques que li han deixat les seves
 * activitats i les que s'hi han apuntat a mà. Es demanen totes i no només les
 * pendents perquè la fitxa també ensenya les que s'acaben de marcar, sense
 * fer-les desaparèixer de cop.
 */
export async function llistaDeuresDe(camp: "client" | "lead", id: string): Promise<FilaDeure[]> {
  const ruta = `/items/crm_tasques?limit=-1&sort=-date_created&fields=${CAMPS_DEURE}&${filtre([{ [camp]: { _eq: id } }])}`;
  return llista<FilaDeure>(ruta);
}

/**
 * Un To-Do amb tot el que l'envolta, per a la pantalla de To-Do: d'on surt
 * (l'activitat), de qui és (el client o el lead, amb el que es veu a les
 * llistes), a què va lligat (l'oportunitat) i qui se n'encarrega.
 */
export type FilaToDo = {
  id: string;
  titol: string | null;
  descripcio: string | null;
  estat: string | null;
  prioritat: string | null;
  venciment: string | null;
  completada_el: string | null;
  date_created: string | null;
  responsable: { id: string; first_name: string | null; last_name: string | null } | null;
  activitat: {
    id: string;
    assumpte: string | null;
    data: string | null;
    tipus: string | null;
    resultat: string | null;
  } | null;
  client: {
    id: string;
    nom_comercial: string | null;
    categoria: string | null;
    potencial: string | null;
    poblacio: string | null;
    telefon: string | null;
    /** El resum de facturació: vegeu `CAMPS_RESUM_FACTURACIO`. */
    [resum: string]: unknown;
  } | null;
  lead: { id: string; nom: string | null; poblacio: string | null; telefon: string | null } | null;
  oportunitat: { id: string; titol: string | null; etapa: string | null } | null;
};

const CAMPS_TODO = [
  "id", "titol", "descripcio", "estat", "prioritat", "venciment", "completada_el", "date_created",
  "responsable.id", "responsable.first_name", "responsable.last_name",
  "activitat.id", "activitat.assumpte", "activitat.data", "activitat.tipus", "activitat.resultat",
  "client.id", "client.nom_comercial", "client.categoria", "client.potencial", "client.poblacio", "client.telefon",
  ...CAMPS_RESUM_FACTURACIO.map((camp) => `client.${camp}`),
  "lead.id", "lead.nom", "lead.poblacio", "lead.telefon",
  "oportunitat.id", "oportunitat.titol", "oportunitat.etapa",
].join(",");

/** Ni feta ni cancel·lada: el que de debò queda per fer. Sense estat compta com a pendent. */
const PENDENT_TODO: Condicio = { _or: [{ estat: { _null: true } }, { estat: { _nin: ["feta", "cancellada"] } }] };

/**
 * Tots els To-Do pendents, amb el que els envolta. Amb `responsable`, només
 * els seus i els que no té ningú assignat: vegeu `deQui`. S'ordenen aquí
 * només per tenir un ordre estable; el de debò el posa el domini.
 */
export async function llistaToDosPendents(responsable?: string | null): Promise<FilaToDo[]> {
  const condicions = [PENDENT_TODO, ...deQui("responsable", responsable)];
  return llista<FilaToDo>(`/items/crm_tasques?limit=-1&sort=venciment,titol&fields=${CAMPS_TODO}&${filtre(condicions)}`);
}

/** Quants To-Do queden pendents, per al comptador de la capçalera. */
export async function comptaToDosPendents(responsable?: string | null): Promise<number> {
  const condicions = [PENDENT_TODO, ...deQui("responsable", responsable)];
  const ruta = `/items/crm_tasques?limit=0&meta=filter_count&fields=id&${filtre(condicions)}`;
  const cos = (await (await crida(ruta)).json()) as { meta?: { filter_count?: number } };
  return cos.meta?.filter_count ?? 0;
}

/**
 * Els darrers To-Do tancats (fets o cancel·lats), els més recents primer. Es
 * demanen a part i amb límit: la pantalla els ensenya només si es demanen, i
 * el que es va fer fa mig any ja no hi pinta res.
 */
export async function llistaToDosFets(responsable?: string | null, limit = 60): Promise<FilaToDo[]> {
  const condicions = [{ estat: { _in: ["feta", "cancellada"] } }, ...deQui("responsable", responsable)];
  return llista<FilaToDo>(
    `/items/crm_tasques?limit=${limit}&sort=-completada_el,-date_created&fields=${CAMPS_TODO}&${filtre(condicions)}`,
  );
}

/**
 * Les tasques que vencen un dia. El venciment és una data sense hora, així que
 * aquí no hi ha fus a resoldre: es compara amb la clau del dia tal qual.
 */
export async function llistaTasquesDelDia(dia: string, responsable?: string | null): Promise<FilaTasca[]> {
  const condicions = [{ venciment: { _eq: dia } }, ...deQui("responsable", responsable)];
  return llista<FilaTasca>(
    `/items/crm_tasques?limit=-1&sort=titol&fields=${CAMPS_TASCA}&${filtre(condicions)}`,
  );
}

type FilaAgregada = {
  client: string | null;
  count?: { id?: string | number | null } | null;
  max?: { data?: string | null } | null;
};

/**
 * Recompte i darrera data d'activitat per compte, agregat per la base de dades. Es
 * demana així i no portant-se totes les activitats perquè és el que més creix
 * d'un CRM i aquí només en cal el resum.
 */
export async function activitatsPerCompte(): Promise<Map<string, { quantes: number; darrera: string | null }>> {
  const files = await llista<FilaAgregada>(
    "/items/crm_activitats?aggregate[count]=id&aggregate[max]=data&groupBy[]=client",
  );

  const resum = new Map<string, { quantes: number; darrera: string | null }>();
  for (const fila of files) {
    if (!fila.client) continue;
    resum.set(fila.client, { quantes: Number(fila.count?.id ?? 0), darrera: fila.max?.data ?? null });
  }
  return resum;
}

/**
 * Quantes activitats té cada compte en un tram, agregat per la base de dades. Són les
 * de tothom, no les de qui mira: la periodicitat és del client, no del comercial.
 * Amb `client`, només les d'aquell.
 */
export async function activitatsPerClientEntre(desde: string, fins: string, client?: string): Promise<Map<string, number>> {
  const condicions = [...entre("data", desde, fins), client ? { client: { _eq: client } } : { client: { _nnull: true } }];
  const files = await llista<FilaAgregada>(
    `/items/crm_activitats?aggregate[count]=id&groupBy[]=client&limit=-1&${filtre(condicions)}`,
  );

  const resum = new Map<string, number>();
  for (const fila of files) {
    if (fila.client) resum.set(fila.client, Number(fila.count?.id ?? 0));
  }
  return resum;
}

/**
 * La data de l'última activitat de cada client fins a `fins` (ISO): les que
 * encara han de venir no diuen res de quant fa que no s'hi va. Qui no en té
 * cap no hi surt.
 */
export async function darreraActivitatPerClient(fins: string): Promise<Map<string, string>> {
  const files = await llista<FilaAgregada>(
    `/items/crm_activitats?aggregate[max]=data&groupBy[]=client&limit=-1&${filtre([{ data: { _lte: fins } }, { client: { _nnull: true } }])}`,
  );

  const resum = new Map<string, string>();
  for (const fila of files) {
    if (fila.client && fila.max?.data) resum.set(fila.client, fila.max.data);
  }
  return resum;
}

/** Oportunitats vives per compte: les tancades no diuen res del que hi ha obert. */
export async function oportunitatsObertesPerCompte(): Promise<Map<string, number>> {
  const files = await llista<FilaAgregada>(
    `/items/crm_oportunitats?aggregate[count]=id&groupBy[]=client&${filtre([{ etapa: { _nin: ["guanyada", "perduda"] } }])}`,
  );

  const resum = new Map<string, number>();
  for (const fila of files) {
    if (!fila.client) continue;
    resum.set(fila.client, Number(fila.count?.id ?? 0));
  }
  return resum;
}

/** Tot el CRM d'una tirada: són volums petits i els taulers els creuen tots. */
export async function llegeixCrm(): Promise<CrmEnCru> {
  const [oportunitats, activitats, tasques, usuaris] = await Promise.all([
    llista<FilaOportunitat>(`/items/crm_oportunitats?limit=-1&fields=${CAMPS_OPORTUNITAT}`),
    llista<FilaActivitat>(`/items/crm_activitats?limit=-1&sort=data&fields=${CAMPS_ACTIVITAT}`),
    llista<FilaTasca>(`/items/crm_tasques?limit=-1&fields=${CAMPS_TASCA}`),
    llista<Usuari>("/users?limit=-1&fields=id,first_name,last_name"),
  ]);
  return { oportunitats, activitats, tasques, usuaris };
}
