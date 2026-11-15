/**
 * Els vins presentats o tastats en una activitat.
 *
 * No són text lliure: es trien del catàleg d'articles (`crm_articles`, la
 * còpia de FactuSol que manté la sincronització) i es desen a
 * `crm_activitats_vins`, una fila per vi. Així se sap quins vins s'han ensenyat
 * i a qui, i una visita en pot portar tants com calgui.
 */
import "server-only";

import { creaItems, esborraItems, llistaActivitatsEntre, llistaAmbTotal, type Condicio } from "@/apis/directus/crm";
import { llistaEstoc, preusDeTarifa } from "@/apis/factusol";
import { margesDelDia } from "@/domini/crm-avui";
import { clauDeValor } from "@/domini/cataleg-articles";
import { MAXIM_VINS_PER_ACTIVITAT, viDeCataleg, type ClientOLead, type Compres, type Tastos, type ViDeCataleg } from "@/domini/cistella-vins";
import { agregaEstoc, type Estocs } from "@/domini/estoc-vins";
import { TARIFA_SENSE_CLIENT } from "@/domini/preu-factusol";
import { preusPerVi, type Preus } from "@/domini/preus-vins";
import { ARTICLES_ACTIUS, ARTICLES_VIGENTS, catalegArticles, historicsEntre, urlImatge, type AbastCataleg } from "@/serveis/articles";

const ARTICLES = "crm_articles";
const VINS = "crm_activitats_vins";

/** Només els articles que avui són actius a FactuSol: ni esborrats ni històrics. */
const ACTIUS: Condicio = ARTICLES_ACTIUS;

/** Quants en porta una cerca: prou per triar a ull, i si no, s'afina. */
const MAXIM_CERCATS = 60;

export { MAXIM_VINS_PER_ACTIVITAT };

const CAMPS = ["id", "nom", "codi_erp", "codi_barres", "familia", "referencia_proveidor", "imatge", "celler.nom_comercial"];

type FilaArticle = {
  id: string;
  nom: string | null;
  codi_erp: string | null;
  codi_barres: string | null;
  familia: string | null;
  referencia_proveidor: string | null;
  imatge: string | null;
  celler: { nom_comercial: string | null } | null;
};

/** Un vi com el veu el selector: el nom, d'on és (celler i tipus), i la foto petita si en té. */
export type Vi = { id: string; nom: string; detall: string; foto: string | null };

function vi(fila: FilaArticle): Vi {
  return {
    id: fila.id,
    nom: fila.nom?.trim() || "Sense nom",
    detall: [fila.celler?.nom_comercial, fila.familia]
      .map((tros) => (tros ?? "").trim())
      .filter(Boolean)
      .join(" · "),
    foto: urlImatge({ id: fila.id, imatge: fila.imatge }, "petita"),
  };
}

/** On es busca: el vi, els seus codis, la família, la referència del celler i el celler que el fa, tot pla. */
function textDeCerca(fila: FilaArticle) {
  return clauDeValor(
    [fila.nom, fila.codi_erp, fila.codi_barres, fila.familia, fila.referencia_proveidor, fila.celler?.nom_comercial].filter(Boolean).join(" "),
  );
}

/**
 * La cerca del selector de vins. Es fa aquí i no a Directus perquè vagi sense
 * accents, com al configurador: «triada» ha de trobar «Tríada». El catàleg
 * actiu són uns centenars de vins, i es llegeix sencer. Cada paraula ha de
 * sortir en algun camp: «torres coronas» troba el Gran Coronas de Torres
 * encara que les dues paraules siguin a camps diferents.
 */
export async function cercaVins(cerca: string): Promise<{ files: Vi[]; total: number }> {
  const { files } = await llistaAmbTotal<FilaArticle>(ARTICLES, { camps: CAMPS, ordre: "nom", limit: -1, condicions: [ACTIUS] });
  const mots = clauDeValor(cerca).split(" ").filter(Boolean).slice(0, 6);
  const trobats = mots.length ? files.filter((fila) => {
    const text = textDeCerca(fila);
    return mots.every((mot) => text.includes(mot));
  }) : files;
  return { files: trobats.slice(0, MAXIM_CERCATS).map(vi), total: trobats.length };
}

/**
 * Els vins d'una activitat, en l'ordre en què es van triar. Un vi que ja no és
 * actiu a FactuSol hi continua sortint: el que es va tastar, es va tastar.
 */
export async function vinsDeLActivitat(activitat: string): Promise<Vi[]> {
  const { files } = await llistaAmbTotal<{ id: string; article: FilaArticle | null }>(VINS, {
    camps: ["id", ...CAMPS.map((camp) => `article.${camp}`)],
    ordre: "date_created",
    limit: -1,
    filtre: { camp: "activitat", valor: activitat },
  });
  return files.flatMap((fila) => (fila.article ? [vi(fila.article)] : []));
}

