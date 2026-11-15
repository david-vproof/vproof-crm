/**
 * La facturació dels clients: quines xifres se n'ensenyen. Tot és càlcul pur.
 *
 * Es guarda per client i mes —la base imposable i quantes factures— i les
 * xifres de la fitxa es calculen en el moment: així «fins al mes passat»
 * avança sol quan canvia el mes. Les dades les portarà l'ERP.
 */
import { ZONA } from "./crm-planner";
import { tendenciaDe, type ResumClient } from "./facturacio-tendencia";

/** Quants exercicis enrere es guarden, a més de l'actual. */
export const ANYS_ENRERE = 2;

export const NOM_MES = [
  "gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre",
];

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
