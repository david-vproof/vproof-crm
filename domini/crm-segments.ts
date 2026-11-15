/**
 * Segmentació de comptes per criteris.
 *
 * Un segment no s'assigna fitxa per fitxa: es descriu amb condicions sobre les
 * variables del compte i, a partir d'aquí, qui hi encaixa hi entra sol. Això
 * vol dir que un compte canvia de segment quan canvien les seves dades, sense
 * que ningú l'hagi de tornar a tocar.
 *
 * Tot és càlcul pur: aquí no es llegeix ni s'escriu res.
 */
import { FITXES, MODES_SEGMENT, type Camp, type ClauFitxa, type TipusCamp } from "@/domini/crm-fitxes";
import { llegeixRegio, puntDinsRegio } from "@/domini/crm-mapa";

export type Operador =
  | "es"
  | "no_es"
  | "conte"
  | "comenca"
  | "algun_de"
  | "major"
  | "menor"
  | "abans"
  | "despres"
  | "buit"
  | "no_buit"
  /** La ubicació del client cau dins d'alguna de les regions dibuixades al mapa. */
  | "dins";

/**
 * `textos` només el porten les variables de relació: el valor és l'id de la
 * fitxa triada i el text és el que es llegeix als llistats, que no la tenen a mà.
 */
export type Criteri = { camp: string; operador: Operador; valors: string[]; textos?: string[] };

/** «tots» és una i lògica; «algun», una o. */
export type Mode = "tots" | "algun";

export type DefinicioSegment = { mode: Mode; criteris: Criteri[] };

export const MODES = MODES_SEGMENT as [Mode, string][];

/** Els tipus de camp sobre els quals té sentit filtrar. */
const TIPUS_FILTRABLES: TipusCamp[] = ["text", "tria", "nombre", "decimal", "import", "data"];

/** Camps que són dades tècniques i no diuen res del negoci. */
const EXCLOSOS = new Set(["latitud", "longitud"]);

export type Variable = {
  nom: string;
  etiqueta: string;
  /** «regio» és la ubicació: no és cap camp de la fitxa, sinó la latitud i la longitud dins d'unes regions. */
  tipus: TipusCamp | "regio";
  opcions?: [string, string][];
  operadors: Operador[];
  /** A quin catàleg apunta, si és una relació: les opcions surten de Directus. */
  relacio?: ClauFitxa;
  /** Què cal demanar a Directus: el camp, o l'id i el títol de la fitxa si és una relació. */
  camps: string[];
};

const OPERADORS_PER_TIPUS: Record<string, Operador[]> = {
  text: ["conte", "es", "comenca", "no_es", "buit", "no_buit"],
  tria: ["es", "algun_de", "no_es", "buit", "no_buit"],
  relacio: ["es", "algun_de", "no_es", "buit", "no_buit"],
  nombre: ["es", "major", "menor", "no_es", "buit", "no_buit"],
  decimal: ["es", "major", "menor", "no_es", "buit", "no_buit"],
  import: ["es", "major", "menor", "no_es", "buit", "no_buit"],
  data: ["despres", "abans", "es", "buit", "no_buit"],
};

export const ETIQUETA_OPERADOR: Record<Operador, string> = {
  es: "és",
  no_es: "no és",
  conte: "conté",
  comenca: "comença per",
  algun_de: "és un de",
  major: "més gran que",
  menor: "més petit que",
  abans: "abans de",
  despres: "a partir de",
  buit: "està buit",
  no_buit: "té valor",
  dins: "és dins de",
};

/** Els operadors que no demanen cap valor. */
export const SENSE_VALOR: Operador[] = ["buit", "no_buit"];

/**
 * Les variables del compte sobre les quals es pot segmentar. Surten de la
 * mateixa descripció de la fitxa, així que afegir un camp al compte el fa
 * filtrable sense tocar res més.
 *
 * Una relació amb un catàleg, com el tipus de client, és una variable de
 * relació: es tria d'un desplegable i es compara per id, igual que a Directus.
 */
