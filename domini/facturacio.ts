/**
 * La facturació dels clients: què es porta de FactuSol i quines xifres se
 * n'ensenyen. Tot és càlcul pur.
 *
 * FactuSol té una base de dades per exercici, així que la facturació es llegeix
 * any per any. Es guarda per client i mes —la base imposable i quantes
 * factures— i les xifres de la fitxa es calculen en el moment: així «fins al
 * mes passat» avança sol quan canvia el mes, sense tornar a sincronitzar.
 *
 * A l'any en curs, la base també porta els albarans encara no facturats: el que
 * s'ha servit i potser no es factura fins més endavant, o mai. Els exercicis
 * anteriors només porten factures, i cada passada ho torna a calcular tot, així
 * que quan l'any tanca els seus mesos es queden sols amb el que es va facturar.
 */
import { ZONA } from "./crm-planner";
import { tendenciaDe, type ResumClient } from "./facturacio-tendencia";

/** Quants exercicis enrere es guarden, a més de l'actual. */
export const ANYS_ENRERE = 2;

export const NOM_MES = [
  "gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

/** Una fila de F_FAC agrupada per client i mes. */
export type FilaFacturacioErp = { CLIFAC: number; MES: number; N: number; BASE: number };

/** Els albarans de F_ALB sense facturar, agrupats per client i mes. */
export type FilaAlbaransErp = { CLIALB: number; MES: number; BASE: number };

/** Un mes facturat d'un client, tal com es desa a `crm_facturacio`. */
export type MesFacturat = { codi_client_erp: number; exercici: number; mes: number; base: number; factures: number };

export type FilaFacturacio = MesFacturat & { id: string; client: string | null };

/** L'any i el mes d'avui al fus de la bodega. */
export function avuiLocal(ara: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit" }).formatToParts(ara);
  const de = (tipus: string) => Number(parts.find((part) => part.type === tipus)?.value);
  return { any: de("year"), mes: de("month") };
}

/** Els exercicis que es porten, del més antic a l'actual. */
export function exercicisDeFacturacio(ara: Date) {
  const { any } = avuiLocal(ara);
  return Array.from({ length: ANYS_ENRERE + 1 }, (_, i) => any - ANYS_ENRERE + i);
}

const centims = (valor: number) => Math.round(valor * 100) / 100;

/** Els mesos d'un exercici a partir de F_FAC agrupada. Les factures sense client no compten. */
export function mesosDeFactusol(exercici: number, files: FilaFacturacioErp[]): MesFacturat[] {
  return files
    .filter((fila) => Number(fila.CLIFAC) > 0 && Number(fila.MES) >= 1 && Number(fila.MES) <= 12)
    .map((fila) => ({
      codi_client_erp: Number(fila.CLIFAC),
      exercici,
      mes: Number(fila.MES),
      base: centims(Number(fila.BASE) || 0),
      factures: Number(fila.N) || 0,
    }));
}

const clau = (fila: { codi_client_erp: number; exercici: number; mes: number }) =>
  `${Number(fila.codi_client_erp)}|${Number(fila.exercici)}|${Number(fila.mes)}`;

/**
 * Hi suma els albarans encara no facturats, cadascun al mes de l'albarà. Un mes
 * amb albarans i cap factura també surt, amb `factures` a zero.
 */
export function ambAlbaransPendents(exercici: number, mesos: MesFacturat[], albarans: FilaAlbaransErp[]): MesFacturat[] {
  const perMes = new Map(mesos.map((mes) => [clau(mes), mes]));
  const pendents = mesosDeFactusol(exercici, albarans.map((fila) => ({ CLIFAC: fila.CLIALB, MES: fila.MES, N: 0, BASE: fila.BASE })));
  for (const pendent of pendents) {
    const facturat = perMes.get(clau(pendent));
    perMes.set(clau(pendent), facturat ? { ...facturat, base: centims(facturat.base + pendent.base) } : pendent);
  }
  return [...perMes.values()];
}

export type DiferenciesFacturacio = {
  crear: (MesFacturat & { client: string })[];
  actualitzar: { id: string; base: number; factures: number; client: string }[];
  esborrar: string[];
  iguals: number;
};

/**
 * Compara el que diu l'ERP amb el que hi ha a Directus.
 *
 * `clients` va del codi d'ERP a l'id de la fitxa del client: el mes d'un client
 * que no és al CRM (un de baixa, posem) no es desa, i si ja hi era, s'esborra.
 *
 * `exercicisLlegits` són els que han respost: les files d'un exercici que no
 * s'ha pogut llegir es deixen com estan, perquè no se sap si encara hi són. Les
 * d'exercicis anteriors a `primerExercici`, que ja queden fora, s'esborren.
 */
export function diferenciesFacturacio(
  erp: MesFacturat[],
  directus: FilaFacturacio[],
  clients: Map<number, string>,
  exercicisLlegits: number[],
  primerExercici: number,
): DiferenciesFacturacio {
  const existents = new Map<string, FilaFacturacio>();
  const esborrar: string[] = [];
  for (const fila of directus) {
    const k = clau(fila);
    // Un mes repetit a Directus només pot ser un error: se'n queda un.
    if (existents.has(k)) esborrar.push(fila.id);
    else existents.set(k, fila);
  }

  const crear: DiferenciesFacturacio["crear"] = [];
  const actualitzar: DiferenciesFacturacio["actualitzar"] = [];
  const vistos = new Set<string>();
  let iguals = 0;

  for (const mes of erp) {
    const client = clients.get(mes.codi_client_erp);
    if (!client) continue;
    const k = clau(mes);
    vistos.add(k);
    const actual = existents.get(k);
    if (!actual) {
      crear.push({ ...mes, client });
    } else if (centims(Number(actual.base)) === mes.base && Number(actual.factures) === mes.factures && actual.client === client) {
      iguals += 1;
    } else {
      actualitzar.push({ id: actual.id, base: mes.base, factures: mes.factures, client });
    }
  }

  for (const [k, fila] of existents) {
    if (vistos.has(k)) continue;
    const exercici = Number(fila.exercici);
    if (exercici < primerExercici || exercicisLlegits.includes(exercici)) esborrar.push(fila.id);
  }

  return { crear, actualitzar, esborrar, iguals };
}

export type ExerciciResumit = {
  exercici: number;
  /** L'exercici sencer (el de l'any en curs, fins avui). */
  total: number;
  /** De gener fins a l'últim mes tancat de l'any en curs. */
  finsMes: number;
};

export type ResumFacturacio = {
  /** L'últim mes tancat de l'any en curs: 0 al gener, que encara no n'hi ha cap. */
  finsMes: number;
  /** Del més antic a l'actual. */
  exercicis: ExerciciResumit[];
};

/**
 * Les xifres de la fitxa: cada exercici sencer i el que porta de gener fins al
 * mes passat, per comparar l'any en curs amb el mateix tros dels anteriors.
 */
export function resumFacturacio(mesos: { exercici: number | string; mes: number | string; base: number | string }[], ara: Date): ResumFacturacio {
  const { mes } = avuiLocal(ara);
  const finsMes = mes - 1;
  const suma = (llista: typeof mesos) => centims(llista.reduce((total, fila) => total + (Number(fila.base) || 0), 0));

  return {
    finsMes,
    exercicis: exercicisDeFacturacio(ara).map((exercici) => {
      const seus = mesos.filter((fila) => Number(fila.exercici) === exercici);
      return { exercici, total: suma(seus), finsMes: suma(seus.filter((fila) => Number(fila.mes) <= finsMes)) };
    }),
  };
}

/** El resum que es desa a la fitxa del client per a la llista: vegeu `CAMPS_RESUM_FACTURACIO`. */
export function resumPerClient({ finsMes, exercicis }: ResumFacturacio): ResumClient {
  const [menys2, menys1, actual] = exercicis;
  const comparable = finsMes > 0 && menys1.finsMes > 0;
  return {
    facturacio_exercici: actual.exercici,
    facturacio_fins_mes: finsMes,
    facturacio_any_2: menys2.total,
    facturacio_any_1: menys1.total,
    facturacio_periode_2: menys2.finsMes,
    facturacio_periode_1: menys1.finsMes,
    facturacio_periode: actual.finsMes,
    facturacio_variacio: comparable ? centims(((actual.finsMes - menys1.finsMes) / menys1.finsMes) * 100) : null,
    facturacio_tendencia: tendenciaDe({
      finsMes,
      actual: actual.finsMes,
      anterior: menys1.finsMes,
      totalsAnteriors: Math.max(menys1.total, 0) + Math.max(menys2.total, 0),
    }),
  };
}

/** «gener–agost», o res si encara no hi ha cap mes tancat. */
export function nomPeriode(finsMes: number) {
  if (finsMes <= 0) return null;
  return finsMes === 1 ? "gener" : `gener–${NOM_MES[finsMes - 1]}`;
}
