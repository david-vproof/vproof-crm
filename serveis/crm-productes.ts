/**
 * Els productes presentats en una activitat.
 *
 * No són text lliure: es trien del catàleg d'articles (`crm_articles`, la
 * còpia de l'ERP que manté la sincronització) i es desen a
 * `crm_activitats_productes`, una fila per producte. Així se sap quins productes s'han ensenyat
 * i a qui, i una visita en pot portar tants com calgui.
 */
import "server-only";

import { creaItems, esborraItems, llistaActivitatsEntre, llistaAmbTotal, type Condicio } from "@/apis/sqlite/crm";
import { margesDelDia } from "@/domini/crm-avui";
import { clauDeValor } from "@/domini/cataleg-articles";
import { MAXIM_PRODUCTES_PER_ACTIVITAT, producteDeCataleg, type ClientOLead, type Compres, type Presentacions, type ProducteDeCataleg } from "@/domini/cistella-productes";
import { estocsDeProductes, type EstocDeProducte, type Estocs } from "@/domini/estoc-productes";
import { preusDeProductes, type Preus } from "@/domini/preus-productes";
import { ARTICLES_ACTIUS, ARTICLES_VIGENTS, catalegArticles, historicsEntre, urlImatge, type AbastCataleg } from "@/serveis/articles";

const ARTICLES = "crm_articles";
const PRODUCTES = "crm_activitats_productes";

/** Només els articles que avui són actius a l'ERP: ni esborrats ni històrics. */
const ACTIUS: Condicio = ARTICLES_ACTIUS;

/** Quants en porta una cerca: prou per triar a ull, i si no, s'afina. */
const MAXIM_CERCATS = 60;

export { MAXIM_PRODUCTES_PER_ACTIVITAT };

const CAMPS = ["id", "nom", "codi_erp", "codi_barres", "familia", "referencia_proveidor", "imatge", "laboratori.nom_comercial"];

type FilaArticle = {
  id: string;
  nom: string | null;
  codi_erp: string | null;
  codi_barres: string | null;
  familia: string | null;
  referencia_proveidor: string | null;
  imatge: string | null;
  laboratori: { nom_comercial: string | null } | null;
};

/** Un producte com el veu el selector: el nom, d'on és (laboratori i tipus), i la foto petita si en té. */
export type Producte = { id: string; nom: string; detall: string; foto: string | null };

function producte(fila: FilaArticle): Producte {
  return {
    id: fila.id,
    nom: fila.nom?.trim() || "Sense nom",
    detall: [fila.laboratori?.nom_comercial, fila.familia]
      .map((tros) => (tros ?? "").trim())
      .filter(Boolean)
      .join(" · "),
    foto: urlImatge({ id: fila.id, imatge: fila.imatge }, "petita"),
  };
}

/** On es busca: el producte, els seus codis, la família, la referència del laboratori i el laboratori que el fa, tot pla. */
function textDeCerca(fila: FilaArticle) {
  return clauDeValor(
    [fila.nom, fila.codi_erp, fila.codi_barres, fila.familia, fila.referencia_proveidor, fila.laboratori?.nom_comercial].filter(Boolean).join(" "),
  );
}

/**
 * La cerca del selector de productes. Es fa aquí i no a la base de dades perquè vagi sense
 * accents, com al configurador: «triada» ha de trobar «Tríada». El catàleg
 * actiu són uns centenars de productes, i es llegeix sencer. Cada paraula ha de
 * sortir en algun camp: «torres coronas» troba el Gran Coronas de Torres
 * encara que les dues paraules siguin a camps diferents.
 */
export async function cercaProductes(cerca: string): Promise<{ files: Producte[]; total: number }> {
  const { files } = await llistaAmbTotal<FilaArticle>(ARTICLES, { camps: CAMPS, ordre: "nom", limit: -1, condicions: [ACTIUS] });
  const mots = clauDeValor(cerca).split(" ").filter(Boolean).slice(0, 6);
  const trobats = mots.length ? files.filter((fila) => {
    const text = textDeCerca(fila);
    return mots.every((mot) => text.includes(mot));
  }) : files;
  return { files: trobats.slice(0, MAXIM_CERCATS).map(producte), total: trobats.length };
}

