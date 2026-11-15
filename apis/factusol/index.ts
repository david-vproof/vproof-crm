import "server-only";

import { percentatgeDeTipus } from "@/domini/preu-factusol";

import { demanaFiles, escapaSql, llancaConsulta, obtenirCredencials } from "./client";
import { ErrorFactusol } from "./errors";
import type {
  Article, Client, ClientResum, LlistaClients, LlistaClientsResum, Proveidor, ProveidorResum, LlistaProveidorsResum,
} from "@/domini/tipus";
import type { FilaAlbaransErp, FilaFacturacioErp } from "@/domini/facturacio";
import type { ImatgeArticleErp } from "@/domini/imatge-article";
import type { AlbaraErp, LiniaAlbaraErp } from "@/domini/albarans";
import type { EstablimentErp } from "@/domini/establiments";
import type { EstocErp, MagatzemErp } from "@/domini/estoc-vins";
import { ARTICLE_ACTIU, ESTAT_ALBARA_PENDENT, ESTAT_CLIENT_BAIXA, MARQUES_ARTICLE_INACTIU } from "@/domini/factusol-vocabulari";
import { CLAUS_ORDRE_CLIENTS_ERP, CODI_CLIENT_ERP } from "@/domini/llistats-erp";
import { type Ordre, ordena } from "@/domini/ordre-llistat";
import type { AgentErp, ClientErp, ProveidorErp, TipusClientErp } from "@/domini/sincronitzacio";

export const PER_PAGINA = 12;

/** Columnes de F_CLI que consulta el portal, en l'ordre en què es mostren. */
const COLUMNES = [
  "CODCLI", "NIFCLI", "NOFCLI", "NOCCLI", "DOMCLI", "POBCLI", "CPOCLI", "PROCLI",
  "PAICLI", "TELCLI", "MOVCLI", "EMACLI", "WEBCLI", "PCOCLI", "TCLCLI", "AGECLI",
  "FPACLI", "TARCLI", "DP1CLI", "RETCLI", "CRFCLI", "ESTCLI", "FALCLI", "FUMCLI",
  "OBSCLI", "PBACLI", "DBACLI", "ENTCLI", "OFICLI", "DCOCLI", "CUECLI", "BANCLI",
  "NO1CLI", "TF1CLI", "EM1CLI", "NO2CLI", "TF2CLI", "EM2CLI",
  "ACO1CLI", "ADO1CLI", "ACP1CLI", "APO1CLI", "APR1CLI",
].join(", ");

/** Els clients de baixa no surten al portal: ni al llistat, ni a la fitxa, ni a la sincronització. */
const SENSE_BAIXA = `ESTCLI <> ${ESTAT_CLIENT_BAIXA.codi}`;

const CAMPS_CERCABLES = ["NOFCLI", "NOCCLI", "NIFCLI", "POBCLI", "EMACLI"];

export type FiltreClients = {
  cerca?: string;
  pagina?: number;
  /** Per quina columna del llistat (vegeu `domini/llistats-erp.ts`); sense, pel codi. */
  ordre?: Ordre | null;
  /**
   * Només els clients d'aquest agent comercial (AGECLI). Sense (`undefined`),
   * tots; `null`, cap: és qui no ho veu tot i no té agent.
   */
  agent?: number | null;
};

/** El tros de WHERE que limita a un agent; cap fila si no n'hi ha. */
function perAgent(agent: number | null | undefined) {
  if (agent === undefined) return "";
  return agent === null ? " AND 1 = 0" : ` AND AGECLI = ${Number(agent)}`;
}

export function estaConfigurat() {
  return obtenirCredencials() !== null;
}

function exigeixCredencials() {
  const credencials = obtenirCredencials();
  if (!credencials) {
    throw new ErrorFactusol(
      "sense-credencials",
      "Falten les credencials de connexió. Configura-les a Configuració.",
    );
  }
  return credencials;
}

