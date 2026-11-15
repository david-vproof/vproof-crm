/**
 * Sincronització de FactuSol cap a Directus. Aquí només hi ha la lògica pura:
 * què es copia de cada taula, com es detecta un canvi i quan toca fer la
 * passada. Qui llegeix i escriu és `serveis/sincronitzacio.ts`.
 *
 * Hi ha tres taules, clients (F_CLI), proveïdors (F_PRO) i articles (F_ART),
 * amb el mateix mecanisme: mapatge de camps, empremta del que ve de l'ERP i
 * comparació amb el que hi ha a Directus.
 *
 * Regla de la casa: als camps que vénen de FactuSol hi mana FactuSol. Els del
 * CRM (potencial, zona, comercial, horaris, notes…) no es toquen mai.
 */
import type { Article, ClientResum, ProveidorResum } from "./tipus";
import { ZONA } from "./crm-planner";
import { esArticleHistoric, estatClientDesDeCodi } from "./factusol-vocabulari";

// ------------------------------------------------------------------ taules

/**
 * Les taules de l'ERP que se sincronitzen. L'ordre compta: els articles
 * apunten als cellers, així que van després dels proveïdors, i els albarans
 * apunten als clients i als articles. Una passada global les fa en aquest ordre.
 */
export type Taula = "clients" | "proveidors" | "articles" | "albarans";

export const TAULES: Taula[] = ["clients", "proveidors", "articles", "albarans"];

export function esTaula(valor: string): valor is Taula {
  return (TAULES as string[]).includes(valor);
}

/** Com es presenta cada taula a la pantalla, sense haver de passar pel servidor. */
export const FITXA_TAULA: Record<
  Taula,
  {
    etiqueta: string;
    plural: string;
    /** Taula de FactuSol d'on surt. */
    origen: string;
    /** Col·lecció de Directus on va. */
    desti: string;
    /** El que hi va lligat i es fa a la mateixa passada. */
    porta: string;
    /** Les que triguen: es diu abans de triar-les. */
    pesada: boolean;
  }
> = {
  clients: {
    etiqueta: "Clients", plural: "clients", origen: "F_CLI", desti: "crm_clients",
    porta: "Amb els tipus de client, els agents, els establiments, la comarca i la facturació.", pesada: false,
  },
  proveidors: {
    etiqueta: "Proveïdors", plural: "proveïdors", origen: "F_PRO", desti: "crm_proveidors",
    porta: "Només els homologats: els cellers.", pesada: false,
  },
  articles: {
    etiqueta: "Articles", plural: "articles", origen: "F_ART", desti: "crm_articles",
    porta: "Només els actius, amb les fotos a tongades de 150 per passada.", pesada: false,
  },
  albarans: {
    etiqueta: "Albarans", plural: "albarans", origen: "F_ALB", desti: "crm_albarans",
    porta: "Dos exercicis, amb les línies de F_LAL. És la passada més llarga.", pesada: true,
  },
};

export type Desencadenant = "manual" | "programada";

// --------------------------------------------------------------- seguiment

/**
 * Les fases d'una passada, en l'ordre en què passen. La preparació només la
 * tenen els clients (els seus catàlegs) i els complements són el que hi va
 * lligat: establiments, facturació, fotos o línies d'albarà, segons la taula.
 */
export type Fase = "preparacio" | "lectura" | "comparacio" | "escriptura" | "complements" | "tancament";

export const ORDRE_FASES: Fase[] = ["preparacio", "lectura", "comparacio", "escriptura", "complements", "tancament"];

export const NOM_FASE: Record<Fase, string> = {
  preparacio: "Preparant els catàlegs",
  lectura: "Llegint",
  comparacio: "Comparant",
  escriptura: "Escrivint a Directus",
  complements: "Acabant el que hi va lligat",
  tancament: "Tancant el registre",
};

/** Què s'estava fent amb la fila quan ha fallat. */
export type Operacio = "crear" | "actualitzar" | "absent";

