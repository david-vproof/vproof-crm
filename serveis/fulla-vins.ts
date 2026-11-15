/**
 * La fulla de vins: reuneix el que surt al PDF. Sol ser la d'una activitat,
 * però també es treu des del selector de vins, per a un client o per a ningú.
 * L'activitat, el client i els vins surten de Directus; les fotos, de la biblioteca de fitxers; i els
 * preus, de FactuSol en directe i per a aquell client: el preu i el descompte
 * que FactuSol posaria a l'albarà (vegeu `domini/preu-factusol.ts`). No se'n
 * copia cap preu al CRM. Si FactuSol no respon, la fulla surt igual, sense
 * preus, i ho diu.
 */
import "server-only";

import { llegeixFitxer, llistaAmbTotal, obteItem } from "@/apis/sqlite/crm";
import { contacteUsuari } from "@/apis/sqlite/usuaris";
import { FITXES, esVisiblePer } from "@/domini/crm-fitxes";
import {
  type AjustDeVi,
  type ArticleDeFulla,
  CONTACTE_BODEGA,
  type ContacteDeFulla,
  type OrdreDeFulla,
  type PreuDeLinia,
  type ViDeFulla,
  ambAjust,
  ordenaVins,
  viDeFulla,
} from "@/domini/fulla-vins";
import { vinsDeLActivitat } from "@/serveis/crm-vins";

type Activitat = {
  id: string;
  data: string | null;
  assumpte: string | null;
  comercial: string | { id: string } | null;
  client: { id: string; nom_comercial: string | null; codi_erp: number | null } | null;
  lead: { id: string; nom: string | null } | null;
};

type ArticleLlegit = ArticleDeFulla & { codi_erp: string | null; imatge: string | null; preu: number | string | null };

/**
 * Una foto per al PDF: el PDF només entén JPEG i PNG, i en PNG es conserva el
 * fons transparent. Les mides diuen si l'ampolla és dreta, per ajeure-la.
 * Les fotos del catàleg porten un marge blanc al voltant de l'ampolla, que a la
 * fulla la faria petita: Directus el retalla (`trim`, una operació de sharp).
 */
const RETALLA_MARGE = JSON.stringify([["trim", { threshold: 30 }]]);

export type FotoDeFulla = { data: Buffer; format: "png" | "jpg"; amplada: number; alcada: number };

export type DadesFulla = {
  titol: string;
  /** Per a qui és: el client o el lead de l'activitat. */
  destinatari: string | null;
  data: string | null;
  vins: (ViDeFulla & { foto: FotoDeFulla | null })[];
  ambPreus: boolean;
  /** El correu i el telèfon del peu: els de qui treu la fulla. */
  contacte: ContacteDeFulla;
  /** Quina tarifa de FactuSol s'ha fet servir, per dir-ho al modal. */
  tarifa: { codi: number; nom: string | null; ivaInclos: boolean } | null;
  /** Coses que no han anat bé però no impedeixen la fulla, per ensenyar-les al modal. */
  avisos: string[];
};

const CAMPS_ARTICLE = [
  "id", "codi_erp", "nom", "familia", "garantia", "imatge", "preu",
  "camp_programable_2", "camp_programable_3", "camp_programable_4", "camp_programable_5",
];

async function foto(imatge: string | null): Promise<FotoDeFulla | null> {
  if (!imatge) return null;
  try {
    const data = await fotoRetallada(imatge);
    // Si Directus no l'ha pogut transformar, arriba l'original: val si és JPEG, i les mides no se saben.
    if (data.subarray(1, 4).toString("latin1") === "PNG") {
      return { data, format: "png", amplada: data.readUInt32BE(16), alcada: data.readUInt32BE(20) };
    }
    return data[0] === 0xff && data[1] === 0xd8 ? { data, format: "jpg", amplada: 0, alcada: 0 } : null;
  } catch {
    return null;
  }
}

/** La foto sense marge; si Directus no la pot retallar (una foto estranya), tal com és. */
async function fotoRetallada(imatge: string) {
  const mides = { width: "480", height: "480", fit: "inside", format: "png" };
  try {
    return Buffer.from(await (await llegeixFitxer(imatge, { ...mides, transforms: RETALLA_MARGE })).arrayBuffer());
  } catch {
    return Buffer.from(await (await llegeixFitxer(imatge, mides)).arrayBuffer());
  }
}

type Destinatari = { nom: string | null; codiErp: number | null };

/**
 * El contacte del peu: el de qui treu la fulla. Si no se sap qui és (les
 * credencials locals) o no es pot llegir, el de la bodega: la fulla surt igual.
 */
async function contacteDeQuiLaTreu(jo: string | null | undefined, avisos: string[]): Promise<ContacteDeFulla> {
  if (!jo) return CONTACTE_BODEGA;
  try {
    const contacte = await contacteUsuari(jo);
    if (contacte) {
      if (!contacte.telefon) avisos.push("El teu compte no té telèfon: al peu de la fulla només hi surten el correu i la web.");
      return contacte;
    }
  } catch {
    // Com si no hi fos: es diu a sota.
  }
  avisos.push("No s'ha pogut llegir el teu contacte: al peu de la fulla hi surt el de la bodega.");
  return CONTACTE_BODEGA;
}

export type OpcionsFulla = {
  /** L'id de Directus de qui treu la fulla: el seu correu i el seu telèfon van al peu. */
  jo?: string | null;
  ambPreus: boolean;
  /** El que el comercial ha retocat a la revisió (preu a mà, descompte, observacions), per sobre del que diu FactuSol. */
  ajustos?: Record<string, AjustDeVi>;
  /** Sense fotos només es llegeixen les dades, per ensenyar-les a la revisió abans del PDF. */
  ambFotos?: boolean;
  /** En quin ordre van els vins: per color i preu (per defecte) o tal com s'han triat. */
  ordre?: OrdreDeFulla;
};