export async function llistaClients({ cerca = "", pagina = 1, ordre = null, agent }: FiltreClients = {}): Promise<LlistaClients> {
  const credencials = exigeixCredencials();
  const terme = cerca.trim();

  const tots = await llancaConsulta<Client>(
    credencials,
    `SELECT ${COLUMNES} FROM F_CLI WHERE ${SENSE_BAIXA}${perAgent(agent)}${
      terme ? ` AND (${CAMPS_CERCABLES.map((camp) => `${camp} LIKE '%${escapaSql(terme)}%'`).join(" OR ")})` : ""
    } ORDER BY CODCLI`,
  );

  // L'API de DELSOL no pagina ni cal demanar-li l'ordre: la taula ja ve sencera,
  // així que l'ordre de la columna i la retallada de la pàgina es fan aquí.
  const ordenats = ordena(tots, ordre, CLAUS_ORDRE_CLIENTS_ERP, CODI_CLIENT_ERP);
  const paginaSegura = Math.max(1, pagina);
  const des = (paginaSegura - 1) * PER_PAGINA;

  return {
    files: ordenats.slice(des, des + PER_PAGINA),
    total: tots.length,
    pagina: paginaSegura,
    perPagina: PER_PAGINA,
    exercici: credencials.exercici,
  };
}

/** Columnes de la taula de comprovació: prou per identificar la fitxa sense portar les 200 de F_CLI. */
const COLUMNES_RESUM = [
  "CODCLI", "NIFCLI", "NOFCLI", "NOCCLI", "DOMCLI", "CPOCLI", "POBCLI", "PROCLI",
  "TELCLI", "MOVCLI", "EMACLI", "PCOCLI", "AGECLI", "FPACLI", "TARCLI", "ESTCLI", "FALCLI",
].join(", ");

/**
 * F_CLI per a la sincronització, sense els clients de baixa: les columnes del
 * resum més les que només es copien (web, país i tipus de client). Sense
 * paginar: es vol la foto sencera. Un client que passa a baixa a l'ERP deixa
 * de venir i la passada el marca com a absent.
 */
export async function llistaClientsPerSincronitzar(): Promise<ClientErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<ClientErp>(
    credencials,
    `SELECT ${COLUMNES_RESUM}, WEBCLI, PAICLI, TCLCLI FROM F_CLI WHERE ${SENSE_BAIXA} ORDER BY CODCLI`,
  );
}

/**
 * Un exercici de F_FAC agrupat per client i mes: la base imposable (la suma de
 * les quatre bases, sense IVA) i quantes factures. FactuSol té una base de dades
 * per exercici, així que la consulta es llança contra l'any que toca.
 */
export async function llistaFacturacioDExercici(exercici: number): Promise<FilaFacturacioErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<FilaFacturacioErp>(
    { ...credencials, exercici: String(exercici) },
    "SELECT CLIFAC, MONTH(FECFAC) AS MES, COUNT(*) AS N, SUM(BAS1FAC+BAS2FAC+BAS3FAC+BAS4FAC) AS BASE " +
      "FROM F_FAC GROUP BY CLIFAC, MONTH(FECFAC)",
  );
}

/**
 * Els albarans d'un exercici encara no facturats, agrupats per client i mes de
 * l'albarà: la base imposable, igual que F_FAC. Un cop es facturen ja no surten
 * aquí i passen a comptar com a factura, així que no es compten mai dues vegades.
 */
export async function llistaAlbaransPendentsDExercici(exercici: number): Promise<FilaAlbaransErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<FilaAlbaransErp>(
    { ...credencials, exercici: String(exercici) },
    "SELECT CLIALB, MONTH(FECALB) AS MES, SUM(BAS1ALB+BAS2ALB+BAS3ALB+BAS4ALB) AS BASE " +
      `FROM F_ALB WHERE ESTALB = ${ESTAT_ALBARA_PENDENT} GROUP BY CLIALB, MONTH(FECALB)`,
  );
}

/**
 * Les capçaleres de F_ALB d'un exercici, les més noves primer. Com F_FAC, la
 * consulta es llança contra la base de dades d'aquell any, i cada fila surt
 * marcada amb l'exercici perquè el número només és únic dins de l'any.
 */
