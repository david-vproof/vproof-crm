/**
 * Sincronització FactuSol → Directus, en una sola direcció.
 *
 * Hi ha quatre taules amb el mateix mecanisme: clients (F_CLI → crm_clients),
 * proveïdors (F_PRO → crm_proveidors), articles (F_ART → crm_articles) i
 * albarans (F_ALB → crm_albarans, i les seves línies de F_LAL a
 * crm_albarans_linies). Cada passada porta la taula sencera de
 * l'ERP, la compara amb Directus per `codi_erp` i només escriu el que ha
 * canviat, per lots. No esborra mai: una fitxa que desapareix de l'ERP queda
 * marcada, i tot el que hi penja es conserva. La lògica de comparació és a
 * `domini/sincronitzacio.ts`; aquí hi ha qui llegeix, qui escriu i quan.
 *
 * Cada passada va amb el seu `Seguiment` (vegeu `sincronitzacio-seguiment.ts`):
 * diu en quina fase és i quant n'ha fet, i és el que la pantalla ensenya en
 * viu. Un lot que Directus no accepta no tomba la passada: es parteix fins a
 * trobar la fila que no val, que queda anotada al registre amb el motiu.
 */
import "server-only";

import { ErrorDirectus } from "@/apis/directus/client";
import {
  actualitzaItem, actualitzaItems, creaItem, creaItems, desaSingleton, llegeixSingleton, llistaAmbTotal, llistaTot, teAccesCrm,
} from "@/apis/directus/crm";
import {
  llistaAgentsPerSincronitzar, llistaAlbaransDExercici, llistaArticlesPerSincronitzar, llistaClientsPerSincronitzar,
  llistaLiniesAlbaraDExercici, llistaProveidorsPerSincronitzar, llistaTipusClientPerSincronitzar,
  llistaEstablimentsPerSincronitzar,
} from "@/apis/factusol";
import { carregaCatalegs } from "@/apis/factusol/catalegs";
import { obtenirCredencials } from "@/apis/factusol/client";
import { reconciliaHerencies } from "@/serveis/crm-manteniment";
import { descriuFacturacio, sincronitzaFacturacio } from "@/serveis/facturacio";
import { senseAbast } from "@/lib/abast-actual";
import { copiaImatgesArticles, descriuImatges } from "@/serveis/imatges-articles";
import { type ProgresPerDesar, Seguiment, enMarxa, estatEnViu } from "@/serveis/sincronitzacio-seguiment";
import {
  type AlbaraErp, type LiniaAlbaraErp, CAMPS_ERP_ALBARA, CAMPS_ERP_LINIA, albaraAdmes, exercicisDAlbarans,
  valorsAlbaraDesDeErp, valorsLiniaDesDeErp,
} from "@/domini/albarans";
import { type UbicacioClient, deduiexComarques } from "@/domini/comarca";
import { CAMPS_ERP_ESTABLIMENT, valorsEstablimentDesDeErp } from "@/domini/establiments";
import { ESTAT_CLIENT_BAIXA } from "@/domini/factusol-vocabulari";
import {
  type CatalegsErp, type ClientErp, type Comptadors, type Desencadenant, type Diferencies, type ErrorCopia, type EstatEnViu,
  type EstatExecucio, type Fase, type FitxaVinculable, type Operacio, type ProgresDesat, type Programacio, type ProveidorErp,
  type SituacioErp, type Taula, type ValorsErp,
  CAMPS_ADRECA, CAMPS_ERP, CAMPS_ERP_AGENT, CAMPS_ERP_ARTICLE, CAMPS_ERP_PROVEIDOR, CAMPS_ERP_TIPUS_CLIENT, COMPTADORS_BUITS,
  FITXA_TAULA, MAXIM_ERRORS_DESATS, MAXIM_FALLITS, NOM_OPERACIO, PROGRAMACIO_PER_DEFECTE, TAULES,
  calculaDiferencies, campsProgramacio, esTaula, estatEnAcabar, llegeixProgramacio, properaExecucio, textEmpremta, tocaExecutar,
  valorsAgentDesDeErp, valorsArticleDesDeErp, valorsDesDeErp, valorsProveidorDesDeErp, valorsTipusClientDesDeErp,
} from "@/domini/sincronitzacio";
import type { Article } from "@/domini/tipus";

export { TAULES, esTaula };
export type { Desencadenant, Taula };

const CONFIGURACIO = "crm_configuracio";
const CLIENTS_COLLECCIO = "crm_clients";
const EXECUCIONS = "crm_sync_execucions";
/** Files per petició a Directus. */
const LOT = 100;
/**
 * Per a les taules que en porten milers, com els albarans i les seves línies.
 * No més: un lot de 500 línies ja va fer esperar Directus més de 30 s.
 */
const LOT_GRAN = 250;
/**
 * Quant pot escriure una passada. Cloud Run talla la petició als 300 s i la
 * passada manual hi corre a dins: passat aquest temps no es comença cap lot
 * més, i el que queda es fa a la passada següent.
 */
const TEMPS_D_ESCRIPTURA_MS = 180_000;
/**
 * Una passada «en curs» més vella que això és d'un procés que va caure: amb el
 * límit de temps d'escriptura, cap passada viva no hi arriba, i Cloud Run
 * talla les peticions als cinc minuts.
 */
const EN_CURS_CADUCA_MS = 6 * 60 * 1000;
/** Quant s'espera abans de tornar a provar un lot que ha fallat per una caiguda passatgera. */
const ESPERA_REINTENT_MS = 1_500;
export const PER_PAGINA_PANELL = 50;

export type Execucio = {
  id: string;
  taula: Taula;
  desencadenant: Desencadenant;
  estat: EstatExecucio;
  inici: string;
  fi: string | null;
  llegits: number | null;
  creats: number | null;
  actualitzats: number | null;
  absents: number | null;
  iguals: number | null;
  missatge: string | null;
  // Els camps nous del registre. Són null si Directus encara no els té.
  /** La fase on és (en curs) o on s'ha quedat (error). */
  fase: Fase | null;
  progres: ProgresDesat | null;
  errors: ErrorCopia[] | null;
  fallits: number | null;
  pendents: number | null;
};

const CAMPS_EXECUCIO_BASE = ["id", "taula", "desencadenant", "estat", "inici", "fi", "llegits", "creats", "actualitzats", "absents", "iguals", "missatge"];
/**
 * Els camps que el seguiment va afegir al registre. Si Directus encara no els
 * té (l'script de provisionament no s'ha tornat a executar), es llegeix i
 * s'escriu sense: la passada no se n'ha de ressentir.
 */
const CAMPS_EXECUCIO_NOUS = ["fase", "progres", "errors", "fallits", "pendents"];

/** Els camps de Directus que la comparació necessita de qualsevol fitxa, a més del títol. */
const CAMPS_VINCLE = ["id", "codi_erp", "font", "erp_empremta", "erp_absent_des_de"];

// ---------------------------------------------------------------- les taules

/** El que informa del progrés a qui mira. Les funcions auxiliars el reben per dir en què són. */
type Informador = Pick<Seguiment, "fase" | "detall" | "avanc" | "errors">;

/**
 * Tot el que distingeix una taula de l'altra. La resta del fitxer no sap si
 * treballa amb clients, amb proveïdors o amb articles.
 */