/**
 * Els productes d'una activitat, en l'ordre en què es van triar. Un producte que ja no és
 * actiu a l'ERP hi continua sortint: el que es va presentar, es va presentar.
 */
export async function productesDeLActivitat(activitat: string): Promise<Producte[]> {
  const { files } = await llistaAmbTotal<{ id: string; article: FilaArticle | null }>(PRODUCTES, {
    camps: ["id", ...CAMPS.map((camp) => `article.${camp}`)],
    ordre: "date_created",
    limit: -1,
    filtre: { camp: "activitat", valor: activitat },
  });
  return files.flatMap((fila) => (fila.article ? [producte(fila.article)] : []));
}

/** Deixa l'activitat amb aquests productes i prou: afegeix els que hi falten i treu els que hi sobren. */
export async function desaProductesDeLActivitat(activitat: string, articles: string[]) {
  const volguts = [...new Set(articles.filter(Boolean))];
  const { files } = await llistaAmbTotal<{ id: string; article: string | null }>(PRODUCTES, {
    camps: ["id", "article"],
    limit: -1,
    filtre: { camp: "activitat", valor: activitat },
  });
  const tenia = new Set(files.map((fila) => fila.article));
  const sobren = files.filter((fila) => !fila.article || !volguts.includes(fila.article)).map((fila) => fila.id);
  const falten = volguts.filter((article) => !tenia.has(article));

  await esborraItems(PRODUCTES, sobren);
  await creaItems(PRODUCTES, falten.map((article) => ({ activitat, article })));
}

/**
 * El catàleg per al configurador de productes, amb les característiques ja
 * extretes: el navegador el té sencer i hi filtra (vegeu
 * `domini/cistella-productes.ts`). Els actius són uns centenars i hi caben; els
 * històrics (uns milers) es demanen a part, només quan algú els vol veure.
 */
export async function catalegDeProductes(abast: AbastCataleg = "actius"): Promise<ProducteDeCataleg[]> {
  const articles = await catalegArticles(abast);
  return articles.map((article) => producteDeCataleg(article, urlImatge(article, "petita")));
}

/** D'aquests productes, els històrics, a punt per al configurador: els que uns clients han presentat o comprat. */
export async function productesHistoricsEntre(ids: string[]): Promise<ProducteDeCataleg[]> {
  const articles = await historicsEntre(ids);
  return articles.map((article) => producteDeCataleg(article, urlImatge(article, "petita")));
}

/**
 * L'estoc de tot el catàleg (vegeu `domini/estoc-productes.ts`): per producte, el que
 * l'ERP hi ha deixat. Els històrics també: n'hi ha que encara en tenen.
 */
export async function estocDelCataleg(): Promise<Estocs> {
  const { files } = await llistaAmbTotal<EstocDeProducte>(ARTICLES, {
    camps: ["id", "estoc_actual", "estoc_disponible"],
    limit: -1,
    condicions: [ARTICLES_VIGENTS],
  });
  return estocsDeProductes(files);
}

export type PreusDelCataleg = { preus: Preus; tarifa: string };

/** El preu de venda de tot el catàleg, històrics inclosos, sense IVA: el que l'ERP deixa a cada producte. */
export async function preusDelCataleg(): Promise<PreusDelCataleg> {
  const { files } = await llistaAmbTotal<{ id: string; preu: number | string | null }>(ARTICLES, {
    camps: ["id", "preu"],
    limit: -1,
    condicions: [ARTICLES_VIGENTS],
  });
  return { preus: preusDeProductes(files), tarifa: "Preu de venda" };
}

/** Quants clients es poden mirar d'un cop: un segment sencer hi cap. */
export const MAXIM_CLIENTS_TASTOS = 500;

const LINIES_ALBARA = "crm_albarans_linies";

type FilaPresentacio = { article: string | null; activitat: { data: string | null; client: { id: string; nom_comercial: string | null } | null } | null };
type FilaPresentacioDeLead = { article: string | null; activitat: { data: string | null; lead: { id: string; nom: string | null } | null } | null };
type FilaCompra = {
  article: string | null;
  quantitat: number | string | null;
  albara: { data: string | null; client: { id: string; nom_comercial: string | null } | null } | null;
};