export async function llistaAlbaransDExercici(exercici: number): Promise<AlbaraErp[]> {
  const credencials = exigeixCredencials();
  const files = await llancaConsulta<Omit<AlbaraErp, "exercici">>(
    { ...credencials, exercici: String(exercici) },
    "SELECT TIPALB, CODALB, FECALB, CLIALB, ESTALB FROM F_ALB ORDER BY FECALB DESC, CODALB DESC",
  );
  return files.map((fila) => ({ ...fila, exercici }));
}

/** Les línies de F_LAL d'un exercici, amb les columnes que es copien. */
export async function llistaLiniesAlbaraDExercici(exercici: number): Promise<LiniaAlbaraErp[]> {
  const credencials = exigeixCredencials();
  const files = await llancaConsulta<Omit<LiniaAlbaraErp, "exercici">>(
    { ...credencials, exercici: String(exercici) },
    "SELECT TIPLAL, CODLAL, POSLAL, ARTLAL, DESLAL, CANLAL, PRELAL, DT1LAL, TOTLAL FROM F_LAL",
  );
  return files.map((fila) => ({ ...fila, exercici }));
}

/** F_TCL sencera: els tipus de client, que al CRM tenen taula pròpia. */
export async function llistaTipusClientPerSincronitzar(): Promise<TipusClientErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<TipusClientErp>(credencials, "SELECT CODTCL, DESTCL FROM F_TCL ORDER BY CODTCL");
}

/** F_AGE sencera: els agents comercials, que al CRM tenen taula pròpia. */
export async function llistaAgentsPerSincronitzar(): Promise<AgentErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<AgentErp>(credencials, "SELECT CODAGE, NOMAGE FROM F_AGE ORDER BY CODAGE");
}

/** Columnes de F_PRO que el portal fa servir: les que identifiquen el proveïdor i les que copia. */
const COLUMNES_PROVEIDOR = [
  "CODPRO", "TIPPRO", "NIFPRO", "NOFPRO", "NOCPRO", "DOMPRO", "CPOPRO", "POBPRO", "PROPRO",
  "TELPRO", "EMAPRO", "PCOPRO", "FPAPRO", "ESTPRO", "FALPRO",
].join(", ");

/**
 * Els proveïdors homologats de F_PRO, que són els cellers de qui es compra.
 *
 * HOMPRO és la casella «Proveedor homologado» de la pestanya «Otros datos» de
 * FactuSol. Al portal només hi entren aquests: la taula sencera també porta
 * transportistes, gestories i subministraments, que no tenen res a veure amb
 * l'acció comercial. Es porten totes les columnes que es copien i sense
 * paginar: es vol la foto sencera dels que compten.
 */
export async function llistaProveidorsPerSincronitzar(): Promise<ProveidorErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<ProveidorErp>(
    credencials,
    `SELECT ${COLUMNES_PROVEIDOR}, PAIPRO, MOVPRO, WEBPRO, OBSPRO, SWFPRO, SWIPRO, BANPRO, CCEPRO, RETPRO, DP1PRO, FUMPRO, HOMPRO` +
      " FROM F_PRO WHERE HOMPRO = 1 ORDER BY CODPRO",
  );
}

/** Quants proveïdors hi ha a F_PRO i quants estan homologats, per a la comprovació de connexió. */
export async function comptaProveidors() {
  const credencials = exigeixCredencials();
  const files = await llancaConsulta<{ CODPRO: number; HOMPRO: number }>(
    credencials,
    "SELECT CODPRO, HOMPRO FROM F_PRO",
  );
  return { total: files.length, homologats: files.filter((fila) => Number(fila.HOMPRO) === 1).length };
}

/** Columnes de F_ART que el portal fa servir, en l'ordre del tipus `Article`. */
const COLUMNES_ARTICLE = [
  "CODART", "DESART", "FAMART", "EANART", "PHAART", "REFART", "FALART", "IMGART",
  "GARART", "CP1ART", "CP2ART", "CP3ART", "CP4ART", "CP5ART",
  ...MARQUES_ARTICLE_INACTIU.map((marca) => marca.columna),
].join(", ");