export const NOM_OPERACIO: Record<Operacio, string> = {
  crear: "Creant les fitxes noves",
  actualitzar: "Actualitzant les que han canviat",
  absent: "Marcant les que ja no són a l'ERP",
};

/** Una fila que Directus no ha volgut: s'anota i la passada continua. */
export type ErrorCopia = {
  /** El codi d'ERP de la fila, o l'id de Directus si és una fitxa que es marca absent. */
  codi: string;
  nom: string;
  operacio: Operacio;
  motiu: string;
  /** La col·lecció on anava, si no és la principal de la taula (línies d'albarà, establiments). */
  colleccio?: string;
};

/** Quants errors de còpia es desen al registre: la resta només es compten. */
export const MAXIM_ERRORS_DESATS = 100;

/**
 * Si una passada n'acumula més, alguna cosa no és de les dades sinó del
 * servei, i aïllar fila per fila només faria perdre temps: s'atura.
 */
export const MAXIM_FALLITS = 200;

export type Comptadors = {
  llegits: number;
  creats: number;
  actualitzats: number;
  absents: number;
  iguals: number;
  /** Files que Directus no ha acceptat. */
  fallits: number;
  /** Files que no han cabut en el temps de la passada i es faran a la següent. */
  pendents: number;
};

export const COMPTADORS_BUITS: Comptadors = { llegits: 0, creats: 0, actualitzats: 0, absents: 0, iguals: 0, fallits: 0, pendents: 0 };

/**
 * Com acaba una passada. «Parcial» vol dir que ha arribat al final però
 * alguna fila no s'ha pogut copiar; «error», que s'ha aturat a mig camí.
 */
export type EstatExecucio = "en_curs" | "correcte" | "parcial" | "error";

export const NOM_ESTAT_EXECUCIO: Record<EstatExecucio, string> = {
  en_curs: "En curs",
  correcte: "Correcta",
  parcial: "Amb errors",
  error: "Fallida",
};

/** El progrés tal com es desa al registre de Directus mentre la passada és en curs. */
export type ProgresDesat = {
  detall: string | null;
  fets: number | null;
  total: number | null;
  actualitzat_el: string;
};

/**
 * L'estat d'una passada en marxa, tal com viatja fins al navegador. Cada
 * missatge porta l'estat sencer, no un canvi: així un que es perdi no deixa
 * la pantalla coixa.
 */
export type EstatEnViu = {
  /** L'id del registre a Directus, quan ja s'ha creat. */
  id: string | null;
  taula: Taula;
  desencadenant: Desencadenant;
  inici: string;
  fase: Fase;
  detall: string | null;
  fets: number | null;
  total: number | null;
  comptadors: Comptadors;
  /** Els primers; `comptadors.fallits` els compta tots. */
  errors: ErrorCopia[];
  /** El darrer cop que la passada ha dit res: si fa massa, és que s'ha encallat. */
  actualitzatEl: string;
  final: { estat: Exclude<EstatExecucio, "en_curs">; missatge: string; fi: string } | null;
};

/** Les fases que fa cada taula: només els clients preparen catàlegs, i els proveïdors no tenen complements. */
export function fasesDe(taula: Taula): Fase[] {
  return ORDRE_FASES.filter(
    (fase) => (fase !== "preparacio" || taula === "clients") && (fase !== "complements" || taula !== "proveidors"),
  );
}

const NOMBRE = new Intl.NumberFormat("ca-ES");

/** Els comptadors d'una passada en una línia: «1.466 llegides · 3 creades · …». Els zeros poc interessants s'ometen. */
export function resumComptadors(c: Partial<Comptadors>): string {
  const parts = [
    `${NOMBRE.format(c.llegits ?? 0)} llegides`,
    `${NOMBRE.format(c.creats ?? 0)} creades`,
    `${NOMBRE.format(c.actualitzats ?? 0)} actualitzades`,
    `${NOMBRE.format(c.absents ?? 0)} absents`,
    `${NOMBRE.format(c.iguals ?? 0)} al dia`,
  ];
  if (c.fallits) parts.push(`${NOMBRE.format(c.fallits)} sense copiar`);
  if (c.pendents) parts.push(`${NOMBRE.format(c.pendents)} per a la propera`);
  return parts.join(" · ");
}