const idsNets = (clients: string[]) => [...new Set(clients.filter(Boolean))].slice(0, MAXIM_CLIENTS_TASTOS);

/** Una activitat on s'ha presentat un producte. */
export type ActivitatDelPresentacio = {
  id: string;
  data: string | null;
  assumpte: string | null;
  comercial: string | null;
  /** Ve d'un lead: a la fitxa d'un client, és de quan encara ho era. */
  delLead: boolean;
};

/** Un producte presentat per un client o un lead: el producte, quantes vegades i a quines activitats. */
export type ProductePresentat = Producte & {
  vegades: number;
  /** La data de la darrera vegada, o null si cap activitat en porta. */
  darrera: string | null;
  /** Les activitats on s'ha presentat, de la més recent a la més antiga. */
  activitats: ActivitatDelPresentacio[];
};

type FilaPresentacioDelClient = {
  article: FilaArticle | null;
  activitat: {
    id: string;
    data: string | null;
    assumpte: string | null;
    comercial: string | { id: string } | null;
    lead: string | { id: string } | null;
  } | null;
};

/**
 * Els productes que ha presentat un client, per a la seva fitxa: de totes les
 * activitats on s'han presentat, de qui sigui (que un client ja ha
 * presentat un producte és un fet del client), amb quantes vegades i quan. Hi compten
 * les de quan encara era lead, que amb la conversió passen a ser seves (vegeu
 * `passaDelLeadAlClient`). Un producte que ja no és actiu a l'ERP hi continua
 * sortint: el que es va presentar, es va presentar. Del més recent al més antic.
 */
export async function productesPresentatsDelClient(client: string): Promise<ProductePresentat[]> {
  return productesPresentats({ activitat: { client: { _eq: client } } });
}

/** Els productes que ha presentat un lead, per a la seva fitxa: els de les seves activitats. */
export async function productesPresentatsDelLead(lead: string): Promise<ProductePresentat[]> {
  return productesPresentats({ activitat: { lead: { _eq: lead } } });
}

async function productesPresentats(condicio: Condicio): Promise<ProductePresentat[]> {
  const { files } = await llistaAmbTotal<FilaPresentacioDelClient>(PRODUCTES, {
    camps: [...CAMPS.map((camp) => `article.${camp}`), "activitat.id", "activitat.data", "activitat.assumpte", "activitat.comercial", "activitat.lead"],
    limit: -1,
    condicions: [condicio],
  });
  const perProducte = new Map<string, ProductePresentat>();
  for (const fila of files) {
    if (!fila.article || !fila.activitat) continue;
    const presentat = perProducte.get(fila.article.id) ?? { ...producte(fila.article), vegades: 0, darrera: null, activitats: [] };
    const comercial = typeof fila.activitat.comercial === "string" ? fila.activitat.comercial : (fila.activitat.comercial?.id ?? null);
    presentat.vegades += 1;
    presentat.activitats.push({ id: fila.activitat.id, data: fila.activitat.data, assumpte: fila.activitat.assumpte, comercial, delLead: Boolean(fila.activitat.lead) });
    if (fila.activitat.data && (!presentat.darrera || fila.activitat.data > presentat.darrera)) presentat.darrera = fila.activitat.data;
    perProducte.set(fila.article.id, presentat);
  }
  const perData = (a: { data: string | null }, b: { data: string | null }) => (b.data ?? "").localeCompare(a.data ?? "");
  return [...perProducte.values()]
    .map((presentat) => ({ ...presentat, activitats: [...presentat.activitats].sort(perData) }))
    .sort((a, b) => (b.darrera ?? "").localeCompare(a.darrera ?? "") || a.nom.localeCompare(b.nom, "ca"));
}