/**
 * Tot F_ART, sense paginar: la foto sencera per a la sincronització, amb les
 * marques que diuen si l'article és un històric (vegeu
 * `esArticleHistoric`) hi van tots: un vi que ja no es ven encara surt als
 * albarans i a les compres de cada client. Un article esborrat de F_ART deixa
 * de venir i la passada el marca absent.
 */
export async function llistaArticlesPerSincronitzar(): Promise<Article[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<Article>(credencials, `SELECT ${COLUMNES_ARTICLE} FROM F_ART ORDER BY CODART`);
}

/**
 * Quants articles hi ha a F_ART i quants en marca cada casella d'històric, per
 * dir a Configuració quants són actius i quants no. Un article pot tenir les dues.
 */
export async function comptaArticles() {
  const credencials = exigeixCredencials();
  const columnes = MARQUES_ARTICLE_INACTIU.map((marca) => marca.columna);
  const [files, ambFoto] = await Promise.all([
    llancaConsulta<Record<string, unknown>>(
      credencials,
      `SELECT ${columnes.join(", ")}, COUNT(*) AS N FROM F_ART GROUP BY ${columnes.join(", ")}`,
    ),
    llancaConsulta<{ N: number }>(credencials, `SELECT COUNT(*) AS N FROM F_ART WHERE ${ARTICLE_ACTIU} AND IMGART <> ''`),
  ]);
  const marcada = (fila: Record<string, unknown>, columna: string) => Number(fila[columna] ?? 0) !== 0;
  const suma = (quines: Record<string, unknown>[]) => quines.reduce((total, fila) => total + Number(fila.N ?? 0), 0);
  return {
    total: suma(files),
    actius: suma(files.filter((fila) => columnes.every((columna) => !marcada(fila, columna)))),
    /** Dels actius, quants tenen foto a FactuSol. */
    ambFoto: Number(ambFoto[0]?.N ?? 0),
    perMarca: MARQUES_ARTICLE_INACTIU.map((marca) => ({
      ...marca,
      quants: suma(files.filter((fila) => marcada(fila, marca.columna))),
    })),
  };
}

/**
 * Les fotos d'un article, amb el fitxer en base64. És una crida pròpia de
 * l'API, no una consulta: filtra per un tram d'articles, de famílies i de dates,
 * i aquí es demana un sol article amb els altres dos trams oberts. Les famílies
 * van de "" a "ZZZ", com a l'exemple de DELSOL.
 */
export async function llegeixImatgesArticle(codi: string): Promise<ImatgeArticleErp[]> {
  const credencials = exigeixCredencials();
  return demanaFiles<ImatgeArticleErp>(credencials, "/admin/ArticulosImagen", {
    ejercicio: credencials.exercici,
    articuloInicial: codi,
    articuloFinal: codi,
    articuloFamiliaInicial: "",
    articuloFamiliaFinal: "ZZZ",
    articuloFechaInicial: "1900-01-01",
    articuloFechaFinal: "2099-12-31",
  });
}

/** Els percentatges d'IVA de la configuració (la posició és TIVART), que canvien poc: es guarden una estona. */
let memoriaIva: { percentatges: number[]; expira: number } | null = null;

async function percentatgesIva(credencials: ReturnType<typeof exigeixCredencials>) {
  if (memoriaIva && memoriaIva.expira > Date.now()) return memoriaIva.percentatges;
  const files = await llancaConsulta<{ CODCFG: string; NUMCFG: number }>(
    credencials,
    "SELECT CODCFG, NUMCFG FROM F_CFG WHERE CODCFG LIKE 'ImpuestosIvasPrimerPeriodo%'",
  );
  const percentatges: number[] = [];
  for (const fila of files) {
    const posicio = Number(/(\d+)$/.exec(fila.CODCFG)?.[1]);
    if (posicio >= 1) percentatges[posicio - 1] = Number(fila.NUMCFG) || 0;
  }
  memoriaIva = { percentatges, expira: Date.now() + 60 * 60 * 1000 };
  return percentatges;
}

