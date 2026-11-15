/**
 * Vocabulari i formes del CRM.
 *
 * Viu al domini perquè el comparteixen tres móns que no s'han de conèixer
 * entre ells: les dades sintètiques de `demo/`, la lectura de Directus a
 * `apis/` i els càlculs de `domini/crm-analitica.ts`.
 */
export const ETAPES = ["Contacte", "Qualificada", "Tast", "Proposta", "Negociació"] as const;
export const ETAPES_TANCADES = ["Guanyada", "Perduda"] as const;

export type Etapa = (typeof ETAPES)[number] | (typeof ETAPES_TANCADES)[number];

export const PROBABILITAT: Record<Etapa, number> = {
  Contacte: 10,
  Qualificada: 25,
  Tast: 45,
  Proposta: 60,
  Negociació: 80,
  Guanyada: 100,
  Perduda: 0,
};

export type Origen = "Fira" | "Recomanació" | "Web" | "Prospecció" | "Client existent" | "Xarxes socials";

export const TIPUS_ACTIVITAT = [
  "Visita",
  "Visita amb vi",
  "Visita de celler a client",
  "Visita al celler",
  "Trucada",
  "Correu",
  "Tast",
  "Reunió",
  // Els creats a Configuració que no són visites.
  "Altres",
] as const;

export type TipusActivitat = (typeof TIPUS_ACTIVITAT)[number];

/** Sense desplaçament: serveixen per mesurar el treball de despatx. */
export const TIPUS_REMOTS: readonly TipusActivitat[] = ["Trucada", "Correu"];
/** Cara a cara amb el client. */
export const TIPUS_PRESENCIALS: readonly TipusActivitat[] = [
  "Visita",
  "Visita amb vi",
  "Visita de celler a client",
  "Visita al celler",
  "Tast",
  "Reunió",
];
/** Amb vi damunt la taula: el que de debò mou una carta. */
export const TIPUS_AMB_VI: readonly TipusActivitat[] = ["Visita amb vi", "Visita de celler a client", "Visita al celler", "Tast"];

export type Oportunitat = {
  id: string;
  titol: string;
  compte: string;
  clientId: number | null;
  canal: string;
  etapa: Etapa;
  valor: number;
  probabilitat: number;
  agent: number;
  obertaEl: string;
  tancamentPrevist: string;
  tancadaEl: string | null;
  /**
   * Fins a quina etapa va arribar (índex dins d'ETAPES; la longitud sencera
   * vol dir que es va tancar guanyada). Sense això no es pot dibuixar l'embut,
   * perquè d'una oportunitat perduda només se'n sap l'estat final.
   */
  etapaAssolida: number;
  origen: Origen;
  poblacio: string;
  contacte: string;
};

export type Activitat = {
  id: string;
  data: string;
  tipus: TipusActivitat;
  compte: string;
  oportunitatId: string | null;
  agent: number;
  resum: string;
  /** Només a les activitats amb vi: de quin celler i quines referències. */
  celler?: string | null;
  referencies?: string | null;
  assistents?: number | null;
};

export type Tasca = {
  id: string;
  titol: string;
  venciment: string;
  agent: number;
  compte: string;
  oportunitatId: string | null;
  prioritat: "alta" | "mitjana" | "baixa";
  feta: boolean;
};

export type Crm = {
  oportunitats: Oportunitat[];
  activitats: Activitat[];
  tasques: Tasca[];
};