type Definicio<F> = {
  taula: Taula;
  /** Com se'n parla als missatges: «1466 clients llegits». */
  etiqueta: { singular: string; plural: string };
  /** Taula de FactuSol, per als textos de la pantalla. */
  origen: string;
  colleccio: string;
  /** El camp de Directus que fa de nom de la fitxa: el nom comercial, o el nom als articles. */
  campTitol: string;
  /** Camps de l'ERP que fan l'empremta, en ordre. */
  campsErp: readonly string[];
  /** Camps que cal llegir de Directus per comparar. */
  campsDirectus: string[];
  /** `informa` rep en què s'està, per a les lectures que van a trossos (un exercici darrere l'altre). */
  llegeixErp: (informa?: (detall: string) => void) => Promise<F[]>;
  valors: (fila: F, catalegs: CatalegsErp) => ValorsErp;
  /**
   * Camps que deixen de valer quan es mou l'adreça. Als comptes, les
   * coordenades del mapa; els proveïdors no en tenen.
   */
  buidaAmbAdreca: readonly string[];
  /** El que es posa, a més de la data, a qui desapareix de l'ERP. Si no se'n diu res, estat de baixa. */
  marcaAbsent?: Record<string, unknown>;
  /**
   * Quines files de l'ERP es porten, un cop traduïdes. La resta es tracta com
   * si no hi fossin: als albarans, els de clients que no surten al CRM.
   */
  admet?: (valors: ValorsErp) => boolean;
  /** Files per petició en escriure. Per defecte, `LOT`. */
  lot?: number;
  /** El que cal deixar al dia a Directus abans de la passada: als clients, els seus tipus i els agents. */
  preparacio?: { detall: string; fes: (ara: Date) => Promise<void> };
  /** Les traduccions de codis que surten de Directus i no de l'ERP. */
  referencies?: () => Promise<Partial<CatalegsErp>>;
  /**
   * El que va lligat a la passada i s'hi fa just després: als clients, la
   * comarca i la facturació. Rep el que s'ha escrit i torna un text per al registre.
   */
  despres?: (ara: Date, diferencies: Diferencies, finsA: number, informa: Informador) => Promise<string | null>;
};

const CLIENTS: Definicio<ClientErp> = {
  taula: "clients",
  etiqueta: { singular: "client", plural: "clients" },
  origen: "F_CLI",
  colleccio: "crm_clients",
  campTitol: "nom_comercial",
  campsErp: CAMPS_ERP,
  campsDirectus: [...CAMPS_VINCLE, "nom_comercial", "adreca", "codi_postal", "poblacio", "provincia", "pais"],
  llegeixErp: llistaClientsPerSincronitzar,
  valors: valorsDesDeErp,
  buidaAmbAdreca: ["latitud", "longitud"],
  preparacio: {
    detall: "Tipus de client (F_TCL) i agents (F_AGE)",
    fes: async (ara) => {
      await Promise.all([sincronitzaTipusClient(ara), sincronitzaAgents(ara)]);
    },
  },
  referencies: async () => ({ ...(await idsTipusClient()), ...(await idsAgents()) }),
  // Quan els clients ja estan al dia, la comarca que se'n dedueix, l'agent de
  // les seves activitats, els seus establiments i la seva facturació: cal
  // saber de quina fitxa és cada codi.
  despres: async (ara, diferencies, _finsA, informa) => {
    informa.fase("complements", "Comarca dels clients");
    const comarques = await ompleComarques(diferencies);
    informa.detall("Agent i tipus de client a les activitats");
    const herencies = await recopiaHerencies(diferencies);
    informa.detall("Establiments (F_OBR)");
    const establiments = await sincronitzaEstabliments(ara, informa);
    informa.detall("Facturació (F_FAC i albarans sense facturar de F_ALB)");
    const facturacio = descriuFacturacio(await sincronitzaFacturacio(ara));
    return [comarques, herencies, establiments, facturacio].filter(Boolean).join(" ") || null;
  },
};

const PROVEIDORS: Definicio<ProveidorErp> = {
  taula: "proveidors",
  etiqueta: { singular: "proveïdor", plural: "proveïdors" },
  origen: "F_PRO",
  colleccio: "crm_proveidors",
  campTitol: "nom_comercial",
  campsErp: CAMPS_ERP_PROVEIDOR,
  campsDirectus: [...CAMPS_VINCLE, "nom_comercial"],
  llegeixErp: llistaProveidorsPerSincronitzar,
  valors: valorsProveidorDesDeErp,
  buidaAmbAdreca: [],
};

/**
 * Tot F_ART, també els descatalogats i els que no es poden fer servir: van
 * marcats com a `historic`, i els catàlegs només els ensenyen quan es demanen.
 * Cal tenir-los perquè les línies d'albarà d'un vi que ja no es ven hi puguin
 * apuntar. Un article esborrat de F_ART deixa de venir i queda absent.
 */
const ARTICLES: Definicio<Article> = {
  taula: "articles",
  etiqueta: { singular: "article", plural: "articles" },
  origen: "F_ART",
  colleccio: "crm_articles",
  campTitol: "nom",
  campsErp: CAMPS_ERP_ARTICLE,
  campsDirectus: [...CAMPS_VINCLE, "nom"],
  llegeixErp: llistaArticlesPerSincronitzar,
  valors: valorsArticleDesDeErp,
  buidaAmbAdreca: [],
  marcaAbsent: {},
  // El proveïdor habitual de cada article apunta al celler que ja ha copiat la
  // sincronització de proveïdors.
  referencies: async () => ({ cellers: await idsPerCodi(PROVEIDORS.colleccio) }),
  // Amb els articles al dia, les fotos que han canviat. Si fallen, els articles
  // ja s'han escrit: la passada no es dona per errònia, però el registre ho diu.
  despres: async (_ara, _diferencies, finsA, informa) => {
    informa.fase("complements", "Fotos dels articles: mirant quines han canviat");
    try {
      return descriuImatges(
        await copiaImatgesArticles(finsA, (fetes, total) =>
          informa.avanc(fetes, total, total === 0 ? "Fotos dels articles: cap canvi" : "Fotos dels articles: copiant de FactuSol"),
        ),
      );
    } catch (error) {
      return `Fotos: no s'han pogut copiar (${(error as Error).message}).`;
    }
  },
};

/**
 * Els albarans de venda dels dos darrers exercicis (vegeu `domini/albarans.ts`),
 * només dels clients que surten al CRM. La capçalera és la taula de la
 * passada; les línies van just després, a `sincronitzaLiniesAlbarans`, perquè
 * cadascuna ha d'apuntar al seu albarà ja escrit.
 */
const ALBARANS: Definicio<AlbaraErp> = {
  taula: "albarans",
  etiqueta: { singular: "albarà", plural: "albarans" },
  origen: "F_ALB",
  colleccio: "crm_albarans",
  campTitol: "codi_erp",
  campsErp: CAMPS_ERP_ALBARA,
  campsDirectus: CAMPS_VINCLE,
  llegeixErp: async (informa) => {
    // D'un en un: cada exercici és una base de dades a part. Si un no respon,
    // la passada s'atura: seguir marcaria absents tots els seus albarans.
    const files: AlbaraErp[] = [];
    for (const exercici of exercicisDAlbarans(new Date())) {
      informa?.(`F_ALB de l'exercici ${exercici}`);
      files.push(...(await llistaAlbaransDExercici(exercici)));
    }
    return files.sort(
      (a, b) => String(b.FECALB).localeCompare(String(a.FECALB)) || b.exercici - a.exercici || Number(b.CODALB) - Number(a.CODALB),
    );
  },
  valors: valorsAlbaraDesDeErp,
  admet: albaraAdmes,
  buidaAmbAdreca: [],
  marcaAbsent: {},
  lot: LOT_GRAN,
  referencies: async () => ({ clients: await idsClientsDelCrm() }),
  despres: (ara, diferencies, finsA, informa) => sincronitzaLiniesAlbarans(ara, diferencies, finsA, informa),
};

// ------------------------------------------------------------ programació

/** Tots els camps de programació del singleton, de totes les taules, per llegir-los d'una vegada. */
function totsElsCampsDeProgramacio() {
  return TAULES.flatMap((taula) => Object.values(campsProgramacio(taula)));
}