/**
 * Tot el que surt a la fulla d'una activitat. `vins` són els triats a la
 * pantalla, que poden no estar desats encara; sense, els de l'activitat. Null
 * si l'activitat no existeix o no és de qui la demana.
 */
export async function dadesFullaVins(
  idActivitat: string,
  opcions: OpcionsFulla & { vins?: string[]; deQui: string | null },
): Promise<DadesFulla | null> {
  const activitat = await obteItem<Activitat>(FITXES.activitats.colleccio, idActivitat, [
    "id", "data", "assumpte", "comercial",
    "client.id", "client.nom_comercial", "client.codi_erp", "lead.id", "lead.nom",
  ]);
  if (!activitat || !esVisiblePer(FITXES.activitats, activitat, opcions.deQui)) return null;

  const ids = opcions.vins?.length ? opcions.vins : (await vinsDeLActivitat(idActivitat)).map((vi) => vi.id);
  const client = activitat.client;
  return fullaDeVins(ids, { nom: client?.nom_comercial ?? activitat.lead?.nom ?? null, codiErp: client?.codi_erp ?? null }, activitat.data, opcions);
}

type ClientLlegit = { id: string; nom_comercial: string | null; codi_erp: number | null; comercial: string | { id: string } | null };

/**
 * La fulla des del selector de vins, sense activitat: per a un client (amb la
 * seva tarifa de FactuSol), per a un lead (que encara no en té: amb la de venda
 * al major, com la fulla d'una activitat seva) o per a ningú, i llavors sense
 * preus. La data és la d'avui. Null si el client o el lead no existeix o no és
 * de qui la demana.
 */
export async function dadesFullaVinsLliure(
  opcions: OpcionsFulla & { vins: string[]; client: string | null; lead?: string | null; deQui: string | null },
): Promise<DadesFulla | null> {
  let destinatari: Destinatari = { nom: null, codiErp: null };
  if (opcions.client) {
    const client = await obteItem<ClientLlegit>(FITXES.clients.colleccio, opcions.client, ["id", "nom_comercial", "codi_erp", "comercial"]);
    if (!client || !esVisiblePer(FITXES.clients, client, opcions.deQui)) return null;
    destinatari = { nom: client.nom_comercial, codiErp: client.codi_erp };
  } else if (opcions.lead) {
    const lead = await obteItem<{ nom: string | null }>(FITXES.leads.colleccio, opcions.lead, ["nom"]);
    if (!lead) return null;
    destinatari = { nom: lead.nom, codiErp: null };
  }
  const avui = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  return fullaDeVins(opcions.vins, destinatari, avui, { ...opcions, ambPreus: opcions.ambPreus && Boolean(opcions.client || opcions.lead) });
}

/**
 * Les files de la fulla: els articles amb els preus de FactuSol per al
 * destinatari i les fotos, per color i preu o, si es demana, en l'ordre en
 * què es van triar. L'ordre per preu mira els preus encara que la fulla vagi
 * sense: es llegeixen igualment i no s'imprimeixen.
 */
async function fullaDeVins(ids: string[], destinatari: Destinatari, data: string | null, opcions: OpcionsFulla): Promise<DadesFulla> {
  const { files } = ids.length
    ? await llistaAmbTotal<ArticleLlegit>("crm_articles", { camps: CAMPS_ARTICLE, limit: -1, condicions: [{ id: { _in: ids } }] })
    : { files: [] };
  // En l'ordre en què es van triar, que és com es van ensenyar.
  const perId = new Map(files.map((article) => [article.id, article]));
  const articles = ids.flatMap((id) => (perId.has(id) ? [perId.get(id)!] : []));

  const avisos: string[] = [];
  const contacte = await contacteDeQuiLaTreu(opcions.jo, avisos);
  const preus = new Map<string, PreuDeLinia>();
  const tarifa: DadesFulla["tarifa"] = null;

  const ordre = opcions.ordre ?? "color";
  if (opcions.ambPreus || ordre === "color") {
    for (const article of articles) {
      const preu = Number(article.preu);
      if (article.preu !== null && article.preu !== "" && Number.isFinite(preu)) preus.set(article.id, { preu, descompte: 0 });
    }
    const sensePreu = articles.length - preus.size;
    if (opcions.ambPreus && sensePreu > 0) {
      avisos.push(`${sensePreu} ${sensePreu === 1 ? "vi no té" : "vins no tenen"} preu de venda.`);
    }
  }

  const fotos = opcions.ambFotos === false ? articles.map(() => null) : await Promise.all(articles.map((article) => foto(article.imatge)));
  // Els retocs del comercial van abans d'ordenar: un preu posat a mà compta per a l'ordre.
  // Sense preus a la fulla només hi compten les observacions: el preu buit del
  // modal no ha d'esborrar el del producte, que és el que ordena.
  const vins = articles.map((article, i) => {
    const ajust = opcions.ajustos?.[article.id];
    return {
      ...ambAjust(viDeFulla(article, preus.get(article.id) ?? null), opcions.ambPreus || !ajust ? ajust : { observacions: ajust.observacions }),
      foto: fotos[i],
    };
  });
  return {
    titol: "Vins tastats",
    destinatari: destinatari.nom,
    data,
    // Sense preus a la fulla, els llegits només per ordenar no surten enlloc.
    vins: ordenaVins(vins, ordre).map((vi) => (opcions.ambPreus ? vi : { ...vi, preu: null, descompte: null })),
    ambPreus: opcions.ambPreus,
    contacte,
    tarifa,
    avisos,
  };
}