/** Deixa l'activitat amb aquests vins i prou: afegeix els que hi falten i treu els que hi sobren. */
export async function desaVinsDeLActivitat(activitat: string, articles: string[]) {
  const volguts = [...new Set(articles.filter(Boolean))];
  const { files } = await llistaAmbTotal<{ id: string; article: string | null }>(VINS, {
    camps: ["id", "article"],
    limit: -1,
    filtre: { camp: "activitat", valor: activitat },
  });
  const tenia = new Set(files.map((fila) => fila.article));
  const sobren = files.filter((fila) => !fila.article || !volguts.includes(fila.article)).map((fila) => fila.id);
  const falten = volguts.filter((article) => !tenia.has(article));

  await esborraItems(VINS, sobren);
  await creaItems(VINS, falten.map((article) => ({ activitat, article })));
}

/**
 * El catàleg per al configurador de vins, amb les característiques ja
 * extretes: el navegador el té sencer i hi filtra (vegeu
 * `domini/cistella-vins.ts`). Els actius són uns centenars i hi caben; els
 * històrics (uns milers) es demanen a part, només quan algú els vol veure.
 */
export async function catalegDeVins(abast: AbastCataleg = "actius"): Promise<ViDeCataleg[]> {
  const articles = await catalegArticles(abast);
  return articles.map((article) => viDeCataleg(article, urlImatge(article, "petita")));
}

/** D'aquests vins, els històrics, a punt per al configurador: els que uns clients han tastat o comprat. */
export async function vinsHistoricsEntre(ids: string[]): Promise<ViDeCataleg[]> {
  const articles = await historicsEntre(ids);
  return articles.map((article) => viDeCataleg(article, urlImatge(article, "petita")));
}

/**
 * L'estoc de tot el catàleg, en viu de FactuSol (vegeu `domini/estoc-vins.ts`):
 * per vi, la suma i el desglòs per magatzem. Els històrics també: n'hi ha que
 * encara en tenen, i si no, el selector diria que no. Si l'ERP no respon o no
 * hi ha credencials, l'error puja i el selector ho diu.
 */
export async function estocDelCataleg(): Promise<Estocs> {
  const [{ files }, { estoc, magatzems }] = await Promise.all([
    llistaAmbTotal<{ id: string; codi_erp: string | null }>(ARTICLES, { camps: ["id", "codi_erp"], limit: -1, condicions: [ARTICLES_VIGENTS] }),
    llistaEstoc(),
  ]);
  const idPerCodi = new Map(files.flatMap((fila) => (fila.codi_erp?.trim() ? [[fila.codi_erp.trim(), fila.id] as [string, string]] : [])));
  return agregaEstoc(estoc, magatzems, idPerCodi);
}

/** Els preus llegits, amb l'hora: FactuSol no els canvia a cada minut, i els selectors els demanen sovint. */
let memoriaPreus: { valor: PreusDelCataleg; expira: number } | null = null;
const PREUS_VALEN_MS = 10 * 60 * 1000;

export type PreusDelCataleg = { preus: Preus; tarifa: string };

/**
 * El preu de tot el catàleg, històrics inclosos, a la tarifa de venda al major,
 * sense IVA, en viu de FactuSol (vegeu `domini/preus-vins.ts`), amb el nom de la
 * tarifa per dir d'on surt. Es recorda deu minuts. Si l'ERP no respon o no hi ha
 * credencials, l'error puja i els selectors surten sense preus.
 */
export async function preusDelCataleg(): Promise<PreusDelCataleg> {
  if (memoriaPreus && memoriaPreus.expira > Date.now()) return memoriaPreus.valor;
  const [{ files }, deTarifa] = await Promise.all([
    llistaAmbTotal<{ id: string; codi_erp: string | null }>(ARTICLES, { camps: ["id", "codi_erp"], limit: -1, condicions: [ARTICLES_VIGENTS] }),
    preusDeTarifa(TARIFA_SENSE_CLIENT),
  ]);
  const idPerCodi = new Map(files.flatMap((fila) => (fila.codi_erp?.trim() ? [[fila.codi_erp.trim(), fila.id] as [string, string]] : [])));
  // «TARIFA VENDA AL MAJOR» → «Venda al major»: el mot «tarifa» ja va al davant on s'ensenya.
  const nom = (deTarifa.tarifa.nom ?? "").replace(/^tarifa\s+/i, "").trim();
  const valor = {
    preus: preusPerVi(deTarifa.preus, idPerCodi),
    tarifa: `Tarifa ${deTarifa.tarifa.codi}${nom ? ` · ${nom.charAt(0).toLocaleUpperCase("ca") + nom.slice(1).toLocaleLowerCase("ca")}` : ""}`,
  };
  memoriaPreus = { valor, expira: Date.now() + PREUS_VALEN_MS };
  return valor;
}

