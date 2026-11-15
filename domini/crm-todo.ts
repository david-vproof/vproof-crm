/**
 * La pantalla de To-Do: tot el que queda per fer, de tots els clients, amb
 * d'on surt i de qui és.
 *
 * Un To-Do neix en tancar una activitat (vegeu `crm-deures.ts`) o s'apunta a la
 * fitxa del client, i hi viu fins que es marca. Aquí es miren tots junts, i la pregunta
 * canvia: ja no és «què li dec a aquest client» sinó «què em toca fer primer».
 * Per això s'agrupen per venciment —el que ja ha vençut, el d'avui, el de la
 * setmana— i, dins de cada grup, mana la prioritat. També es poden mirar per
 * client, que és com es despatxen a la carretera: tot el d'un compte de cop.
 *
 * Tot és càlcul pur. Les dates arriben ja com a claus de dia (AAAA-MM-DD) i
 * «avui» es passa des de fora, que és qui sap quin dia és.
 */
import type { Lletra } from "./crm-fitxes";

export type ToDo = {
  id: string;
  text: string;
  descripcio: string;
  /** Fet o cancel·lat: ja no queda per fer. */
  fet: boolean;
  estat: string;
  prioritat: string;
  /** Clau de dia, o buit si no en té. */
  venciment: string;
  /** Quan es va tancar, com a clau de dia. Buit mentre és pendent. */
  completadaEl: string;
  /** Quan es va crear, com a clau de dia. */
  creatEl: string;
  responsable: { id: string; nom: string } | null;
  /** L'activitat que el va deixar. Un To-Do apuntat a mà, a la fitxa o a Directus, no en té. */
  activitat: {
    id: string;
    assumpte: string;
    dia: string;
    hora: string;
    /** El tipus pel seu nom, no pel valor desat. */
    tipus: string;
    resultat: string;
    tancada: boolean;
  } | null;
  /** De qui és: un client o, si encara no compra, un lead. */
  compte: {
    mena: "client" | "lead";
    id: string;
    nom: string;
    poblacio: string;
    telefon: string;
    categoria: Lletra | null;
    potencial: Lletra | null;
    /** El resum de facturació del client, per pintar-lo com a la resta de llistes. Nul en un lead. */
    facturacio: Record<string, unknown> | null;
  } | null;
  oportunitat: { id: string; titol: string; etapa: string } | null;
};

// ---------------------------------------------------------------- venciment

export type Termini = "vencut" | "avui" | "setmana" | "mes_endavant" | "sense";

export const TERMINIS: { clau: Termini; titol: string; nota: string }[] = [
  { clau: "vencut", titol: "Vençuts", nota: "Ja haurien d'estar fets." },
  { clau: "avui", titol: "Avui", nota: "Vencen avui." },
  { clau: "setmana", titol: "Aquesta setmana", nota: "Vencen en els propers set dies." },
  { clau: "mes_endavant", titol: "Més endavant", nota: "Encara hi ha marge." },
  { clau: "sense", titol: "Sense venciment", nota: "Es marquen a la propera visita del client." },
];

const DIA_MS = 24 * 60 * 60 * 1000;

function instantDelDia(clau: string): number | null {
  const trossos = /^(\d{4})-(\d{2})-(\d{2})/.exec(clau);
  if (!trossos) return null;
  const instant = Date.UTC(Number(trossos[1]), Number(trossos[2]) - 1, Number(trossos[3]));
  return Number.isNaN(instant) ? null : instant;
}

/** Quants dies falten fins al venciment: negatiu si ja ha passat. Nul si no en té o no s'entén. */
export function diesFins(venciment: string, avui: string): number | null {
  const fi = instantDelDia(venciment);
  const ara = instantDelDia(avui);
  if (fi === null || ara === null) return null;
  return Math.round((fi - ara) / DIA_MS);
}

export function terminiDe(venciment: string, avui: string): Termini {
  const dies = diesFins(venciment, avui);
  if (dies === null) return "sense";
  if (dies < 0) return "vencut";
  if (dies === 0) return "avui";
  if (dies <= 7) return "setmana";
  return "mes_endavant";
}

const diaSetmana = new Intl.DateTimeFormat("ca-ES", { timeZone: "UTC", weekday: "long" });

/** «12/10», o «12/10/2027» si no és d'enguany. */
export function diaCurt(clau: string, avui = "") {
  const trossos = /^(\d{4})-(\d{2})-(\d{2})/.exec(clau);
  if (!trossos) return "";
  const [, any, mes, dia] = trossos;
  const mateixAny = avui.slice(0, 4) === any;
  return `${Number(dia)}/${Number(mes)}${mateixAny || !avui ? "" : `/${any}`}`;
}

/**
 * Com es diu el venciment en una frase: «Venç avui», «Vençut fa 3 dies»,
 * «Venç dijous 30/10». Fins a una setmana vista es diu el dia de la setmana,
 * que és com es pensa la feina propera; més enllà, només la data.
 */
export function etiquetaVenciment(venciment: string, avui: string): string {
  const dies = diesFins(venciment, avui);
  if (dies === null) return "";
  if (dies < -1) return `Vençut fa ${-dies} dies`;
  if (dies === -1) return "Vençut des d'ahir";
  if (dies === 0) return "Venç avui";
  if (dies === 1) return "Venç demà";
  if (dies <= 6) return `Venç ${diaSetmana.format(new Date(instantDelDia(venciment) ?? 0))} ${diaCurt(venciment, avui)}`;
  return `Venç el ${diaCurt(venciment, avui)}`;
}