/** El tant per cent d'una fase, si es pot saber. */
export function tantPerCent(fets: number | null, total: number | null): number | null {
  if (fets === null || total === null || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((fets / total) * 100)));
}

/** Passats aquests segons sense cap senyal del servidor, la pantalla ho diu. */
export const SENSE_NOTICIES_S = 15;

/** Com acaba una passada que ha arribat al final: depèn de si ha deixat files sense copiar. */
export function estatEnAcabar(fallits: number): "correcte" | "parcial" {
  return fallits > 0 ? "parcial" : "correcte";
}

export type ClientErp = ClientResum & { WEBCLI: string; PAICLI: string; TCLCLI: string };

/** Una fila de F_TCL: els tipus de client. */
export type TipusClientErp = { CODTCL: string; DESTCL: string };

/** Una fila de F_AGE: els agents comercials. */
export type AgentErp = { CODAGE: number | string; NOMAGE: string };

/**
 * Com es tradueixen els codis de l'ERP. `formesPagament` va del codi a la
 * descripció de F_FPA i `families`, a la de F_FAM; `tipusClient`, de TCLCLI a
 * l'id de `crm_tipus_client`; `agents`, d'AGECLI a l'id de `crm_agents`;
 * `cellers`, de PHAART a l'id de `crm_proveidors`, i `clients`, de CLIALB a
 * l'id de `crm_clients` (només els que surten al CRM), perquè les relacions es
 * facin igual que a FactuSol.
 */
export type CatalegsErp = {
  formesPagament: Record<string, string>;
  families: Record<string, string>;
  tipusClient: Record<string, string>;
  agents: Record<string, string>;
  cellers: Record<string, string>;
  clients: Record<string, string>;
};

/** Camps de crm_clients que té l'ERP com a amo, en l'ordre que fa l'empremta. */
export const CAMPS_ERP = [
  "codi_erp", "nom_comercial", "rao_social", "nif", "adreca", "codi_postal", "poblacio", "provincia",
  "pais", "telefon", "correu", "web", "tarifa", "forma_pagament", "data_alta", "estat", "erp_estat",
  "tipus_client", "erp_tipus_client", "agent", "erp_agent",
] as const;

export type CampErp = (typeof CAMPS_ERP)[number];

/** Els camps que el portal copia de l'ERP, siguin els d'una taula o de l'altra. */
export type ValorsErp = Record<string, string | number | boolean | null>;

/**
 * ESTPRO cap a l'estat del celler. FactuSol només en documenta dos (0 normal,
 * 1 bloquejat) i la taula real en porta més: els no documentats es consideren
 * inactius, i el codi en cru es conserva a `erp_estat`. Els clients fan servir
 * el desplegable propi de FactuSol: vegeu `ESTATS_CLIENT`.
 */
const ESTAT_PROVEIDOR_PER_CODI: Record<number, string> = { 0: "actiu", 1: "baixa" };

function estatProveidorDesDeCodi(valor: unknown) {
  return ESTAT_PROVEIDOR_PER_CODI[Number(valor)] ?? "inactiu";
}

/**
 * FactuSol desa el país com a codi numèric ISO 3166-1 ("724" és Espanya). Al
 * CRM hi va el nom, que és el que entén la geocodificació i el que llegeix la
 * gent. Els codis que no són aquí es deixen tal qual, per no perdre'ls.
 */