/** Quants clients es poden mirar d'un cop: un segment sencer hi cap. */
export const MAXIM_CLIENTS_TASTOS = 500;

const LINIES_ALBARA = "crm_albarans_linies";

type FilaTast = { article: string | null; activitat: { data: string | null; client: { id: string; nom_comercial: string | null } | null } | null };
type FilaTastDeLead = { article: string | null; activitat: { data: string | null; lead: { id: string; nom: string | null } | null } | null };
type FilaCompra = {
  article: string | null;
  quantitat: number | string | null;
  albara: { data: string | null; client: { id: string; nom_comercial: string | null } | null } | null;
};

const idsNets = (clients: string[]) => [...new Set(clients.filter(Boolean))].slice(0, MAXIM_CLIENTS_TASTOS);

/** Una activitat on s'ha tastat un vi. */
export type ActivitatDelTast = {
  id: string;
  data: string | null;
  assumpte: string | null;
  comercial: string | null;
  /** Ve d'un lead: a la fitxa d'un client, és de quan encara ho era. */
  delLead: boolean;
};

/** Un vi tastat per un client o un lead: el vi, quantes vegades i a quines activitats. */
export type ViTastat = Vi & {
  vegades: number;
  /** La data de la darrera vegada, o null si cap activitat en porta. */
  darrera: string | null;
  /** Les activitats on s'ha tastat, de la més recent a la més antiga. */
  activitats: ActivitatDelTast[];
};

type FilaTastDelClient = {
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
 * Els vins que ha tastat un client, per a la seva fitxa: de totes les
 * activitats on s'han presentat o tastat, de qui sigui (que un client ja ha
 * tastat un vi és un fet del client), amb quantes vegades i quan. Hi compten
 * les de quan encara era lead, que amb la conversió passen a ser seves (vegeu
 * `passaDelLeadAlClient`). Un vi que ja no és actiu a FactuSol hi continua
 * sortint: el que es va tastar, es va tastar. Del més recent al més antic.
 */
export async function vinsTastatsDelClient(client: string): Promise<ViTastat[]> {
  return vinsTastats({ activitat: { client: { _eq: client } } });
}

/** Els vins que ha tastat un lead, per a la seva fitxa: els de les seves activitats. */
export async function vinsTastatsDelLead(lead: string): Promise<ViTastat[]> {
  return vinsTastats({ activitat: { lead: { _eq: lead } } });
}

async function vinsTastats(condicio: Condicio): Promise<ViTastat[]> {
  const { files } = await llistaAmbTotal<FilaTastDelClient>(VINS, {
    camps: [...CAMPS.map((camp) => `article.${camp}`), "activitat.id", "activitat.data", "activitat.assumpte", "activitat.comercial", "activitat.lead"],
    limit: -1,
    condicions: [condicio],
  });
  const perVi = new Map<string, ViTastat>();
  for (const fila of files) {
    if (!fila.article || !fila.activitat) continue;
    const tastat = perVi.get(fila.article.id) ?? { ...vi(fila.article), vegades: 0, darrera: null, activitats: [] };
    const comercial = typeof fila.activitat.comercial === "string" ? fila.activitat.comercial : (fila.activitat.comercial?.id ?? null);
    tastat.vegades += 1;
    tastat.activitats.push({ id: fila.activitat.id, data: fila.activitat.data, assumpte: fila.activitat.assumpte, comercial, delLead: Boolean(fila.activitat.lead) });
    if (fila.activitat.data && (!tastat.darrera || fila.activitat.data > tastat.darrera)) tastat.darrera = fila.activitat.data;
    perVi.set(fila.article.id, tastat);
  }
  const perData = (a: { data: string | null }, b: { data: string | null }) => (b.data ?? "").localeCompare(a.data ?? "");
  return [...perVi.values()]
    .map((tastat) => ({ ...tastat, activitats: [...tastat.activitats].sort(perData) }))
    .sort((a, b) => (b.darrera ?? "").localeCompare(a.darrera ?? "") || a.nom.localeCompare(b.nom, "ca"));
}

/**
 * Quins vins ha tastat cada client o lead dels triats: de les activitats on
 * s'han presentat o tastat (`crm_activitats_vins`), per vi, qui hi era amb la
 * data de la darrera vegada. Es miren les activitats de tothom, no només les
 * del comercial de la sessió: que un client ja ha tastat un vi és un fet del
 * client. Les de quan un client encara era lead ja són seves: vegeu
 * `passaDelLeadAlClient`.
 */