// -------------------------------------------------------------------- ordre

/** Prioritats de tasca, de la que crema més a la que menys. */
const ORDRE_PRIORITAT: Record<string, number> = { alta: 0, normal: 1, baixa: 2 };

function pesPrioritat(prioritat: string) {
  return ORDRE_PRIORITAT[prioritat] ?? 1;
}

/** Els venciments buits van al final: el que té data pressiona més que el que no en té. */
function compararVenciment(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

/**
 * Els To-Do per pintar-los: primer el que queda per fer; després, la prioritat;
 * després, el venciment més proper; i, a igualtat, per client i per text, que
 * així els d'un mateix compte queden junts.
 */
export function ordenaToDos(todos: ToDo[]): ToDo[] {
  return [...todos].sort(
    (a, b) =>
      Number(a.fet) - Number(b.fet) ||
      pesPrioritat(a.prioritat) - pesPrioritat(b.prioritat) ||
      compararVenciment(a.venciment, b.venciment) ||
      (a.compte?.nom ?? "").localeCompare(b.compte?.nom ?? "", "ca") ||
      a.text.localeCompare(b.text, "ca"),
  );
}

/** Els fets, el més recent primer: el que s'acaba de tancar és el que es vol repassar. */
export function ordenaFets(todos: ToDo[]): ToDo[] {
  return [...todos].sort(
    (a, b) =>
      b.completadaEl.localeCompare(a.completadaEl) ||
      b.creatEl.localeCompare(a.creatEl) ||
      a.text.localeCompare(b.text, "ca"),
  );
}

// ------------------------------------------------------------------- grups

export type Agrupament = "venciment" | "compte";

export function llegeixAgrupament(brut: unknown): Agrupament {
  return brut === "compte" ? "compte" : "venciment";
}

export type GrupToDo = {
  /** Per a l'àncora i la clau: el termini, o l'id del compte. */
  clau: string;
  titol: string;
  nota: string;
  /** El compte del grup, quan s'agrupa per client. */
  compte: ToDo["compte"];
  todos: ToDo[];
};

/** Els grups per venciment, en l'ordre dels terminis i només els que tenen alguna cosa. */
export function agrupaPerVenciment(todos: ToDo[], avui: string): GrupToDo[] {
  const ordenats = ordenaToDos(todos);
  return TERMINIS.map((termini) => ({
    clau: termini.clau,
    titol: termini.titol,
    nota: termini.nota,
    compte: null,
    todos: ordenats.filter((todo) => terminiDe(todo.venciment, avui) === termini.clau),
  })).filter((grup) => grup.todos.length > 0);
}

/** El venciment més proper d'un grup, per posar al davant el client que més pressa té. */
function urgencia(grup: ToDo[], avui: string): number {
  const dies = grup.map((todo) => diesFins(todo.venciment, avui)).filter((d): d is number => d !== null);
  return dies.length > 0 ? Math.min(...dies) : Number.POSITIVE_INFINITY;
}

/**
 * Els grups per client: el que més pressa té al davant i, a igualtat, per nom.
 * Els To-Do sense client van en un grup al final: són els pocs que s'han fet a
 * mà i no han sortit de cap visita.
 */
export function agrupaPerCompte(todos: ToDo[], avui: string): GrupToDo[] {
  const ordenats = ordenaToDos(todos);
  const grups = new Map<string, GrupToDo>();

  for (const todo of ordenats) {
    const clau = todo.compte ? `${todo.compte.mena}:${todo.compte.id}` : "sense-compte";
    let grup = grups.get(clau);
    if (!grup) {
      grup = {
        clau,
        titol: todo.compte?.nom || "Sense client",
        nota: todo.compte ? "" : "Fets a mà, sense cap visita al darrere.",
        compte: todo.compte,
        todos: [],
      };
      grups.set(clau, grup);
    }
    grup.todos.push(todo);
  }

  return [...grups.values()].sort((a, b) => {
    if (!a.compte !== !b.compte) return a.compte ? -1 : 1;
    return urgencia(a.todos, avui) - urgencia(b.todos, avui) || a.titol.localeCompare(b.titol, "ca");
  });
}

// -------------------------------------------------------------------- resum

export type ResumToDo = {
  pendents: number;
  vencuts: number;
  avui: number;
  setmana: number;
  sense: number;
  /** Els de prioritat alta encara pendents. */
  alta: number;
  /** Quants clients (o leads) diferents hi tenen alguna cosa. */
  comptes: number;
};

export function resumToDos(todos: ToDo[], avui: string): ResumToDo {
  const pendents = todos.filter((todo) => !todo.fet);
  const terminis = pendents.map((todo) => terminiDe(todo.venciment, avui));
  return {
    pendents: pendents.length,
    vencuts: terminis.filter((t) => t === "vencut").length,
    avui: terminis.filter((t) => t === "avui").length,
    setmana: terminis.filter((t) => t === "setmana").length,
    sense: terminis.filter((t) => t === "sense").length,
    alta: pendents.filter((todo) => todo.prioritat === "alta").length,
    comptes: new Set(pendents.filter((t) => t.compte).map((t) => `${t.compte?.mena}:${t.compte?.id}`)).size,
  };
}