const VARIABLES_DE_FITXA: Variable[] = FITXES.clients.camps
  .filter((camp: Camp) => {
    if (EXCLOSOS.has(camp.nom)) return false;
    if (camp.tipus === "relacio") return Boolean(camp.relacio && FITXES[camp.relacio].cataleg);
    return TIPUS_FILTRABLES.includes(camp.tipus);
  })
  .map((camp: Camp) => ({
    nom: camp.nom,
    etiqueta: camp.etiqueta,
    tipus: camp.tipus,
    opcions: camp.opcions,
    operadors: OPERADORS_PER_TIPUS[camp.tipus] ?? ["es", "no_es", "buit", "no_buit"],
    ...(camp.tipus === "relacio" && camp.relacio
      ? { relacio: camp.relacio, camps: [`${camp.nom}.id`, `${camp.nom}.${FITXES[camp.relacio].titol}`] }
      : { camps: [camp.nom] }),
  }));

/**
 * La ubicació: el client és dins d'alguna de les regions dibuixades al mapa.
 * Els valors del criteri són els contorns, en JSON. No es tria a l'editor de
 * criteris: la crea l'eina de regions del mapa.
 */
export const VARIABLE_UBICACIO: Variable = {
  nom: "ubicacio",
  etiqueta: "Ubicació",
  tipus: "regio",
  operadors: ["dins"],
  camps: ["latitud", "longitud"],
};

export const VARIABLES: Variable[] = [...VARIABLES_DE_FITXA, VARIABLE_UBICACIO];

/** Els camps que cal demanar a Directus per poder avaluar qualsevol segment. */
export const CAMPS_VARIABLES = VARIABLES.flatMap((v) => v.camps);

const SUFIX_TITOL = "__titol";

/**
 * Directus torna les relacions com a objecte ({ id, nom }). Es deixa l'id,
 * que és el que comparen els criteris, i el títol a part, per ensenyar-lo.
 */
export function aplanaVariables<T extends Record<string, unknown>>(fila: T): T {
  const plana: Record<string, unknown> = { ...fila };
  for (const variable of VARIABLES) {
    if (!variable.relacio) continue;
    const brut = fila[variable.nom];
    const objecte = brut && typeof brut === "object" ? (brut as Record<string, unknown>) : null;
    plana[variable.nom] = objecte?.id ?? null;
    plana[`${variable.nom}${SUFIX_TITOL}`] = objecte?.[FITXES[variable.relacio].titol] ?? null;
  }
  return plana as T;
}

/** El títol d'una relació d'una fila ja aplanada: el nom del tipus de client, posem. */
export function titolDeRelacio(fila: Record<string, unknown>, nom: string): string {
  const titol = fila[`${nom}${SUFIX_TITOL}`];
  return titol === null || titol === undefined ? "" : String(titol);
}

export function variable(nom: string) {
  return VARIABLES.find((v) => v.nom === nom);
}