export async function llegeixProgramacioDe(taula: Taula): Promise<Programacio> {
  const camps = campsProgramacio(taula);
  const brut = await llegeixSingleton<Record<string, unknown>>(CONFIGURACIO, [camps.activa, camps.periodicitat, camps.hora]);
  return llegeixProgramacio(brut, taula);
}

export async function llegeixProgramacions(): Promise<Record<Taula, Programacio>> {
  const brut = await llegeixSingleton<Record<string, unknown>>(CONFIGURACIO, totsElsCampsDeProgramacio());
  return Object.fromEntries(TAULES.map((taula) => [taula, llegeixProgramacio(brut, taula)])) as Record<Taula, Programacio>;
}

function valorsDeProgramacio(taula: Taula, programacio: Programacio) {
  const camps = campsProgramacio(taula);
  return {
    [camps.activa]: programacio.activa,
    [camps.periodicitat]: String(programacio.periodicitatMinuts),
    [camps.hora]: programacio.hora,
  };
}

export async function desaProgramacioDe(taula: Taula, programacio: Programacio) {
  await desaSingleton(CONFIGURACIO, valorsDeProgramacio(taula, programacio));
}

/** Les programacions de totes les taules, en una sola escriptura. */
export async function desaProgramacions(programacions: Record<Taula, Programacio>) {
  await desaSingleton(
    CONFIGURACIO,
    Object.assign({}, ...TAULES.map((taula) => valorsDeProgramacio(taula, programacions[taula]))),
  );
}

// -------------------------------------------------------------- execucions

/**
 * Si Directus té els camps nous del registre. No se sap fins que es prova; si
 * no els té, es torna a provar al cap d'un minut, per si mentrestant algú ha
 * executat l'script. Provar-ho no costa res: és la mateixa lectura, que si
 * falla torna a fer-se sense els camps.
 */
let modelAmpliat: { te: boolean; comprovat: number } | null = null;
const TORNA_A_PROVAR_MODEL_MS = 60_000;

function teModelAmpliat() {
  if (!modelAmpliat) return true;
  if (!modelAmpliat.te && Date.now() - modelAmpliat.comprovat > TORNA_A_PROVAR_MODEL_MS) return true;
  return modelAmpliat.te;
}

/** Si Directus té els camps nous del registre, pel que s'ha vist fins ara. */
export function registreAmpliat() {
  return modelAmpliat?.te ?? true;
}

function esCampNouQueFalta(error: unknown) {
  return error instanceof ErrorDirectus && Boolean(error.camp) && CAMPS_EXECUCIO_NOUS.includes(error.camp!);
}

function senseCampsNous<T extends Record<string, unknown>>(dades: T) {
  return Object.fromEntries(Object.entries(dades).filter(([camp]) => !CAMPS_EXECUCIO_NOUS.includes(camp)));
}

function normalitzaExecucio(brut: Record<string, unknown>): Execucio {
  const errors = Array.isArray(brut.errors) ? (brut.errors as ErrorCopia[]) : null;
  const progres = brut.progres && typeof brut.progres === "object" ? (brut.progres as ProgresDesat) : null;
  return {
    id: String(brut.id),
    taula: brut.taula as Taula,
    desencadenant: (brut.desencadenant as Desencadenant) ?? "manual",
    estat: (brut.estat as EstatExecucio) ?? "error",
    inici: String(brut.inici),
    fi: (brut.fi as string | null) ?? null,
    llegits: numeroONull(brut.llegits),
    creats: numeroONull(brut.creats),
    actualitzats: numeroONull(brut.actualitzats),
    absents: numeroONull(brut.absents),
    iguals: numeroONull(brut.iguals),
    missatge: (brut.missatge as string | null) ?? null,
    fase: (brut.fase as Fase | null) ?? null,
    progres,
    errors,
    fallits: numeroONull(brut.fallits),
    pendents: numeroONull(brut.pendents),
  };
}