export async function vinsTastatsPer(clients: string[], leads: string[] = []): Promise<Tastos> {
  const idsClients = idsNets(clients);
  const idsLeads = idsNets(leads);
  const [{ files: deClients }, { files: deLeads }] = await Promise.all([
    idsClients.length > 0
      ? llistaAmbTotal<FilaTast>(VINS, {
          camps: ["article", "activitat.data", "activitat.client.id", "activitat.client.nom_comercial"],
          limit: -1,
          condicions: [{ activitat: { client: { _in: idsClients } } }],
        })
      : { files: [] as FilaTast[] },
    idsLeads.length > 0
      ? llistaAmbTotal<FilaTastDeLead>(VINS, {
          camps: ["article", "activitat.data", "activitat.lead.id", "activitat.lead.nom"],
          limit: -1,
          condicions: [{ activitat: { lead: { _in: idsLeads } } }],
        })
      : { files: [] as FilaTastDeLead[] },
  ]);

  const tastos: Tastos = {};
  const apunta = (article: string, id: string, nom: string | null, data: string | null) => {
    const llista = (tastos[article] ??= []);
    const previ = llista.find((tast) => tast.client === id);
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
  return tastos;
}

/**
 * Quins vins ha comprat cada client: de les línies dels albarans de venda
 * (`crm_albarans_linies`, la còpia de FactuSol d'aquest exercici i del
 * passat), per vi, els clients amb la data del darrer albarà i les ampolles
 * en total. Els vins històrics hi compten; les línies que no apunten a cap
 * article (text lliure), no.
 */
export async function vinsCompratsPer(clients: string[]): Promise<Compres> {
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
    const ampolles = Number(fila.quantitat) || 0;
    const previ = llista.find((compra) => compra.client === client.id);
    if (!previ) llista.push({ client: client.id, nom: client.nom_comercial?.trim() || "Sense nom", data, ampolles });
    else {
      previ.ampolles += ampolles;
      if (data && (!previ.data || data > previ.data)) previ.data = data;
    }
  }
  return compres;
}

/** Una activitat d'un dia de visita i el client (o lead) que s'hi veu: per saber a quantes aniran els vins. */
export type ActivitatDelDia = { id: string; client: string };

/**
 * Els clients i leads que es visiten un dia, per al selector de vins: els de
 * les activitats d'aquell dia (el dia d'aquí, no el del servidor), sense
 * repetir. Es miren amb la mateixa visibilitat que l'agenda: les de qui té la
 * sessió oberta, o totes si és administrador. Les activitats que no són de
 * ningú no hi entren: es diu quantes queden fora.
 *
 * També tornen les activitats (id i de qui són), perquè el selector sàpiga a
 * quantes visites anirien els vins de la cistella.
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
export type ResultatVinsALesVisites = {
  /** A quantes activitats s'han posat vins (les que ja els tenien tots també hi compten). */
  activitats: number;
  /** Quantes files de vi s'han creat, sumant totes les activitats. */
  afegits: number;
  /** Activitats on no hi cabien tots: s'hi han posat fins al màxim i prou. */
  plenes: number;
};

/**
 * Posa els vins de la cistella del selector a les activitats d'un dia de
 * visita: a cada activitat dels clients o leads triats, els que encara no
 * tingués (els que ja hi eren es queden; no se'n treu cap). Les activitats es
 * tornen a llegir aquí amb la visibilitat de la sessió, i no es confia en cap
 * id d'activitat del navegador: només hi entren les del dia que veu qui ho
 * demana i que són d'un dels clients o leads donats. Cap activitat passa de
 * `MAXIM_VINS_PER_ACTIVITAT`: si no hi caben tots, s'omple fins al màxim en
 * l'ordre de la cistella i es diu quantes han quedat plenes.
 */
export async function posaVinsALesVisites(
  dia: string,
  comercial: string | null,
  clients: string[],
  articles: string[],
): Promise<ResultatVinsALesVisites> {
  const volguts = [...new Set(articles.filter(Boolean))];
  const triats = new Set(clients);
  const { desde, fins } = margesDelDia(dia);
  const activitats = (await llistaActivitatsEntre(desde, fins, comercial)).filter((activitat) =>
    triats.has(activitat.client?.id ?? activitat.lead?.id ?? ""),
  );
  if (activitats.length === 0 || volguts.length === 0) return { activitats: 0, afegits: 0, plenes: 0 };

  const ids = activitats.map((activitat) => activitat.id);
  const { files } = await llistaAmbTotal<{ activitat: string | null; article: string | null }>(VINS, {
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
    const lloc = Math.max(0, MAXIM_VINS_PER_ACTIVITAT - tenia.size);
    if (falten.length > lloc) plenes += 1;
    for (const article of falten.slice(0, lloc)) noves.push({ activitat: id, article });
  }
  const afegits = await creaItems(VINS, noves);
  return { activitats: ids.length, afegits, plenes };
}