const PAIS_PER_CODI: Record<string, string> = {
  "724": "Espanya", "020": "Andorra", "250": "França", "620": "Portugal", "380": "Itàlia", "276": "Alemanya",
  "826": "Regne Unit", "372": "Irlanda", "528": "Països Baixos", "056": "Bèlgica", "442": "Luxemburg",
  "756": "Suïssa", "040": "Àustria", "208": "Dinamarca", "752": "Suècia", "578": "Noruega", "246": "Finlàndia",
  "616": "Polònia", "203": "Txèquia", "840": "Estats Units", "124": "Canadà", "484": "Mèxic", "392": "Japó",
  "156": "Xina", "036": "Austràlia", "554": "Nova Zelanda", "076": "Brasil", "032": "Argentina", "152": "Xile",
  "470": "Malta", "300": "Grècia", "705": "Eslovènia", "191": "Croàcia", "348": "Hongria", "642": "Romania",
  "100": "Bulgària", "703": "Eslovàquia", "792": "Turquia", "710": "Sud-àfrica",
};

export function nomDePais(valor: unknown) {
  const codi = net(valor);
  if (!codi) return null;
  return PAIS_PER_CODI[codi.padStart(3, "0")] ?? codi;
}

function net(valor: unknown) {
  const text = String(valor ?? "").trim();
  return text === "" ? null : text;
}

/** FactuSol envia "2018-02-22T00:00:00" sense fus: es pren el dia literal, sense convertir-lo. */
function dataIso(valor: unknown) {
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ""));
  if (!dia || Number(dia[1]) <= 1900) return null;
  return dia[0];
}

/** Els camps que rep Directus d'una fila de F_CLI. */
export function valorsDesDeErp(client: ClientErp, { formesPagament, tipusClient, agents }: CatalegsErp): ValorsErp {
  const formaPagament = net(client.FPACLI);
  const codiTipus = net(client.TCLCLI);
  const codiAgent = Number(client.AGECLI) || 0;
  return {
    codi_erp: Number(client.CODCLI),
    nom_comercial: net(client.NOCCLI) ?? net(client.NOFCLI) ?? `Client ${client.CODCLI}`,
    rao_social: net(client.NOFCLI),
    nif: net(client.NIFCLI)?.toUpperCase() ?? null,
    adreca: net(client.DOMCLI),
    codi_postal: net(client.CPOCLI),
    poblacio: net(client.POBCLI),
    provincia: net(client.PROCLI),
    pais: nomDePais(client.PAICLI),
    telefon: net(client.TELCLI) ?? net(client.MOVCLI),
    correu: net(client.EMACLI)?.toLowerCase() ?? null,
    web: net(client.WEBCLI),
    tarifa: Number(client.TARCLI) || null,
    forma_pagament: formaPagament ? formesPagament[formaPagament] || formaPagament : null,
    data_alta: dataIso(client.FALCLI),
    estat: estatClientDesDeCodi(client.ESTCLI),
    erp_estat: Number(client.ESTCLI) || 0,
    // TCLCLI apunta a F_TCL; al CRM, a la seva còpia. Un codi que la taula no
    // té deixa la relació buida, i el codi en cru es guarda per no perdre'l.
    tipus_client: codiTipus ? (tipusClient[String(Number(codiTipus))] ?? tipusClient[codiTipus] ?? null) : null,
    erp_tipus_client: codiTipus,
    // Igual amb AGECLI i F_AGE. El 0 és «sense agent».
    agent: codiAgent ? (agents[String(codiAgent)] ?? null) : null,
    erp_agent: codiAgent,
  };
}

// ------------------------------------------------------- tipus de client

/** Camps de crm_tipus_client que té l'ERP com a amo. `usat_crm` és del CRM i no hi és. */
export const CAMPS_ERP_TIPUS_CLIENT = ["codi_erp", "nom"] as const;

/** Els camps que rep Directus d'una fila de F_TCL. */
export function valorsTipusClientDesDeErp(tipus: TipusClientErp): ValorsErp {
  return { codi_erp: Number(tipus.CODTCL), nom: net(tipus.DESTCL) ?? `Tipus ${tipus.CODTCL}` };
}

// ------------------------------------------------------------------ agents

/** Camps de crm_agents que té l'ERP com a amo: tots. */
export const CAMPS_ERP_AGENT = ["codi_erp", "nom"] as const;