/** Sense accents i en minúscules: «Osona» ha de trobar «osona» i «OSONA». */
function plana(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function esBuit(valor: unknown) {
  return valor === null || valor === undefined || String(valor).trim() === "";
}

function numero(valor: unknown) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Una data comparable, sigui una marca completa o només el dia. */
function dia(valor: unknown) {
  const text = String(valor ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function compleix(criteri: Criteri, compte: Record<string, unknown>): boolean {
  const brut = compte[criteri.camp];
  const primer = criteri.valors[0] ?? "";

  switch (criteri.operador) {
    case "buit":
      return esBuit(brut);
    case "no_buit":
      return !esBuit(brut);
    case "es":
      return plana(brut) === plana(primer);
    case "no_es":
      return plana(brut) !== plana(primer);
    case "conte":
      return plana(brut).includes(plana(primer));
    case "comenca":
      return plana(brut).startsWith(plana(primer));
    case "algun_de":
      return criteri.valors.some((valor) => plana(brut) === plana(valor));
    case "major": {
      const a = numero(brut);
      const b = numero(primer);
      return a !== null && b !== null && a > b;
    }
    case "menor": {
      const a = numero(brut);
      const b = numero(primer);
      return a !== null && b !== null && a < b;
    }
    case "abans": {
      const a = dia(brut);
      const b = dia(primer);
      return a !== null && b !== null && a < b;
    }
    case "despres": {
      const a = dia(brut);
      const b = dia(primer);
      return a !== null && b !== null && a >= b;
    }
    case "dins": {
      // Sense coordenades, un client no és enlloc.
      if (esBuit(compte.latitud) || esBuit(compte.longitud)) return false;
      const latitud = numero(compte.latitud);
      const longitud = numero(compte.longitud);
      if (latitud === null || longitud === null) return false;
      return criteri.valors.some((valor) => {
        const regio = llegeixRegio(valor);
        return regio !== null && puntDinsRegio(latitud, longitud, regio);
      });
    }
    default:
      return false;
  }
}

/**
 * Si un compte entra al segment. Un segment sense cap criteri no agrupa ningú:
 * val més que es vegi buit que no que s'ho empassi tot sense voler.
 */
export function pertany(definicio: DefinicioSegment, compte: Record<string, unknown>): boolean {
  const criteris = definicio.criteris.filter((criteri) => variable(criteri.camp));
  if (criteris.length === 0) return false;

  return definicio.mode === "algun"
    ? criteris.some((criteri) => compleix(criteri, compte))
    : criteris.every((criteri) => compleix(criteri, compte));
}

/** Neteja el que arriba de Directus: el JSON d'un camp lliure no és de fiar. */
export function llegeixCriteris(brut: unknown): Criteri[] {
  if (!Array.isArray(brut)) return [];

  const nets: Criteri[] = [];
  for (const fila of brut) {
    if (!fila || typeof fila !== "object") continue;
    const { camp, operador, valors, textos } = fila as Record<string, unknown>;
    if (typeof camp !== "string" || typeof operador !== "string") continue;
    const meta = variable(camp);
    if (!meta) continue;
    if (!(operador in ETIQUETA_OPERADOR)) continue;

    nets.push({
      camp,
      operador: operador as Operador,
      valors: Array.isArray(valors) ? valors.map((v) => String(v)) : [],
      ...(meta.relacio && Array.isArray(textos) ? { textos: textos.map((t) => String(t)) } : {}),
    });
  }
  return nets;
}

export function llegeixMode(brut: unknown): Mode {
  return brut === "algun" ? "algun" : "tots";
}

/** El criteri en paraules, per als llistats: «Població és Vic». */
export function descriuCriteri(criteri: Criteri) {
  const meta = variable(criteri.camp);
  const etiqueta = meta?.etiqueta ?? criteri.camp;
  const operador = ETIQUETA_OPERADOR[criteri.operador];
  if (SENSE_VALOR.includes(criteri.operador)) return `${etiqueta} ${operador}`;
  if (meta?.tipus === "regio") {
    const quantes = criteri.valors.length;
    return `${etiqueta} dins de ${quantes} ${quantes === 1 ? "regió" : "regions"} del mapa`;
  }

  // D'una relació, el nom que es va desar en triar-la; d'una tria, l'etiqueta de l'opció.
  const text = criteri.valors
    .map((valor, i) => criteri.textos?.[i] ?? meta?.opcions?.find(([v]) => v === valor)?.[1] ?? valor)
    .filter(Boolean)
    .join(", ");
  return `${etiqueta} ${operador} ${text || "…"}`;
}

export function descriuSegment(definicio: DefinicioSegment) {
  if (definicio.criteris.length === 0) return "Sense criteris";
  const unio = definicio.mode === "algun" ? " o " : " i ";
  return definicio.criteris.map(descriuCriteri).join(unio);
}