/** El que cal saber de FactuSol per posar preu a uns articles per a un client (vegeu `domini/preu-factusol.ts`). */
export type CondicionsDePreu = {
  tarifa: { codi: number; nom: string | null; ivaInclos: boolean };
  descompteClient: number;
  /** Per CODART: el preu de la tarifa. */
  pvp: Record<string, number>;
  /** Per CODART: el tipus d'IVA (TIVART). */
  tipusIva: Record<string, number>;
  /** Per CODART: el preu o el descompte especial del client. */
  especials: Record<string, { tipus: 0 | 1; valor: number }>;
  percentatgesIva: number[];
};

/**
 * Tot el que FactuSol té per decidir el preu d'uns articles per a un client,
 * només d'aquell client i d'aquells articles: la seva tarifa i el seu descompte
 * de línia, els preus de la tarifa, si porta l'IVA inclòs, l'IVA de cada article
 * i les condicions especials. Sense client (un lead), `tarifaPerDefecte` i cap
 * descompte ni condició.
 */
export async function condicionsDePreu(client: number | null, codis: string[], tarifaPerDefecte: number): Promise<CondicionsDePreu> {
  const credencials = exigeixCredencials();
  const nets = [...new Set(codis.map((codi) => codi.trim()).filter(Boolean))];
  const llista = nets.map((codi) => `'${escapaSql(codi)}'`).join(", ") || "''";

  const [fitxa] = client
    ? await llancaConsulta<{ TARCLI: number; DT1CLI: number }>(credencials, `SELECT TARCLI, DT1CLI FROM F_CLI WHERE CODCLI = ${Number(client)}`)
    : [];
  const tarifa = Number(fitxa?.TARCLI) || (client ? 1 : tarifaPerDefecte);

  const [tarifes, preus, articles, especials, percentatges] = await Promise.all([
    llancaConsulta<{ DESTAR: string; IVATAR: number }>(credencials, `SELECT DESTAR, IVATAR FROM F_TAR WHERE CODTAR = ${tarifa}`),
    llancaConsulta<{ ARTLTA: string; PRELTA: number }>(credencials, `SELECT ARTLTA, PRELTA FROM F_LTA WHERE TARLTA = ${tarifa} AND ARTLTA IN (${llista})`),
    llancaConsulta<{ CODART: string; TIVART: number }>(credencials, `SELECT CODART, TIVART FROM F_ART WHERE CODART IN (${llista})`),
    client
      ? llancaConsulta<{ ARTPRC: string; PREPRC: number; TIPPRC: number }>(
          credencials,
          `SELECT ARTPRC, PREPRC, TIPPRC FROM F_PRC WHERE CLIPRC = ${Number(client)} AND ARTPRC IN (${llista})`,
        )
      : Promise.resolve([]),
    percentatgesIva(credencials),
  ]);

  const codi = (valor: unknown) => String(valor ?? "").trim();
  return {
    tarifa: { codi: tarifa, nom: tarifes[0]?.DESTAR?.trim() || null, ivaInclos: Number(tarifes[0]?.IVATAR) === 1 },
    descompteClient: Number(fitxa?.DT1CLI) || 0,
    pvp: Object.fromEntries(preus.filter((fila) => Number.isFinite(Number(fila.PRELTA))).map((fila) => [codi(fila.ARTLTA), Number(fila.PRELTA)])),
    tipusIva: Object.fromEntries(articles.map((fila) => [codi(fila.CODART), Number(fila.TIVART) || 0])),
    especials: Object.fromEntries(
      especials
        .filter((fila) => Number(fila.TIPPRC) === 0 || Number(fila.TIPPRC) === 1)
        .map((fila) => [codi(fila.ARTPRC), { tipus: Number(fila.TIPPRC) as 0 | 1, valor: Number(fila.PREPRC) || 0 }]),
    ),
    percentatgesIva: percentatges,
  };
}

/** Els preus d'una tarifa sencera, sense IVA, per als selectors de vins. */
export type PreusDeTarifa = {
  tarifa: { codi: number; nom: string | null; ivaInclos: boolean };
  /** Per CODART: el preu de la tarifa, sense IVA. */
  preus: Record<string, number>;
};