function numeroONull(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Les passades registrades, les més noves primer. Amb els camps nous si
 * Directus els té; si no, sense, i se'n pren nota.
 */
async function llegeixExecucions(opcions: { taula?: Taula; limit: number }): Promise<Execucio[]> {
  const ampliat = teModelAmpliat();
  try {
    const { files } = await llistaAmbTotal<Record<string, unknown>>(EXECUCIONS, {
      camps: ampliat ? [...CAMPS_EXECUCIO_BASE, ...CAMPS_EXECUCIO_NOUS] : CAMPS_EXECUCIO_BASE,
      ordre: "-inici",
      limit: opcions.limit,
      ...(opcions.taula ? { filtre: { camp: "taula", valor: opcions.taula } } : {}),
    });
    if (ampliat) modelAmpliat = { te: true, comprovat: Date.now() };
    return files.map(normalitzaExecucio);
  } catch (error) {
    if (ampliat && esCampNouQueFalta(error)) {
      modelAmpliat = { te: false, comprovat: Date.now() };
      return llegeixExecucions(opcions);
    }
    throw error;
  }
}

/** Escriu al registre d'una passada; si Directus no té els camps nous, sense. */
async function escriuExecucio(id: string, dades: Record<string, unknown>) {
  const ampliat = teModelAmpliat();
  try {
    await actualitzaItem(EXECUCIONS, id, ampliat ? dades : senseCampsNous(dades));
    if (ampliat) modelAmpliat = { te: true, comprovat: Date.now() };
  } catch (error) {
    if (ampliat && esCampNouQueFalta(error)) {
      modelAmpliat = { te: false, comprovat: Date.now() };
      await actualitzaItem(EXECUCIONS, id, senseCampsNous(dades));
      return;
    }
    throw error;
  }
}

export async function historialExecucions(taula: Taula, limit = 10): Promise<Execucio[]> {
  return llegeixExecucions({ taula, limit });
}

/** Les darreres passades de totes les taules, barrejades, per a la pantalla global. */
export async function historialGlobal(limit = 15): Promise<Execucio[]> {
  return llegeixExecucions({ limit });
}

/** Si una passada «en curs» del registre és d'un procés que va caure. */
function haCaducat(execucio: Execucio, ara = Date.now()) {
  return execucio.estat === "en_curs" && ara - Date.parse(execucio.inici) >= EN_CURS_CADUCA_MS;
}

/** La darrera passada que compta per a la programació: una «en curs» caducada no. */
function darreraAcabada(historial: Execucio[], ara: Date): Execucio | null {
  return historial.find((e) => !haCaducat(e, ara.getTime())) ?? null;
}

function instantDe(execucio: Execucio | null) {
  if (!execucio) return null;
  return new Date(execucio.fi ?? execucio.inici);
}

/**
 * La passada d'una taula que, segons el registre, encara és en marxa (en
 * aquest procés o en un altre). Si fa massa que dura, és que va caure i no
 * compta.
 */
export async function execucioEnCurs(taula: Taula): Promise<Execucio | null> {
  const [darrera] = await historialExecucions(taula, 1);
  if (!darrera || darrera.estat !== "en_curs" || haCaducat(darrera)) return null;
  return darrera;
}

/**
 * L'estat en viu que es pot reconstruir d'un registre, quan la passada corre
 * en una altra instància i aquí no se'n té la memòria. Hi falta el detall fi,
 * però diu la fase, el progrés i quan va dir res per darrer cop.
 */
export function estatDesDeRegistre(execucio: Execucio): EstatEnViu {
  const comptadors: Comptadors = {
    ...COMPTADORS_BUITS,
    llegits: execucio.llegits ?? 0,
    creats: execucio.creats ?? 0,
    actualitzats: execucio.actualitzats ?? 0,
    absents: execucio.absents ?? 0,
    iguals: execucio.iguals ?? 0,
    fallits: execucio.fallits ?? 0,
    pendents: execucio.pendents ?? 0,
  };
  return {
    id: execucio.id,
    taula: execucio.taula,
    desencadenant: execucio.desencadenant,
    inici: execucio.inici,
    fase: execucio.fase ?? "lectura",
    detall: execucio.progres?.detall ?? null,
    fets: execucio.progres?.fets ?? null,
    total: execucio.progres?.total ?? null,
    comptadors,
    errors: execucio.errors ?? [],
    actualitzatEl: execucio.progres?.actualitzat_el ?? execucio.inici,
    final:
      execucio.estat === "en_curs"
        ? null
        : { estat: execucio.estat, missatge: execucio.missatge ?? "", fi: execucio.fi ?? execucio.inici },
  };
}

// ------------------------------------------------------------------- foto

type Foto<F> = {
  erp: { fila: F; valors: ValorsErp; empremta: string }[];
  directus: FitxaVinculable[];
  diferencies: Diferencies;
};

/** Web Crypto i no node:crypto: el fitxer també s'empaqueta per al runtime edge. */
async function empremta(text: string) {
  const resum = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(resum).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Una lectura sencera de les dues bandes i el que caldria fer per igualar-les.
 * Les quatre fonts es llegeixen alhora; el seguiment diu quines falten.
 */
async function fesFoto<F>(def: Definicio<F>, ara: Date, informa?: Informador): Promise<Foto<F>> {
  const fonts = new Map<string, string>([
    ["erp", `FactuSol (${def.origen})`],
    ["catalegs", "catàlegs de FactuSol"],
    ["directus", `Directus (${def.colleccio})`],
    ...(def.referencies ? ([["referencies", "referències de Directus"]] as [string, string][]) : []),
  ]);
  const total = fonts.size;
  const esperant = () => (fonts.size > 0 ? `Esperant ${[...fonts.values()].join(", ")}` : null);
  informa?.fase("lectura", esperant());
  const feta = <T,>(clau: string) => (resultat: T) => {
    fonts.delete(clau);
    informa?.avanc(total - fonts.size, total, esperant());
    return resultat;
  };

  const [files, catalegs, directus, referencies] = await Promise.all([
    def.llegeixErp((detall) => {
      fonts.set("erp", `FactuSol (${detall})`);
      informa?.detall(esperant());
    }).then(feta("erp")),
    carregaCatalegs().then(feta("catalegs")),
    llistaTot<FitxaVinculable>(def.colleccio, def.campsDirectus).then(feta("directus")),
    (def.referencies?.() ?? Promise.resolve({})).then(feta("referencies")),
  ]);
  const traduccions: CatalegsErp = {
    formesPagament: catalegs.formesPagament, families: catalegs.families, tipusClient: {}, agents: {}, cellers: {}, clients: {},
    ...referencies,
  };

  informa?.fase("comparacio", `${files.length} files de ${def.origen} amb ${directus.length} fitxes de ${def.colleccio}`);
  const traduides = files.map((fila) => ({ fila, valors: def.valors(fila, traduccions) }));
  const admeses = def.admet ? traduides.filter(({ valors }) => def.admet!(valors)) : traduides;
  const erp = await Promise.all(
    admeses.map(async ({ fila, valors }) => ({ fila, valors, empremta: await empremta(textEmpremta(valors, def.campsErp)) })),
  );

  return { erp, directus, diferencies: calculaDiferencies(erp, directus, ara, def.buidaAmbAdreca, def.marcaAbsent) };
}

// ------------------------------------------------------------- escriptura

/** Pel nom de la fitxa a l'error, quan la fila només porta l'id de Directus. */
type NomsPerId = Map<string, { codi: string; nom: string }>;

function nomsDe(directus: FitxaVinculable[], campTitol: string): NomsPerId {
  return new Map(
    directus.map((fitxa) => [fitxa.id, { codi: String(fitxa.codi_erp ?? fitxa.id), nom: String(fitxa[campTitol] ?? "") }]),
  );
}

/** Una caiguda passatgera: la xarxa, o Directus que respon 5xx. Val la pena tornar-ho a provar un cop. */
function esTransitori(error: unknown) {
  return error instanceof ErrorDirectus && (error.motiu === "xarxa" || (error.motiu === "servei" && (error.estat ?? 0) >= 500));
}

/**
 * Un error de les dades i no del servei: Directus ha respost 4xx a un lot.
 * Alguna fila no val (una validació, una relació a una fitxa que no hi és), i
 * partint el lot es troba quina. Un 401/403 no hi entra: això és de permisos,
 * i no se solucionaria fila a fila.
 */
function esErrorDeDades(error: unknown) {
  return error instanceof ErrorDirectus && error.motiu === "servei" && (error.estat ?? 0) >= 400 && (error.estat ?? 0) < 500;
}

const espera = (ms: number) => new Promise<void>((resol) => setTimeout(resol, ms));

async function ambReintent<T>(feina: () => Promise<T>): Promise<T> {
  try {
    return await feina();
  } catch (error) {
    if (!esTransitori(error)) throw error;
    await espera(ESPERA_REINTENT_MS);
    return feina();
  }
}

/**
 * Escriu un lot. Si Directus no l'accepta per les dades, el parteix per la
 * meitat i torna a provar cada tros, fins a aïllar les files que no valen,
 * que torna com a errors. Directus escriu cada lot dins d'una transacció, així
 * que un lot que falla no ha deixat res escrit i es pot tornar a enviar.
 * Qualsevol altre error (permisos, model, el servei caigut després d'un
 * reintent) atura la passada.
 */
async function escriuLot<T>(
  lot: T[],
  escriu: (lot: T[]) => Promise<unknown>,
  descriu: (fila: T) => Omit<ErrorCopia, "motiu">,
): Promise<ErrorCopia[]> {
  try {
    await ambReintent(() => escriu(lot));
    return [];
  } catch (error) {
    if (!esErrorDeDades(error)) throw error;
    if (lot.length === 1) return [{ ...descriu(lot[0]), motiu: (error as Error).message }];
    const meitat = Math.ceil(lot.length / 2);
    return [...(await escriuLot(lot.slice(0, meitat), escriu, descriu)), ...(await escriuLot(lot.slice(meitat), escriu, descriu))];
  }
}

type Escrit = { creats: number; actualitzats: number; absents: number; pendents: number; errors: ErrorCopia[] };

/**
 * Escriu a Directus el que cal per igualar-lo amb l'ERP, per lots de `mida`.
 * Passat `finsA` (un instant en ms) no comença cap lot més, i torna quantes
 * files han quedat per a la passada següent: les que falten encara hi sortiran
 * com a diferència. Les files que Directus no accepta tornen a `errors`, amb
 * el nom que els dona `noms` o el `campTitol` de la fila.
 */
async function aplicaDiferencies(
  colleccio: string,
  diferencies: Diferencies,
  opcions: {
    mida?: number;
    finsA?: number;
    campTitol?: string;
    noms?: NomsPerId;
    /** La col·lecció, si cal dir-la a l'error: només quan no és la de la taula. */
    anotaColleccio?: boolean;
    /** A cada lot: què s'està fent, quantes files van de quantes, i el que ja s'ha escrit. */
    informa?: (operacio: Operacio, fets: number, total: number, escrit: Omit<Escrit, "pendents" | "errors"> & { fallits: number }) => void;
  } = {},
): Promise<Escrit> {
  const { mida = LOT, finsA = Infinity, campTitol = "codi_erp", noms, informa } = opcions;
  const fet = { creats: 0, actualitzats: 0, absents: 0 };
  const errors: ErrorCopia[] = [];
  const total = diferencies.crear.length + diferencies.actualitzar.length + diferencies.absents.length;
  const colleccioALError = opcions.anotaColleccio ? { colleccio } : {};

  const perLotsATemps = async <T,>(
    files: T[],
    escriu: (lot: T[]) => Promise<unknown>,
    descriu: (fila: T) => Omit<ErrorCopia, "motiu">,
    operacio: Operacio,
    compta: keyof typeof fet,
  ) => {
    for (let i = 0; i < files.length && Date.now() < finsA; i += mida) {
      const lot = files.slice(i, i + mida);
      const fallades = await escriuLot(lot, escriu, descriu);
      errors.push(...fallades);
      fet[compta] += lot.length - fallades.length;
      informa?.(operacio, fet.creats + fet.actualitzats + fet.absents + errors.length, total, { ...fet, fallits: errors.length });
      if (errors.length > MAXIM_FALLITS) {
        throw new Error(
          `Directus ha rebutjat més de ${MAXIM_FALLITS} files: no sembla cosa de les dades sinó del servei o del model. ` +
            `La primera: ${errors[0].codi} (${errors[0].motiu}).`,
        );
      }
    }
  };

  const nomDe = (id: string, dades?: Record<string, unknown>) => {
    const conegut = noms?.get(id);
    return {
      codi: String(dades?.codi_erp ?? conegut?.codi ?? id),
      nom: String(dades?.[campTitol] ?? conegut?.nom ?? ""),
    };
  };

  // Res a escriure: no cal dir-ho. Si n'hi ha, la barra comença a zero.
  if (total > 0) informa?.("crear", 0, total, { ...fet, fallits: 0 });
  await perLotsATemps(
    diferencies.crear,
    (lot) => creaItems(colleccio, lot),
    (fila) => ({ codi: String(fila.codi_erp ?? ""), nom: String(fila[campTitol] ?? ""), operacio: "crear", ...colleccioALError }),
    "crear",
    "creats",
  );
  await perLotsATemps(
    diferencies.actualitzar,
    (lot) => actualitzaItems(colleccio, lot.map(({ id, dades }) => ({ id, ...dades }))),
    ({ id, dades }) => ({ ...nomDe(id, dades), operacio: "actualitzar", ...colleccioALError }),
    "actualitzar",
    "actualitzats",
  );
  await perLotsATemps(
    diferencies.absents,
    (lot) => actualitzaItems(colleccio, lot.map(({ id, dades }) => ({ id, ...dades }))),
    ({ id }) => ({ ...nomDe(id), operacio: "absent", ...colleccioALError }),
    "absent",
    "absents",
  );
  // Poques i petites: sempre.
  await perLots(diferencies.normalitzar, (lot) => actualitzaItems(colleccio, lot.map((id) => ({ id, font: "portal" }))));

  return {
    ...fet,
    errors,
    pendents: total - (fet.creats + fet.actualitzats + fet.absents + errors.length),
  };
}

/** Les files de l'ERP ja traduïdes, amb l'empremta de cadascuna. */
function ambEmpremtes(valors: ValorsErp[], camps: readonly string[]) {
  return Promise.all(valors.map(async (fila) => ({ valors: fila, empremta: await empremta(textEmpremta(fila, camps)) })));
}

// ------------------------------------------ catàlegs: tipus de client i agents

const COLLECCIO_TIPUS_CLIENT = "crm_tipus_client";
const COLLECCIO_AGENTS = "crm_agents";

/**
 * Una taula petita de l'ERP copiada sencera a Directus. No té passada pròpia:
 * va al davant de cada passada de clients, perquè cada client pugui apuntar al
 * seu tipus i al seu agent com ho fa a FactuSol. El mecanisme és el mateix: es
 * lliga pel codi, només s'escriu el que canvia i el que desapareix de l'ERP no
 * s'esborra. Una fila que no s'accepti atura la passada: sense el catàleg
 * sencer, els clients apuntarien malament.
 */
async function sincronitzaCataleg<F>(
  colleccio: string,
  files: F[],
  valors: (fila: F) => ValorsErp,
  camps: readonly string[],
  ara: Date,
) {
  const directus = await llistaTot<FitxaVinculable>(colleccio, CAMPS_VINCLE);
  const erp = await ambEmpremtes(files.map(valors), camps);
  const escrit = await aplicaDiferencies(colleccio, calculaDiferencies(erp, directus, ara, [], {}), { campTitol: "nom" });
  if (escrit.errors.length > 0) {
    throw new Error(`${colleccio}: Directus no ha acceptat ${escrit.errors[0].codi} (${escrit.errors[0].motiu}).`);
  }
}

/** De cada codi de l'ERP, l'id de la seva fitxa a Directus. */
async function idsPerCodi(colleccio: string): Promise<Record<string, string>> {
  const files = await llistaTot<{ id: string; codi_erp: number | null }>(colleccio, ["id", "codi_erp"]);
  return Object.fromEntries(
    files.filter((fila) => fila.codi_erp !== null && fila.codi_erp !== undefined).map((fila) => [String(fila.codi_erp), fila.id]),
  );
}

/** F_TCL → crm_tipus_client. */
async function sincronitzaTipusClient(ara: Date) {
  await sincronitzaCataleg(
    COLLECCIO_TIPUS_CLIENT, await llistaTipusClientPerSincronitzar(), valorsTipusClientDesDeErp, CAMPS_ERP_TIPUS_CLIENT, ara,
  );
}

/** F_AGE → crm_agents. Cada usuari del portal hi pot quedar lligat des de la pantalla d'Usuaris. */
async function sincronitzaAgents(ara: Date) {
  await sincronitzaCataleg(COLLECCIO_AGENTS, await llistaAgentsPerSincronitzar(), valorsAgentDesDeErp, CAMPS_ERP_AGENT, ara);
}

/**
 * De cada codi de client, l'id de la seva fitxa, però només dels que surten al
 * CRM: ni els de baixa ni els que ja no són a l'ERP (vegeu la facturació).
 */
async function idsClientsDelCrm(): Promise<Record<string, string>> {
  const clients = await llistaTot<{ id: string; codi_erp: number | null; estat: string | null; erp_absent_des_de: string | null }>(
    CLIENTS.colleccio,
    ["id", "codi_erp", "estat", "erp_absent_des_de"],
  );
  return Object.fromEntries(
    clients
      .filter((client) => client.codi_erp !== null && !client.erp_absent_des_de && client.estat !== ESTAT_CLIENT_BAIXA.valor)
      .map((client) => [String(client.codi_erp), client.id]),
  );
}

async function idsTipusClient(): Promise<Pick<CatalegsErp, "tipusClient">> {
  return { tipusClient: await idsPerCodi(COLLECCIO_TIPUS_CLIENT) };
}

async function idsAgents(): Promise<Pick<CatalegsErp, "agents">> {
  return { agents: await idsPerCodi(COLLECCIO_AGENTS) };
}

// ------------------------------------------------------- línies d'albarà

const LINIES_ALBARA = "crm_albarans_linies";

/**
 * F_LAL → crm_albarans_linies, amb el mateix mecanisme que la resta. Cada línia
 * apunta al seu albarà i, si és d'un article actiu, a l'article. Les línies
 * d'un albarà que la passada no porta (d'un client que no surt al CRM) queden
 * fora, i si ja hi eren, absents.
 */
async function sincronitzaLiniesAlbarans(ara: Date, diferencies: Diferencies, finsA: number, informa: Informador): Promise<string> {
  // Si a les capçaleres ja se'ls ha acabat el temps, les línies esperen: sense
  // albarà escrit no tenen on penjar.
  if (Date.now() >= finsA) return "Línies: a la propera passada, quan hi hagi tots els albarans.";

  informa.fase("complements", "Línies d'albarà: llegint F_LAL");
  const files: LiniaAlbaraErp[] = [];
  for (const exercici of exercicisDAlbarans(ara)) {
    informa.detall(`Línies d'albarà: llegint F_LAL de l'exercici ${exercici}`);
    files.push(...(await llistaLiniesAlbaraDExercici(exercici)));
  }

  informa.detall(`Línies d'albarà: llegint ${LINIES_ALBARA}`);
  const [idsAlbarans, articles, directus] = await Promise.all([
    idsPerCodi(ALBARANS.colleccio),
    idsPerCodi(ARTICLES.colleccio),
    llistaTot<FitxaVinculable>(LINIES_ALBARA, CAMPS_VINCLE),
  ]);
  // Els albarans que aquesta passada ha portat, ja amb id de Directus.
  const albarans = new Map(
    [...diferencies.situacio.keys()].filter((codi) => idsAlbarans[codi]).map((codi) => [codi, idsAlbarans[codi]]),
  );

  informa.detall(`Línies d'albarà: comparant ${files.length} línies`);
  const valors = files
    .map((fila) => valorsLiniaDesDeErp(fila, albarans, articles))
    .filter((fila): fila is ValorsErp => fila !== null);
  const erp = await ambEmpremtes(valors, CAMPS_ERP_LINIA);
  const canvis = calculaDiferencies(erp, directus, ara, [], {});
  const escrit = await aplicaDiferencies(LINIES_ALBARA, canvis, {
    mida: LOT_GRAN,
    finsA,
    anotaColleccio: true,
    informa: (operacio, fets, total) => informa.avanc(fets, total, `Línies d'albarà: ${minuscula(NOM_OPERACIO[operacio])}`),
  });
  informa.errors(escrit.errors);

  return (
    `Línies: ${erp.length} llegides, ${escrit.creats} creades, ${escrit.actualitzats} actualitzades, ` +
    `${escrit.absents} marcades absents i ${canvis.iguals} sense canvis.` +
    (escrit.errors.length ? ` ${escrit.errors.length} no s'han pogut copiar.` : "") +
    (escrit.pendents ? ` En queden ${escrit.pendents} per a la propera passada.` : "")
  );
}

// ------------------------------------------------- agent de les activitats

/**
 * Si FactuSol ha canviat l'agent o el tipus d'algun client, les seves
 * activitats i oportunitats, que en porten una còpia, se n'assabenten (vegeu
 * `reconciliaHerencies`). Com els establiments, si falla no tomba la passada.
 */
async function recopiaHerencies(diferencies: Diferencies): Promise<string | null> {
  if (diferencies.actualitzar.length === 0) return null;
  try {
    const canviades = await reconciliaHerencies("clients");
    return canviades > 0 ? `Agent o tipus de client posat al dia a ${canviades} activitats i oportunitats.` : null;
  } catch (error) {
    return `Agent de les activitats: no s'ha pogut posar al dia (${(error as Error).message}).`;
  }
}

// ----------------------------------------------------------- establiments

const ESTABLIMENTS = "crm_establiments";

/**
 * F_OBR → crm_establiments: les direccions d'entrega de cada client, que a la
 * casa són els seus establiments (vegeu `domini/establiments.ts`). Va dins de
 * la passada de clients, just després, perquè cada establiment ha d'apuntar al
 * seu client ja escrit. Només es porten els dels clients que surten al CRM: els
 * d'un client que passa a baixa queden absents. Si en canvia l'adreça, el punt
 * del mapa es buida i la ubicació en segon pla el torna a calcular.
 *
 * Si falla, els clients ja s'han escrit: la passada no es dona per errònia,
 * però el registre ho diu. És el cas, per exemple, si encara no s'ha creat la
 * col·lecció a Directus.
 */
async function sincronitzaEstabliments(ara: Date, informa: Informador): Promise<string> {
  try {
    const [files, clients, directus] = await Promise.all([
      llistaEstablimentsPerSincronitzar(),
      idsClientsDelCrm(),
      llistaTot<FitxaVinculable>(ESTABLIMENTS, [...CAMPS_VINCLE, ...CAMPS_ADRECA]),
    ]);
    const valors = files
      .map((fila) => valorsEstablimentDesDeErp(fila, clients))
      .filter((fila): fila is ValorsErp => fila !== null);
    const erp = await ambEmpremtes(valors, CAMPS_ERP_ESTABLIMENT);
    const canvis = calculaDiferencies(erp, directus, ara, ["latitud", "longitud"], {});
    const escrit = await aplicaDiferencies(ESTABLIMENTS, canvis, {
      campTitol: "nom",
      anotaColleccio: true,
      informa: (operacio, fets, total) => informa.avanc(fets, total, `Establiments: ${minuscula(NOM_OPERACIO[operacio])}`),
    });
    informa.errors(escrit.errors);
    return (
      `Establiments: ${erp.length} llegits, ${escrit.creats} creats, ${escrit.actualitzats} actualitzats, ` +
      `${escrit.absents} marcats absents i ${canvis.iguals} sense canvis.` +
      (escrit.errors.length ? ` ${escrit.errors.length} no s'han pogut copiar.` : "")
    );
  } catch (error) {
    return `Establiments: no s'han pogut copiar (${(error as Error).message}).`;
  }
}

// ---------------------------------------------------------------- comarca

/**
 * Posa la comarca que es dedueix de l'adreça (vegeu `domini/comarca.ts`).
 *
 * La comarca és un camp del CRM i es pot corregir a mà, així que només
 * s'escriu on és buida o on l'adreça acaba de canviar en aquesta passada. Una
 * adreça canviada es reconeix perquè la comparació hi ha buidat les
 * coordenades. On no se'n pot deduir cap, no es toca.
 */
async function ompleComarques(diferencies: Diferencies): Promise<string | null> {
  const adrecaNova = new Set(diferencies.actualitzar.filter(({ dades }) => "latitud" in dades).map(({ id }) => id));
  const clients = await llistaTot<UbicacioClient & { comarca: string | null }>(
    CLIENTS_COLLECCIO,
    ["id", "poblacio", "codi_postal", "provincia", "latitud", "longitud", "comarca"],
  );
  const deduides = deduiexComarques(clients);

  const canvis = clients.flatMap((client) => {
    const comarca = deduides.get(client.id);
    if (!comarca || comarca === client.comarca) return [];
    if (client.comarca && !adrecaNova.has(client.id)) return [];
    return [{ id: client.id, comarca }];
  });
  await perLots(canvis, (lot) => actualitzaItems(CLIENTS_COLLECCIO, lot));
  return canvis.length > 0 ? `Comarca posada a ${canvis.length} ${canvis.length === 1 ? "client" : "clients"}.` : null;
}

// ---------------------------------------------------------------- passada

export type ResultatSincronitzacio = Comptadors & {
  correcte: boolean;
  /** Com ha quedat al registre. «error» si no s'ha arribat a registrar. */
  estat: Exclude<EstatExecucio, "en_curs">;
  missatge: string;
  /** L'id del registre a Directus, si s'ha creat. */
  id: string | null;
  /** No s'ha fet res perquè ja n'hi havia una en marxa: val la pena enganxar-s'hi. */
  jaEnMarxa?: boolean;
};

export function sincronitzacioEnCurs(taula: Taula) {
  return enMarxa(taula);
}

/** L'estat en viu d'una passada en aquest procés, si n'hi ha. */
export function seguimentDe(taula: Taula): EstatEnViu | null {
  return estatEnViu(taula);
}

async function perLots<T>(files: T[], escriu: (lot: T[]) => Promise<unknown>, mida = LOT) {
  for (let i = 0; i < files.length; i += mida) await escriu(files.slice(i, i + mida));
}

/** «Creant les fitxes noves» → «creant les fitxes noves», sense tocar les sigles de dins. */
function minuscula(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** «de clients», però «d'articles». */
function de(paraula: string) {
  return /^[aeiouàèéíïòóúüh]/i.test(paraula) ? `d'${paraula}` : `de ${paraula}`;
}

/**
 * La passada sencera. Es registra a Directus abans de començar, perquè una
 * caiguda a mig camí quedi vista, i es tanca amb els comptadors o l'error.
 */
export function sincronitza(taula: Taula, desencadenant: Desencadenant): Promise<ResultatSincronitzacio> {
  // Veient-ho tot, sigui qui sigui qui la demana: filtrada per l'abast d'un comercial, donaria per absents els clients que ell no veu.
  return senseAbast(() => {
    if (taula === "clients") return passada(CLIENTS, desencadenant);
    if (taula === "proveidors") return passada(PROVEIDORS, desencadenant);
    if (taula === "articles") return passada(ARTICLES, desencadenant);
    return passada(ALBARANS, desencadenant);
  });
}

function fallada(missatge: string, extra: Partial<ResultatSincronitzacio> = {}): ResultatSincronitzacio {
  return { ...COMPTADORS_BUITS, correcte: false, estat: "error", missatge, id: null, ...extra };
}

async function passada<F>(def: Definicio<F>, desencadenant: Desencadenant): Promise<ResultatSincronitzacio> {
  const taula = def.taula;
  if (!obtenirCredencials()) return fallada("Falten les credencials de FactuSol a l'entorn del servei.");
  if (!teAccesCrm()) return fallada("Falten DIRECTUS_URL o DIRECTUS_TOKEN.");
  if (enMarxa(taula)) return fallada(`Ja hi ha una sincronització ${de(def.etiqueta.plural)} en marxa.`, { jaEnMarxa: true });

  // El seguiment es publica de seguida: dues peticions alhora no poden passar
  // totes dues d'aquí. El registre de Directus s'escriu quan hi ha id.
  let idExecucio = "";
  const seguiment = new Seguiment(taula, desencadenant, (progres: ProgresPerDesar) =>
    idExecucio ? escriuExecucio(idExecucio, progres) : Promise.resolve(),
  );

  // Aquest bloqueig només val dins d'aquest procés, i Cloud Run en pot tenir
  // més d'un: el registre de Directus és el que veuen tots.
  let enMarxaAltrove: Execucio | null;
  try {
    enMarxaAltrove = await tancaInterrompudes(taula);
  } catch (error) {
    seguiment.acaba({ estat: "error", missatge: (error as Error).message, fi: new Date().toISOString() });
    return fallada((error as Error).message);
  }
  if (enMarxaAltrove) {
    // No ha començat res: fora de la memòria, que qui s'hi enganxi trobi la de l'altra instància.
    seguiment.descarta();
    const missatge = `Ja hi ha una sincronització ${de(def.etiqueta.plural)} en marxa des de les ${horaLocal(enMarxaAltrove.inici)}.`;
    return fallada(missatge, { jaEnMarxa: true, id: enMarxaAltrove.id });
  }

  const ara = new Date();
  const finsA = ara.getTime() + TEMPS_D_ESCRIPTURA_MS;

  try {
    idExecucio = await creaItem(EXECUCIONS, { taula, desencadenant, estat: "en_curs", inici: ara.toISOString() });
    seguiment.registra(idExecucio);

    if (def.preparacio) {
      seguiment.fase("preparacio", def.preparacio.detall);
      await def.preparacio.fes(ara);
    }

    const { erp, directus, diferencies } = await fesFoto(def, ara, seguiment);
    seguiment.comptadors({ llegits: erp.length, iguals: diferencies.iguals });

    seguiment.fase("escriptura");
    const escrit = await aplicaDiferencies(def.colleccio, diferencies, {
      mida: def.lot,
      finsA,
      campTitol: def.campTitol,
      noms: nomsDe(directus, def.campTitol),
      informa: (operacio, fets, total, parcial) => {
        seguiment.avanc(fets, total, NOM_OPERACIO[operacio]);
        // Els comptadors avancen amb cada lot; els fallits els posa `errors` al final, amb el detall.
        seguiment.comptadors({ creats: parcial.creats, actualitzats: parcial.actualitzats, absents: parcial.absents });
      },
    });
    seguiment.errors(escrit.errors);
    seguiment.comptadors({ creats: escrit.creats, actualitzats: escrit.actualitzats, absents: escrit.absents, pendents: escrit.pendents });

    const despres = def.despres ? await def.despres(ara, diferencies, finsA, seguiment) : null;

    seguiment.fase("tancament");
    const { comptadors, errors } = seguiment.estat;
    const avisos =
      [
        comptadors.pendents
          ? `S'ha acabat el temps de la passada: en queden ${comptadors.pendents} per escriure, que es faran a la propera.`
          : null,
        diferencies.duplicats.length
          ? `Codis d'ERP repetits a Directus (només s'ha mantingut el primer): ${diferencies.duplicats.join(", ")}.`
          : null,
        despres,
      ]
        .filter(Boolean)
        .join(" ") || null;
    const estat = estatEnAcabar(comptadors.fallits);
    const fi = new Date().toISOString();

    await seguiment.esgota();
    await escriuExecucio(idExecucio, {
      estat,
      fi,
      llegits: comptadors.llegits,
      creats: comptadors.creats,
      actualitzats: comptadors.actualitzats,
      absents: comptadors.absents,
      iguals: comptadors.iguals,
      fallits: comptadors.fallits,
      pendents: comptadors.pendents,
      errors: errors.slice(0, MAXIM_ERRORS_DESATS),
      missatge: avisos,
      fase: null,
      progres: null,
    });

    const missatge =
      `${comptadors.llegits} fitxes llegides: ${comptadors.creats} creades, ${comptadors.actualitzats} actualitzades, ` +
      `${comptadors.absents} marcades absents i ${comptadors.iguals} sense canvis.` +
      (comptadors.fallits ? ` ${comptadors.fallits} no s'han pogut copiar: Directus no les ha acceptat.` : "") +
      (avisos ? ` ${avisos}` : "");
    seguiment.acaba({ estat, missatge, fi });
    return { ...comptadors, correcte: true, estat, missatge, id: idExecucio };
  } catch (error) {
    const missatge = (error as Error).message;
    const fi = new Date().toISOString();
    const { fase, detall, fets, total, comptadors, errors, actualitzatEl } = seguiment.estat;
    await seguiment.esgota();
    seguiment.acaba({ estat: "error", missatge, fi });
    if (idExecucio) {
      // La fase i el progrés es queden tal com eren: diuen on ha caigut.
      await escriuExecucio(idExecucio, {
        estat: "error",
        fi,
        missatge,
        fase,
        progres: { detall, fets, total, actualitzat_el: actualitzatEl },
        llegits: comptadors.llegits || null,
        fallits: comptadors.fallits,
        errors: errors.slice(0, MAXIM_ERRORS_DESATS),
      }).catch(() => undefined);
    }
    return { ...comptadors, correcte: false, estat: "error", missatge, id: idExecucio || null };
  }
}

/**
 * Les passades d'aquesta taula que el registre dona per «en curs». Les que ja
 * han passat de l'hora les va tallar Cloud Run sense deixar-les tancar: es
 * tanquen com a interrompudes perquè l'historial no enganyi, dient on s'havien
 * quedat. Si n'hi ha una de viva, es torna: és d'una altra instància i no se
 * n'ha de començar cap altra.
 */
async function tancaInterrompudes(taula: Taula): Promise<Execucio | null> {
  const obertes = (await historialExecucions(taula, 10)).filter((execucio) => execucio.estat === "en_curs");
  const viva = obertes.find((execucio) => !haCaducat(execucio)) ?? null;
  const caigudes = obertes.filter((execucio) => execucio !== viva);
  await Promise.all(
    caigudes.map((execucio) =>
      escriuExecucio(execucio.id, {
        estat: "error",
        fi: new Date().toISOString(),
        missatge:
          "Interrompuda: no va acabar a temps i el servidor la va tallar. El que ja havia escrit s'hi queda." +
          (execucio.progres?.detall ? ` S'havia quedat a: ${execucio.progres.detall}.` : ""),
      }).catch(() => undefined),
    ),
  );
  return viva;
}

/** L'hora local de la bodega d'un instant, per als missatges. */
function horaLocal(iso: string) {
  return new Intl.DateTimeFormat("ca-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** El que crida el programador cada minut: mira totes les taules, una per una. */
export async function executaSiToca(ara = new Date()): Promise<{ taula: Taula; resultat: ResultatSincronitzacio }[]> {
  if (!teAccesCrm() || !obtenirCredencials()) return [];

  const programacions = await llegeixProgramacions();
  const fetes: { taula: Taula; resultat: ResultatSincronitzacio }[] = [];
  for (const taula of TAULES) {
    const programacio = programacions[taula];
    if (!programacio.activa) continue;

    const historial = await historialExecucions(taula, 5);
    const darrera = darreraAcabada(historial, ara);
    if (darrera?.estat === "en_curs" || !tocaExecutar(programacio, instantDe(darrera), ara)) continue;

    fetes.push({ taula, resultat: await sincronitza(taula, "programada") });
  }
  return fetes;
}

// ----------------------------------------------------------------- panell

type LlistaErp<F> = { files: F[]; total: number; pagina: number; perPagina: number; exercici: string };

/** Com està cada taula, per a la pantalla global: sense llegir l'ERP, que és el que triga. */
export type ResumTaula = {
  taula: Taula;
  programacio: Programacio;
  darrera: Execucio | null;
  propera: string | null;
  /** En marxa, aquí o en una altra instància. */
  enCurs: boolean;
};

export type PanellGlobal = {
  /** Directus encara no té el model de la sincronització: cal executar l'script. */
  avisDirectus: string | null;
  /** Directus té els camps nous del registre (fase, progrés, errors). Si no, el seguiment és més curt. */
  registreAmpliat: boolean;
  taules: ResumTaula[];
  historial: Execucio[];
};

export async function panellGlobal(): Promise<PanellGlobal> {
  const ara = new Date();
  try {
    const [programacions, historial, ...darreres] = await Promise.all([
      llegeixProgramacions(),
      historialGlobal(15),
      ...TAULES.map((taula) => historialExecucions(taula, 5)),
    ]);
    return {
      avisDirectus: null,
      registreAmpliat: registreAmpliat(),
      historial,
      taules: TAULES.map((taula, i) => {
        const propies = darreres[i];
        const darrera = propies[0] ?? null;
        const propera = properaExecucio(programacions[taula], instantDe(darreraAcabada(propies, ara)), ara);
        return {
          taula,
          programacio: programacions[taula],
          darrera,
          propera: propera ? propera.toISOString() : null,
          enCurs: enMarxa(taula) || Boolean(darrera && darrera.estat === "en_curs" && !haCaducat(darrera)),
        };
      }),
    };
  } catch (error) {
    return {
      avisDirectus: (error as Error).message,
      registreAmpliat: registreAmpliat(),
      historial: [],
      taules: TAULES.map((taula) => ({ taula, programacio: PROGRAMACIO_PER_DEFECTE, darrera: null, propera: null, enCurs: enMarxa(taula) })),
    };
  }
}

export type PanellSincronitzacio<F> = {
  taula: Taula;
  /** Taula de FactuSol d'on surt, per als textos de la pantalla. */
  origen: string;
  /** Directus encara no té el model de la sincronització: cal executar l'script. */
  avisDirectus: string | null;
  programacio: Programacio;
  darrera: Execucio | null;
  propera: string | null;
  enCurs: boolean;
  historial: Execucio[];
  /** La taula de l'ERP paginada, amb la situació de cada fila respecte de Directus. */
  llista: LlistaErp<F> | null;
  /** Per codi d'ERP en text, que és com l'indexa un objecte JS igualment. */
  situacio: Record<string, SituacioErp>;
  resum: { nous: number; canviats: number; iguals: number; absentsPendents: number; absentsMarcats: number; duplicats: number } | null;
  /** Fitxes creades al portal, sense lligar amb cap fila de l'ERP. */
  nomesPortal: { id: string; nom: string }[];
  fallada: unknown;
};

/** Tot el que ensenya una pestanya de resultats de Configuració, en una sola lectura. */
async function panell<F>(def: Definicio<F>, pagina = 1): Promise<PanellSincronitzacio<F>> {
  const ara = new Date();
  let programacio = PROGRAMACIO_PER_DEFECTE;
  let historial: Execucio[] = [];
  let avisDirectus: string | null = null;
  try {
    [programacio, historial] = await Promise.all([llegeixProgramacioDe(def.taula), historialExecucions(def.taula, 10)]);
  } catch (error) {
    avisDirectus = (error as Error).message;
  }
  const darrera = historial[0] ?? null;
  const propera = properaExecucio(programacio, instantDe(darreraAcabada(historial, ara)), ara);

  const base = {
    taula: def.taula,
    origen: def.origen,
    avisDirectus,
    programacio,
    darrera,
    propera: propera ? propera.toISOString() : null,
    enCurs: enMarxa(def.taula) || Boolean(darrera && darrera.estat === "en_curs" && !haCaducat(darrera)),
    historial,
  };

  const buit = { llista: null, situacio: {}, resum: null, nomesPortal: [], fallada: null };
  if (!obtenirCredencials()) return { ...base, ...buit };

  // Sense model a Directus no hi ha res a comparar, però la taula de l'ERP es
  // pot ensenyar igual: és el pas previ a provisionar-lo.
  if (avisDirectus) {
    try {
      return { ...base, ...buit, llista: retalla(await def.llegeixErp(), pagina) };
    } catch (error) {
      return { ...base, ...buit, fallada: error };
    }
  }

  try {
    const { erp, directus, diferencies } = await fesFoto(def, ara);

    return {
      ...base,
      llista: retalla(erp.map((e) => e.fila), pagina),
      situacio: Object.fromEntries(diferencies.situacio),
      resum: {
        nous: diferencies.crear.length,
        canviats: diferencies.actualitzar.length,
        iguals: diferencies.iguals,
        absentsPendents: diferencies.absents.length,
        absentsMarcats: directus.filter((fitxa) => fitxa.erp_absent_des_de).length,
        duplicats: diferencies.duplicats.length,
      },
      nomesPortal: directus
        .filter((fitxa) => fitxa.codi_erp === null || fitxa.codi_erp === undefined)
        .map((fitxa) => ({ id: fitxa.id, nom: String(fitxa[def.campTitol] ?? "") || "Sense nom" }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "ca")),
      fallada: null,
    };
  } catch (error) {
    return { ...base, ...buit, fallada: error };
  }
}

/** La pàgina que toca de la taula de l'ERP, que arriba sencera. */
function retalla<F>(files: F[], pagina: number): LlistaErp<F> {
  const paginaSegura = Math.max(1, pagina);
  const des = (paginaSegura - 1) * PER_PAGINA_PANELL;
  return {
    files: files.slice(des, des + PER_PAGINA_PANELL),
    total: files.length,
    pagina: paginaSegura,
    perPagina: PER_PAGINA_PANELL,
    exercici: obtenirCredencials()?.exercici ?? "",
  };
}

// ------------------------------------------------- una porta per cada taula

export type PanellClients = PanellSincronitzacio<ClientErp>;
export type PanellProveidors = PanellSincronitzacio<ProveidorErp>;
export type PanellArticles = PanellSincronitzacio<Article>;
export type PanellAlbarans = PanellSincronitzacio<AlbaraErp>;

export const panellClients = (pagina = 1) => panell(CLIENTS, pagina);
export const panellProveidors = (pagina = 1) => panell(PROVEIDORS, pagina);
export const panellArticles = (pagina = 1) => panell(ARTICLES, pagina);
export const panellAlbarans = (pagina = 1) => panell(ALBARANS, pagina);

/** El nom de la taula per als textos: «Clients», «F_CLI». */
export const fitxaTaula = (taula: Taula) => FITXA_TAULA[taula];