/** Els camps que rep Directus d'una fila de F_AGE. */
export function valorsAgentDesDeErp(agent: AgentErp): ValorsErp {
  return { codi_erp: Number(agent.CODAGE), nom: net(agent.NOMAGE) ?? `Agent ${agent.CODAGE}` };
}

// ------------------------------------------------------------- proveïdors

export type ProveidorErp = ProveidorResum & {
  HOMPRO: number;
  WEBPRO: string; PAIPRO: string; MOVPRO: string; OBSPRO: string;
  SWFPRO: string; SWIPRO: string; BANPRO: string; CCEPRO: string;
  RETPRO: number; DP1PRO: number; FUMPRO: string;
};

/** Camps de crm_proveidors que té l'ERP com a amo, en l'ordre que fa l'empremta. */
export const CAMPS_ERP_PROVEIDOR = [
  "codi_erp", "nom_comercial", "rao_social", "nif", "tipus", "adreca", "codi_postal", "poblacio",
  "provincia", "pais", "telefon", "mobil", "correu", "web", "persona_contacte", "forma_pagament",
  "iban", "bic", "banc", "compte_comptable", "retencio", "descompte", "observacions",
  "data_alta", "erp_modificat_el", "estat", "erp_estat",
] as const;

/**
 * TIPPRO separa qui ven mercaderia de qui ven serveis. Es veu al compte
 * comptable: els de tipus 0 van al 600 (compres) i els d'1, al 62x (serveis
 * exteriors), que a la comptabilitat espanyola són creditors, no proveïdors.
 */
const TIPUS_PER_CODI: Record<number, string> = { 0: "proveidor", 1: "creditor" };

/** Un percentatge de FactuSol: ve com a número i el zero vol dir «cap». */
function percentatge(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero !== 0 ? numero : null;
}

/** Els camps que rep Directus d'una fila de F_PRO. */
export function valorsProveidorDesDeErp(proveidor: ProveidorErp, { formesPagament }: CatalegsErp): ValorsErp {
  const formaPagament = net(proveidor.FPAPRO);
  return {
    codi_erp: Number(proveidor.CODPRO),
    nom_comercial: net(proveidor.NOCPRO) ?? net(proveidor.NOFPRO) ?? `Proveïdor ${proveidor.CODPRO}`,
    rao_social: net(proveidor.NOFPRO),
    nif: net(proveidor.NIFPRO)?.toUpperCase() ?? null,
    tipus: TIPUS_PER_CODI[Number(proveidor.TIPPRO)] ?? "proveidor",
    adreca: net(proveidor.DOMPRO),
    codi_postal: net(proveidor.CPOPRO),
    poblacio: net(proveidor.POBPRO),
    provincia: net(proveidor.PROPRO),
    pais: nomDePais(proveidor.PAIPRO),
    telefon: net(proveidor.TELPRO) ?? net(proveidor.MOVPRO),
    mobil: net(proveidor.MOVPRO),
    correu: net(proveidor.EMAPRO)?.toLowerCase() ?? null,
    web: net(proveidor.WEBPRO),
    persona_contacte: net(proveidor.PCOPRO),
    forma_pagament: formaPagament ? formesPagament[formaPagament] || formaPagament : null,
    // Les dades de pagament: qui cobra, on i per quina via.
    iban: net(proveidor.SWFPRO)?.toUpperCase().replace(/\s+/g, "") ?? null,
    bic: net(proveidor.SWIPRO)?.toUpperCase() ?? null,
    banc: net(proveidor.BANPRO),
    compte_comptable: net(proveidor.CCEPRO),
    retencio: percentatge(proveidor.RETPRO),
    descompte: percentatge(proveidor.DP1PRO),
    observacions: net(proveidor.OBSPRO),
    data_alta: dataIso(proveidor.FALPRO),
    erp_modificat_el: dataIso(proveidor.FUMPRO),
    estat: estatProveidorDesDeCodi(proveidor.ESTPRO),
    erp_estat: Number(proveidor.ESTPRO) || 0,
  };
}

// --------------------------------------------------------------- articles