/**
 * Quins productes ha presentat cada client o lead dels triats: de les activitats on
 * s'han presentat (`crm_activitats_productes`), per producte, qui hi era amb la
 * data de la darrera vegada. Es miren les activitats de tothom, no només les
 * del comercial de la sessió: que un client ja ha presentat un producte és un fet del
 * client. Les de quan un client encara era lead ja són seves: vegeu
 * `passaDelLeadAlClient`.
 */
export async function productesPresentatsPer(clients: string[], leads: string[] = []): Promise<Presentacions> {
  const idsClients = idsNets(clients);
  const idsLeads = idsNets(leads);
  const [{ files: deClients }, { files: deLeads }] = await Promise.all([
    idsClients.length > 0
      ? llistaAmbTotal<FilaPresentacio>(PRODUCTES, {
          camps: ["article", "activitat.data", "activitat.client.id", "activitat.client.nom_comercial"],
          limit: -1,
          condicions: [{ activitat: { client: { _in: idsClients } } }],
        })
      : { files: [] as FilaPresentacio[] },
    idsLeads.length > 0
      ? llistaAmbTotal<FilaPresentacioDeLead>(PRODUCTES, {
          camps: ["article", "activitat.data", "activitat.lead.id", "activitat.lead.nom"],
          limit: -1,
          condicions: [{ activitat: { lead: { _in: idsLeads } } }],
        })
      : { files: [] as FilaPresentacioDeLead[] },
  ]);

  const presentacions: Presentacions = {};
  const apunta = (article: string, id: string, nom: string | null, data: string | null) => {
    const llista = (presentacions[article] ??= []);
    const previ = llista.find((presentacio) => presentacio.client === id);
    if (!previ) llista.push({ client: id, nom: nom?.trim() || "Sense nom", data });
    else if (data && (!previ.data || data > previ.data)) previ.data = data;
  };

  for (const fila of deClients) {
    const client = fila.activitat?.client;
    if (fila.article && client) apunta(fila.article, client.id, client.nom_comercial, fila.activitat?.data ?? null);
  }
  for (const fila of deLeads) {
    const lead = fila.activitat?.lead;
    if (fila.article && lead) apunta(fila.article, lead.id, lead.nom, fila.activitat?.data ?? null);
  }
  return presentacions;
}

/**
 * Quins productes ha comprat cada client: de les línies dels albarans de venda
 * (`crm_albarans_linies`, la còpia de l'ERP d'aquest exercici i del
 * passat), per producte, els clients amb la data del darrer albarà i les unitats
 * en total. Els productes històrics hi compten; les línies que no apunten a cap
 * article (text lliure), no.
 */
export async function productesCompratsPer(clients: string[]): Promise<Compres> {
  const ids = idsNets(clients);
  if (ids.length === 0) return {};
  const { files } = await llistaAmbTotal<FilaCompra>(LINIES_ALBARA, {
    camps: ["article", "quantitat", "albara.data", "albara.client.id", "albara.client.nom_comercial"],
    limit: -1,
    condicions: [{ albara: { client: { _in: ids } } }, { article: { _nnull: true } }, { erp_absent_des_de: { _null: true } }],
  });
  const compres: Compres = {};
  for (const fila of files) {
    const client = fila.albara?.client;
    if (!fila.article || !client) continue;
    const llista = (compres[fila.article] ??= []);
    const data = fila.albara?.data ?? null;
    const unitats = Number(fila.quantitat) || 0;
    const previ = llista.find((compra) => compra.client === client.id);
    if (!previ) llista.push({ client: client.id, nom: client.nom_comercial?.trim() || "Sense nom", data, unitats });
    else {
      previ.unitats += unitats;
      if (data && (!previ.data || data > previ.data)) previ.data = data;
    }
  }
  return compres;
}

/** Una activitat d'un dia de visita i el client (o lead) que s'hi veu: per saber a quantes aniran els productes. */
export type ActivitatDelDia = { id: string; client: string };

/**
 * Els clients i leads que es visiten un dia, per al selector de productes: els de
 * les activitats d'aquell dia (el dia d'aquí, no el del servidor), sense
 * repetir. Es miren amb la mateixa visibilitat que l'agenda: les de qui té la
 * sessió oberta, o totes si és administrador. Les activitats que no són de
 * ningú no hi entren: es diu quantes queden fora.
 *
 * També tornen les activitats (id i de qui són), perquè el selector sàpiga a
 * quantes visites anirien els productes de la cistella.
 */