/**
 * Tots els preus d'una tarifa (F_LTA), ja sense IVA: si la tarifa el porta
 * inclòs (F_TAR.IVATAR), se li treu el de cada article (F_ART.TIVART), com
 * fa FactuSol a l'albarà. Sense condicions de cap client: és el preu de
 * llista, el que serveix per comparar vins.
 */
export async function preusDeTarifa(tarifa: number): Promise<PreusDeTarifa> {
  const credencials = exigeixCredencials();
  const codiTarifa = Number(tarifa) || 1;
  const [tarifes, preus, articles, percentatges] = await Promise.all([
    llancaConsulta<{ DESTAR: string; IVATAR: number }>(credencials, `SELECT DESTAR, IVATAR FROM F_TAR WHERE CODTAR = ${codiTarifa}`),
    llancaConsulta<{ ARTLTA: string; PRELTA: number }>(credencials, `SELECT ARTLTA, PRELTA FROM F_LTA WHERE TARLTA = ${codiTarifa}`),
    llancaConsulta<{ CODART: string; TIVART: number }>(credencials, "SELECT CODART, TIVART FROM F_ART"),
    percentatgesIva(credencials),
  ]);
  const ivaInclos = Number(tarifes[0]?.IVATAR) === 1;
  const tipusIva = new Map(articles.map((fila) => [String(fila.CODART ?? "").trim(), Number(fila.TIVART) || 0]));
  const senseIva: Record<string, number> = {};
  for (const fila of preus) {
    const codi = String(fila.ARTLTA ?? "").trim();
    const pvp = Number(fila.PRELTA);
    if (!codi || !Number.isFinite(pvp)) continue;
    senseIva[codi] = ivaInclos ? pvp / (1 + percentatgeDeTipus(tipusIva.get(codi) ?? 0, percentatges) / 100) : pvp;
  }
  return { tarifa: { codi: codiTarifa, nom: tarifes[0]?.DESTAR?.trim() || null, ivaInclos }, preus: senseIva };
}

/**
 * L'estoc de tots els articles, per magatzem (F_STO), i els magatzems (F_ALM).
 * Només les files que diuen alguna cosa: a F_STO hi ha una fila per article i
 * magatzem, també les buides, i són vuit per article.
 */
export async function llistaEstoc(): Promise<{ estoc: EstocErp[]; magatzems: MagatzemErp[] }> {
  const credencials = exigeixCredencials();
  const [estoc, magatzems] = await Promise.all([
    llancaConsulta<EstocErp>(credencials, "SELECT ARTSTO, ALMSTO, ACTSTO, DISSTO FROM F_STO WHERE ACTSTO <> 0 OR DISSTO <> 0"),
    llancaConsulta<MagatzemErp>(credencials, "SELECT CODALM, NOMALM FROM F_ALM"),
  ]);
  return { estoc, magatzems };
}

export async function obtenirClient(codi: number, agent?: number | null): Promise<Client | null> {
  const credencials = exigeixCredencials();

  const files = await llancaConsulta<Client>(
    credencials,
    `SELECT ${COLUMNES} FROM F_CLI WHERE CODCLI = ${Number(codi)} AND ${SENSE_BAIXA}${perAgent(agent)}`,
  );
  return files[0] ?? null;
}

/**
 * F_OBR sencera: les direccions d'entrega dels clients, que al portal són els
 * seus establiments. La taula no té estat; els dels clients de baixa els deixa
 * fora la sincronització, que sap quins clients surten al CRM.
 */
export async function llistaEstablimentsPerSincronitzar(): Promise<EstablimentErp[]> {
  const credencials = exigeixCredencials();
  return llancaConsulta<EstablimentErp>(
    credencials,
    "SELECT CLIOBR, CODOBR, NOMOBR, DIROBR, POBOBR, CPOOBR, PROOBR, PAIOBR, TELOBR, PCOOBR, EMAOBR, REPOBR FROM F_OBR ORDER BY CLIOBR, CODOBR",
  );
}

export { ErrorFactusol } from "./errors";
export type { Article, Client, ClientResum, LlistaClients, LlistaClientsResum, Proveidor, ProveidorResum, LlistaProveidorsResum };