/**
 * Camps de crm_articles que té l'ERP com a amo, en l'ordre que fa l'empremta.
 * L'únic estat és `historic` (descatalogat o no disponible: vegeu
 * `esArticleHistoric`); el que desapareix de F_ART queda absent.
 */
export const CAMPS_ERP_ARTICLE = [
  "codi_erp", "nom", "codi_barres", "familia", "erp_familia", "celler", "erp_proveidor", "referencia_proveidor", "data_alta",
  "erp_imatge", "garantia", "camp_programable_1", "camp_programable_2", "camp_programable_3", "camp_programable_4",
  "camp_programable_5", "historic",
] as const;

/** Els camps que rep Directus d'una fila de F_ART. */
export function valorsArticleDesDeErp(article: Article, { families, cellers }: CatalegsErp): ValorsErp {
  const codi = net(article.CODART) ?? "";
  const codiFamilia = net(article.FAMART);
  const codiProveidor = Number(article.PHAART) || 0;
  return {
    codi_erp: codi,
    nom: net(article.DESART) ?? `Article ${codi}`,
    codi_barres: net(article.EANART),
    familia: codiFamilia ? families[codiFamilia] || codiFamilia : null,
    erp_familia: codiFamilia,
    // El proveïdor habitual és el celler. Si no és dels homologats que copia
    // la sincronització de proveïdors, la relació queda buida i el codi es guarda.
    celler: codiProveidor ? (cellers[String(codiProveidor)] ?? null) : null,
    erp_proveidor: codiProveidor || null,
    referencia_proveidor: net(article.REFART),
    data_alta: dataIso(article.FALART),
    // Només el nom del fitxer, que porta la data: la foto la copia un pas a part
    // quan aquest nom canvia (vegeu `domini/imatge-article.ts`).
    erp_imatge: net(article.IMGART),
    garantia: net(article.GARART),
    // Tal qual: què hi va a cadascun ho decideix la bodega a FactuSol.
    camp_programable_1: net(article.CP1ART),
    camp_programable_2: net(article.CP2ART),
    camp_programable_3: net(article.CP3ART),
    camp_programable_4: net(article.CP4ART),
    camp_programable_5: net(article.CP5ART),
    // Descatalogat o no disponible per a l'ús: es copia igualment, però marcat,
    // i els catàlegs només l'ensenyen quan es demanen els històrics.
    historic: esArticleHistoric(article),
  };
}

/** El text del qual es fa l'empremta: canvia si i només si canvia algun camp de l'ERP. */
export function textEmpremta(valors: ValorsErp, camps: readonly string[] = CAMPS_ERP) {
  return JSON.stringify(camps.map((camp) => valors[camp] ?? null));
}

/** Si canvia un d'aquests, el punt del mapa ja no val. Província i país sols no mouen el punt. */
export const CAMPS_ADRECA = ["adreca", "codi_postal", "poblacio"] as const;

/** El que cal saber d'una fitxa de Directus per decidir què fer-hi. */
export type FitxaVinculable = {
  id: string;
  /** Numèric a clients i proveïdors; de text als articles. */
  codi_erp: number | string | null;
  font: string | null;
  erp_empremta: string | null;
  erp_absent_des_de: string | null;
  /** La resta de camps que es comparen, segons la taula. */
  [camp: string]: unknown;
};

export type SituacioErp = "nou" | "igual" | "canviat";

export type Diferencies = {
  /** Fitxes a crear, amb tots els camps de l'ERP. */
  crear: Record<string, unknown>[];
  /** Fitxes existents amb algun camp de l'ERP diferent. */
  actualitzar: { id: string; dades: Record<string, unknown> }[];
  /** Fitxes vinculades que ja no són a la taula de l'ERP. */
  absents: { id: string; dades: Record<string, unknown> }[];
  /** Fitxes creades al portal sense font: se'ls estampa «portal». */
  normalitzar: string[];
  iguals: number;
  /** Codis d'ERP repetits a Directus: només se'n manté el primer. */
  duplicats: string[];
  /** Per codi d'ERP, en text: així hi caben els numèrics i els de F_ART. */
  situacio: Map<string, SituacioErp>;
};

