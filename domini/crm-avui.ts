/**
 * L'agenda del dia: què toca avui, per hores.
 *
 * És la mirada curta del Planner. Allà es prepara la ruta d'un mes o d'una
 * setmana; aquí només hi ha el dia d'avui, en una sola columna i per ordre
 * d'hora, amb el que fa falta a la carretera: qui es visita, a quina hora, on
 * és, a quin telèfon i si a aquella hora el compte està obert.
 *
 * Tot és càlcul pur. Com al Planner, la feina delicada és el fus: el dia
 * comença i acaba segons l'hora d'aquí i no la del servidor, que a Cloud Run va
 * en UTC. Els marges de la consulta es deriven de la mitjanit local, així que
 * el tram és exacte i no fa falta cap coixí.
 */
import type { Lletra } from "@/domini/crm-fitxes";
import { disponibilitat, posicioDeData, type Disponibilitat, type Horari } from "@/domini/crm-horaris";
import { ZONA, instantDeLocal } from "@/domini/crm-planner";
import type { MarquesClient } from "./marques-client";

const DIA_MS = 24 * 60 * 60 * 1000;

const horaAqui = new Intl.DateTimeFormat("ca-ES", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Prioritats de tasca, de la que crema més a la que menys. */
const ORDRE_PRIORITAT: Record<string, number> = { alta: 0, normal: 1, baixa: 2 };

export type ActeAgenda = {
  id: string;
  /** Hora local, HH:MM. */
  hora: string;
  /** Hora de plegar, si l'activitat porta durada. Buida si no se sap. */
  fi: string;
  /** El tipus pel seu nom, no pel valor desat. */
  tipus: string;
  /** Si hi ha vi damunt la taula: cal endur-se'n mostres. */
  ambVi: boolean;
  assumpte: string;
  /** Qui es visita. */
  compte: string;
  /** Si encara és un lead i no un compte: no té lletres ni horari. */
  esLead: boolean;
  /** Les marques del client, si en té: la «!» dels To-Do i la «A» dels atributs. */
  marques: MarquesClient | null;
  /** Categoria (calculada) i potencial (posat a mà) del compte, d'A a E. */
  categoria: Lletra | null;
  potencial: Lletra | null;
  /** El resum de facturació del compte, per pintar-lo com a la resta de llistats. Nul en un lead. */
  facturacio: Record<string, unknown> | null;
  segmentId: string;
  segment: string;
  color: string;
  poblacio: string;
  telefon: string;
  /** Per qui s'ha de preguntar en arribar. */
  contacte: string;
  /** Com ha acabat. Buit mentre encara és oberta. */
  resultat: string;
  /** Si ja s'ha tancat. Una activitat passada i oberta és feina per fer. */
  tancada: boolean;
  properPas: string;
  /** Si el compte està obert a aquella hora, segons el seu horari comercial. */
  quan: Disponibilitat;
  /** Si l'hora ja ha passat: el que queda per fer va al davant. */
  passada: boolean;
};

export type TascaAgenda = {
  id: string;
  titol: string;
  compte: string;
  prioritat: string;
  /** Ni feta ni cancel·lada: és el que de debò queda per tancar avui. */
  pendent: boolean;
  estat: string;
};

export type Agenda = {
  /** Clau del dia, AAAA-MM-DD. */
  dia: string;
  /** «Dijous, 5 de setembre del 2026», per a la capçalera. */
  etiqueta: string;
  /** Hora d'aquí ara mateix, HH:MM. */
  ara: string;
  actes: ActeAgenda[];
  /** Quantes activitats ja han passat: entre elles i la resta va la ratlla de l'«ara». */
  passades: number;
  tasques: TascaAgenda[];
  /** Tasques que queden per tancar. */
  pendents: number;
  /** Activitats que ja han passat i encara ningú no ha tancat. */
  perTancar: number;
  /**
   * Si s'ha pogut escurçar l'agenda a la de qui té la sessió oberta. Amb les
   * credencials locals no hi ha ningú a qui lligar-la i surt la de tothom.
   */
  meves: boolean;
};

/** L'hora d'aquí ara mateix, no la del servidor. */
export function araAqui(ara = new Date()) {
  return horaAqui.format(ara);
}

/** «2026-09-05» → «Dijous, 5 de setembre del 2026». */
export function etiquetaDelDia(dia: string) {
  const quan = new Date(`${dia}T00:00:00Z`);
  if (Number.isNaN(quan.getTime())) return dia;
  const text = new Intl.DateTimeFormat("ca-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(quan);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * El tram en UTC que cobreix exactament un dia d'aquí, de mitjanit a mitjanit.
 * Es deriva de l'hora local i no del servidor: a l'estiu el dia comença a les
 * 22:00 UTC del dia abans i a l'hivern a les 23:00.
 */
export function margesDelDia(dia: string) {
  const seguent = new Date(new Date(`${dia}T00:00:00Z`).getTime() + DIA_MS).toISOString().slice(0, 10);
  // Si el dia no fos analitzable es cauria al tram en cru, que és el mateix
  // dia comptat en UTC: prou per no petar, encara que ballin un parell d'hores.
  return {
    desde: instantDeLocal(`${dia}T00:00`) ?? `${dia}T00:00:00.000Z`,
    fins: instantDeLocal(`${seguent}T00:00`) ?? `${seguent}T00:00:00.000Z`,
  };
}

/** «09:00» + 90 → «10:30». Es queda dins del dia. */
export function sumaMinuts(hora: string, minuts: number) {
  const [h, m] = hora.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = Math.min(23 * 60 + 59, h * 60 + m + minuts);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** La propera hora en punt, per encetar una activitat nova on som ara. */
export function properaHora(ara: string) {
  const hora = Number(ara.slice(0, 2));
  if (!Number.isFinite(hora)) return "09:00";
  return `${String(Math.min(23, hora + 1)).padStart(2, "0")}:00`;
}

/**
 * Si el compte està obert a l'hora de la visita. Un lead no té horari, i un
 * compte que no l'ha informat tampoc: en tots dos casos no hi ha res a avisar.
 */
export function disponibilitatDe(horari: Horari | null, dia: string, hora: string): Disponibilitat {
  if (!horari) return "sense_horari";
  const posicio = posicioDeData(dia);
  return posicio === null ? "sense_horari" : disponibilitat(horari, posicio, hora);
}

/**
 * L'agenda muntada: les activitats per ordre d'hora, les tasques per prioritat
 * i el recompte del que ja ha passat, que és el que situa la ratlla de l'«ara».
 */
export function construeixAgenda(
  dia: string,
  actes: ActeAgenda[],
  tasques: TascaAgenda[],
  { ara = araAqui(), meves = false } = {},
): Agenda {
  const ordenats = [...actes].sort((a, b) => a.hora.localeCompare(b.hora) || a.compte.localeCompare(b.compte, "ca"));
  const marcats = ordenats.map((acte) => ({ ...acte, passada: acte.hora < ara }));

  return {
    dia,
    etiqueta: etiquetaDelDia(dia),
    ara,
    actes: marcats,
    passades: marcats.filter((acte) => acte.passada).length,
    // Passada i oberta: es va fer i ningú no hi ha dit com ha anat.
    perTancar: marcats.filter((acte) => acte.passada && !acte.tancada).length,
    tasques: [...tasques].sort(
      (a, b) =>
        Number(b.pendent) - Number(a.pendent) ||
        (ORDRE_PRIORITAT[a.prioritat] ?? 1) - (ORDRE_PRIORITAT[b.prioritat] ?? 1) ||
        a.titol.localeCompare(b.titol, "ca"),
    ),
    pendents: tasques.filter((tasca) => tasca.pendent).length,
    meves,
  };
}