export async function clientsDelDia(
  dia: string,
  comercial: string | null,
): Promise<{ clients: ClientOLead[]; activitats: ActivitatDelDia[]; senseClient: number }> {
  const { desde, fins } = margesDelDia(dia);
  const files = await llistaActivitatsEntre(desde, fins, comercial);
  const visitats = new Map<string, ClientOLead>();
  const activitats: ActivitatDelDia[] = [];
  let senseClient = 0;
  for (const { id, client, lead } of files) {
    const qui: ClientOLead | null = client?.id
      ? { id: client.id, text: client.nom_comercial?.trim() || "Sense nom" }
      : lead?.id
        ? { id: lead.id, text: lead.nom?.trim() || "Sense nom", lead: true }
        : null;
    if (!qui) {
      senseClient += 1;
      continue;
    }
    activitats.push({ id, client: qui.id });
    if (!visitats.has(qui.id)) visitats.set(qui.id, qui);
  }
  return { clients: [...visitats.values()], activitats, senseClient };
}

/** Què ha passat en posar la cistella a les visites d'un dia. */
export type ResultatProductesALesVisites = {
  /** A quantes activitats s'han posat productes (les que ja els tenien tots també hi compten). */
  activitats: number;
  /** Quantes files de producte s'han creat, sumant totes les activitats. */
  afegits: number;
  /** Activitats on no hi cabien tots: s'hi han posat fins al màxim i prou. */
  plenes: number;
};

/**
 * Posa els productes de la cistella del selector a les activitats d'un dia de
 * visita: a cada activitat dels clients o leads triats, els que encara no
 * tingués (els que ja hi eren es queden; no se'n treu cap). Les activitats es
 * tornen a llegir aquí amb la visibilitat de la sessió, i no es confia en cap
 * id d'activitat del navegador: només hi entren les del dia que veu qui ho
 * demana i que són d'un dels clients o leads donats. Cap activitat passa de
 * `MAXIM_PRODUCTES_PER_ACTIVITAT`: si no hi caben tots, s'omple fins al màxim en
 * l'ordre de la cistella i es diu quantes han quedat plenes.
 */
export async function posaProductesALesVisites(
  dia: string,
  comercial: string | null,
  clients: string[],
  articles: string[],
): Promise<ResultatProductesALesVisites> {
  const volguts = [...new Set(articles.filter(Boolean))];
  const triats = new Set(clients);
  const { desde, fins } = margesDelDia(dia);
  const activitats = (await llistaActivitatsEntre(desde, fins, comercial)).filter((activitat) =>
    triats.has(activitat.client?.id ?? activitat.lead?.id ?? ""),
  );
  if (activitats.length === 0 || volguts.length === 0) return { activitats: 0, afegits: 0, plenes: 0 };

  const ids = activitats.map((activitat) => activitat.id);
  const { files } = await llistaAmbTotal<{ activitat: string | null; article: string | null }>(PRODUCTES, {
    camps: ["activitat", "article"],
    limit: -1,
    condicions: [{ activitat: { _in: ids } }],
  });
  const tenien = new Map<string, Set<string>>();
  for (const fila of files) {
    if (!fila.activitat || !fila.article) continue;
    if (!tenien.has(fila.activitat)) tenien.set(fila.activitat, new Set());
    tenien.get(fila.activitat)!.add(fila.article);
  }

  const noves: { activitat: string; article: string }[] = [];
  let plenes = 0;
  for (const id of ids) {
    const tenia = tenien.get(id) ?? new Set<string>();
    const falten = volguts.filter((article) => !tenia.has(article));
    const lloc = Math.max(0, MAXIM_PRODUCTES_PER_ACTIVITAT - tenia.size);
    if (falten.length > lloc) plenes += 1;
    for (const article of falten.slice(0, lloc)) noves.push({ activitat: id, article });
  }
  const afegits = await creaItems(PRODUCTES, noves);
  return { activitats: ids.length, afegits, plenes };
}