/**
 * Compara una taula de l'ERP amb el que hi ha a Directus. L'empremta de cada
 * fila la calcula el servei, perquè aquí no hi entri cap crypto.
 *
 * `buidaAmbAdreca` són els camps que deixen de valer quan es mou l'adreça: als
 * comptes, les coordenades del mapa. Els proveïdors no en tenen i no en passen.
 *
 * `marcaAbsent` és el que es posa a qui ha desaparegut de l'ERP, a més de la
 * data: clients i proveïdors passen a baixa; els tipus de client i els
 * articles no tenen estat.
 *
 * Els codis es comparen com a text: Directus torna el de clients i proveïdors
 * com a número i el dels articles és de text a FactuSol.
 */
export function calculaDiferencies(
  erp: { valors: ValorsErp; empremta: string }[],
  directus: FitxaVinculable[],
  ara: Date,
  buidaAmbAdreca: readonly string[] = [],
  marcaAbsent: Record<string, unknown> = { estat: "baixa" },
): Diferencies {
  const instant = ara.toISOString();
  const avui = instant.slice(0, 10);

  const perCodi = new Map<string, FitxaVinculable>();
  const duplicats: string[] = [];
  const normalitzar: string[] = [];
  for (const compte of directus) {
    if (compte.codi_erp === null || compte.codi_erp === undefined || compte.codi_erp === "") {
      if (!compte.font) normalitzar.push(compte.id);
      continue;
    }
    const codi = String(compte.codi_erp);
    if (perCodi.has(codi)) duplicats.push(codi);
    else perCodi.set(codi, compte);
  }

  const crear: Diferencies["crear"] = [];
  const actualitzar: Diferencies["actualitzar"] = [];
  const situacio = new Map<string, SituacioErp>();
  let iguals = 0;
  const vistos = new Set<string>();

  for (const { valors, empremta } of erp) {
    const codi = String(valors.codi_erp);
    vistos.add(codi);
    const marca = { font: "factusol", erp_empremta: empremta, erp_sincronitzat_el: instant, erp_absent_des_de: null };
    const existent = perCodi.get(codi);

    if (!existent) {
      crear.push({ ...valors, ...marca });
      situacio.set(codi, "nou");
      continue;
    }

    const alDia = existent.erp_empremta === empremta && existent.font === "factusol" && !existent.erp_absent_des_de;
    if (alDia) {
      iguals += 1;
      situacio.set(codi, "igual");
      continue;
    }

    const dades: Record<string, unknown> = { ...valors, ...marca };
    // Si es mou l'adreça, les coordenades velles enganyen: es buiden i la
    // ubicació en segon pla les torna a calcular.
    if (buidaAmbAdreca.length > 0 && CAMPS_ADRECA.some((camp) => (existent[camp] ?? null) !== valors[camp])) {
      for (const camp of buidaAmbAdreca) dades[camp] = null;
    }
    actualitzar.push({ id: existent.id, dades });
    situacio.set(codi, "canviat");
  }

  const absents: Diferencies["absents"] = [];
  for (const [codi, compte] of perCodi) {
    if (vistos.has(codi) || compte.erp_absent_des_de || compte.font !== "factusol") continue;
    absents.push({ id: compte.id, dades: { erp_absent_des_de: avui, ...marcaAbsent, erp_sincronitzat_el: instant } });
  }

  return { crear, actualitzar, absents, normalitzar, iguals, duplicats, situacio };
}

// ------------------------------------------------------------- programació

export const PERIODICITATS: { minuts: number; etiqueta: string }[] = [
  { minuts: 15, etiqueta: "Cada 15 minuts" },
  { minuts: 60, etiqueta: "Cada hora" },
  { minuts: 360, etiqueta: "Cada 6 hores" },
  { minuts: 1440, etiqueta: "Cada dia" },
  { minuts: 10080, etiqueta: "Cada setmana" },
];

export const HORA_PER_DEFECTE = "06:00";

export type Programacio = {
  activa: boolean;
  /** Minuts entre passades: un dels valors de PERIODICITATS. */
  periodicitatMinuts: number;
  /** Hora local (HH:MM) de la passada, només si és diària o setmanal. */
  hora: string;
};

export const PROGRAMACIO_PER_DEFECTE: Programacio = { activa: false, periodicitatMinuts: 1440, hora: HORA_PER_DEFECTE };

/** Cada taula té la seva programació al singleton, amb els camps `sync_<taula>_*`. */
export function campsProgramacio(taula: string) {
  return {
    activa: `sync_${taula}_activa`,
    periodicitat: `sync_${taula}_periodicitat`,
    hora: `sync_${taula}_hora`,
  };
}

export function llegeixProgramacio(brut: Record<string, unknown> | null, taula = "clients"): Programacio {
  const camps = campsProgramacio(taula);
  const minuts = Number(brut?.[camps.periodicitat]);
  const hora = String(brut?.[camps.hora] ?? "").trim();
  return {
    activa: brut?.[camps.activa] === true,
    periodicitatMinuts: PERIODICITATS.some((p) => p.minuts === minuts) ? minuts : PROGRAMACIO_PER_DEFECTE.periodicitatMinuts,
    hora: /^\d{2}:\d{2}$/.test(hora) ? hora : HORA_PER_DEFECTE,
  };
}

export function esDiaria(programacio: Programacio) {
  return programacio.periodicitatMinuts >= 1440;
}

/** Data (YYYY-MM-DD) i hora (HH:MM) d'un instant al fus de la bodega. */
function local(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant);
  const de = (tipus: string) => parts.find((p) => p.type === tipus)?.value ?? "00";
  return { dia: `${de("year")}-${de("month")}-${de("day")}`, hora: `${de("hour")}:${de("minute")}` };
}

function diesEntre(diaA: string, diaB: string) {
  return Math.round((Date.parse(diaB) - Date.parse(diaA)) / 86_400_000);
}

/**
 * Si toca fer la passada. Les periodicitats curtes compten des de la darrera;
 * les diàries i setmanals esperen l'hora triada i no repeteixen el mateix dia.
 */
export function tocaExecutar(programacio: Programacio, darrera: Date | null, ara: Date): boolean {
  if (!programacio.activa) return false;

  if (!esDiaria(programacio)) {
    if (!darrera) return true;
    return ara.getTime() - darrera.getTime() >= programacio.periodicitatMinuts * 60_000;
  }

  const d = local(ara);
  if (d.hora < programacio.hora) return false;
  if (!darrera) return true;
  const diesMinims = programacio.periodicitatMinuts === 10080 ? 7 : 1;
  return diesEntre(local(darrera).dia, d.dia) >= diesMinims;
}

/** Quan es preveu la propera passada, per ensenyar-ho. */
export function properaExecucio(programacio: Programacio, darrera: Date | null, ara: Date): Date | null {
  if (!programacio.activa) return null;
  if (!esDiaria(programacio)) {
    if (!darrera) return ara;
    return new Date(Math.max(ara.getTime(), darrera.getTime() + programacio.periodicitatMinuts * 60_000));
  }
  // Es prova dia a dia des d'avui fins a trobar el primer instant que toqui.
  for (let i = 0; i <= 8; i += 1) {
    const candidat = instantLocal(local(new Date(ara.getTime() + i * 86_400_000)).dia, programacio.hora);
    if (candidat.getTime() >= ara.getTime() - 60_000 && tocaExecutar(programacio, darrera, candidat)) return candidat;
  }
  return null;
}

/** L'instant UTC d'un dia i hora locals de la bodega, amb hivern i estiu. */
function instantLocal(dia: string, hora: string) {
  const aproximat = new Date(`${dia}T${hora}:00Z`);
  const alla = local(aproximat);
  const desviacio = Date.parse(`${alla.dia}T${alla.hora}:00Z`) - aproximat.getTime();
  return new Date(aproximat.getTime() - desviacio);
}
