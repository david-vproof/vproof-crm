/**
 * El tauler de negoci: els càlculs, sense cap lectura. Rep les files tal com
 * les dona `serveis/crm-tauler.ts` i en treu tres nivells:
 *
 * - **Macro**: com va la casa. Facturació del període contra l'any passat,
 *   quants clients compren, quants són nous, quants van a menys, el pipeline
 *   i si les visites van al dia.
 * - **Meso**: on i amb qui. Per agent comercial, per comarca, per tipus de
 *   client, per categoria (A–E) i per vi.
 * - **Micro**: què toca fer avui. Clients que perden, bons clients sense
 *   visita, oportunitats a punt de tancar, leads sense moure, To-Do vençuts.
 *
 * Tot va amb el que ja hi ha: la facturació que la sincronització deixa a cada
 * client, les activitats, les oportunitats, els To-Do i les línies d'albarà.
 */
import { seguimentDe } from "./crm-periodicitat";
import { diesDesDe } from "./crm-visites";

export type ClientTauler = {
  id: string;
  nom: string;
  agent: string | null;
  comarca: string | null;
  tipus: string | null;
  categoria: string | null;
  periodicitat: string | number | null;
  dataAlta: string | null;
  /** Gener fins a l'últim mes tancat, enguany i l'any passat; i l'any passat sencer. */
  periode: number;
  periode1: number;
  any1: number;
  variacio: number | null;
  tendencia: string | null;
};

export type ActivitatTauler = {
  id: string;
  /** Si el seu tipus compta com a anar-hi: és una marca de la taula de tipus d'activitat. */
  esVisita: boolean;
  data: string | null;
  client: string | null;
  lead: string | null;
  agent: string | null;
};

export type OportunitatTauler = {
  id: string;
  titol: string | null;
  etapa: string | null;
  valor: number;
  probabilitat: number;
  tancamentPrevist: string | null;
  client: { id: string; nom: string | null; agent: string | null } | null;
  lead: { id: string; nom: string | null } | null;
};

export type TascaTauler = {
  id: string;
  titol: string | null;
  venciment: string | null;
  estat: string | null;
  client: { id: string; nom: string | null } | null;
  lead: { id: string; nom: string | null } | null;
};

export type LeadTauler = { id: string; nom: string | null; dataAlta: string | null; estat: string | null; poblacio: string | null };

export type MesFacturat = { exercici: number; mes: number; base: number };

export type ViTauler = { id: string; nom: string; linies: number; tastos: number };

export type AgentTauler = { id: string; nom: string };

const ETAPES_TANCADES = new Set(["guanyada", "perduda"]);
const TENDENCIES_DE_RISC = new Set(["baixa", "perdut"]);
const UN_DIA = 86_400_000;

const suma = (valors: number[]) => valors.reduce((total, valor) => total + valor, 0);

/** «2026-10-27» menys o més dies, en clau de dia. */
export function diaMes(dia: string, dies: number) {
  const [any, mes, dd] = dia.split("-").map(Number);
  return new Date(Date.UTC(any, mes - 1, dd) + dies * UN_DIA).toISOString().slice(0, 10);
}

export function variacioEntre(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

// ------------------------------------------------------------------- macro

export type ResumMacro = {
  exercici: number;
  finsMes: number;
  facturacio: number;
  facturacio1: number;
  variacio: number | null;
  clients: number;
  compren: number;
  nous: number;
  enRisc: number;
  pipeline: number;
  ponderat: number;
  obertes: number;
  /** Clients amb periodicitat i, d'aquests, quants van al dia o millor. */
  ambPeriodicitat: number;
  alDia: number;
};

export function resumMacro(
  clients: ClientTauler[],
  oportunitats: OportunitatTauler[],
  fetesEnguany: Map<string, number>,
  avui: string,
): ResumMacro {
  const exercici = Number(avui.slice(0, 4));
  const obertes = oportunitats.filter((o) => !ETAPES_TANCADES.has(o.etapa ?? ""));
  let ambPeriodicitat = 0;
  let alDia = 0;
  for (const client of clients) {
    const seguiment = seguimentDe(client.periodicitat, fetesEnguany.get(client.id) ?? 0, avui);
    if (!seguiment) continue;
    ambPeriodicitat += 1;
    if (seguiment.estat === "complert" || seguiment.estat === "al_dia") alDia += 1;
  }
  const facturacio = suma(clients.map((c) => c.periode));
  const facturacio1 = suma(clients.map((c) => c.periode1));
  return {
    exercici,
    finsMes: Number(avui.slice(5, 7)) - 1,
    facturacio,
    facturacio1,
    variacio: variacioEntre(facturacio, facturacio1),
    clients: clients.length,
    compren: clients.filter((c) => c.periode > 0).length,
    nous: clients.filter((c) => (c.dataAlta ?? "").startsWith(String(exercici))).length,
    enRisc: clients.filter((c) => TENDENCIES_DE_RISC.has(c.tendencia ?? "") && c.periode1 > 0).length,
    pipeline: suma(obertes.map((o) => o.valor)),
    ponderat: suma(obertes.map((o) => (o.valor * o.probabilitat) / 100)),
    obertes: obertes.length,
    ambPeriodicitat,
    alDia,
  };
}

/** Dotze mesos de l'exercici i de l'anterior, per pintar-los l'un sobre l'altre. */
export function seriesMensuals(mesos: MesFacturat[], exercici: number): { actual: number[]; anterior: number[] } {
  const actual = Array<number>(12).fill(0);
  const anterior = Array<number>(12).fill(0);
  for (const fila of mesos) {
    if (fila.mes < 1 || fila.mes > 12) continue;
    if (fila.exercici === exercici) actual[fila.mes - 1] += fila.base;
    if (fila.exercici === exercici - 1) anterior[fila.mes - 1] += fila.base;
  }
  return { actual, anterior };
}

// -------------------------------------------------------------------- meso

export type FilaCategoria = { lletra: string; clients: number; facturacio: number; part: number };

/** A, B, C, D, E (i «Sense» per als que no en tenen): quants clients i quina part de la facturació. */
export function perCategoria(clients: ClientTauler[]): FilaCategoria[] {
  const total = suma(clients.map((c) => c.periode)) || 1;
  const lletres = ["A", "B", "C", "D", "E"];
  const files = lletres.map((lletra) => {
    const dels = clients.filter((c) => (c.categoria ?? "").toUpperCase() === lletra);
    const facturacio = suma(dels.map((c) => c.periode));
    return { lletra, clients: dels.length, facturacio, part: (facturacio / total) * 100 };
  });
  const sense = clients.filter((c) => !lletres.includes((c.categoria ?? "").toUpperCase()));
  if (sense.length > 0) {
    const facturacio = suma(sense.map((c) => c.periode));
    files.push({ lletra: "Sense", clients: sense.length, facturacio, part: (facturacio / total) * 100 });
  }
  return files;
}

export type FilaAgent = {
  id: string | null;
  nom: string;
  clients: number;
  compren: number;
  facturacio: number;
  variacio: number | null;
  visites90: number;
  pipeline: number;
};

/** L'equip: cada agent amb la seva cartera, i una fila per als clients que no en tenen. */
export function perAgent(
  clients: ClientTauler[],
  activitats: ActivitatTauler[],
  oportunitats: OportunitatTauler[],
  agents: AgentTauler[],
  avui: string,
): FilaAgent[] {
  const des90 = diaMes(avui, -90);
  const fila = (id: string | null, nom: string): FilaAgent => {
    const seus = clients.filter((c) => c.agent === id);
    const facturacio = suma(seus.map((c) => c.periode));
    const facturacio1 = suma(seus.map((c) => c.periode1));
    return {
      id,
      nom,
      clients: seus.length,
      compren: seus.filter((c) => c.periode > 0).length,
      facturacio,
      variacio: variacioEntre(facturacio, facturacio1),
      visites90: activitats.filter((a) => a.agent === id && a.esVisita && (a.data ?? "") >= des90 && (a.data ?? "") <= `${avui}T23:59:59`).length,
      pipeline: suma(oportunitats.filter((o) => o.client?.agent === id && !ETAPES_TANCADES.has(o.etapa ?? "")).map((o) => o.valor)),
    };
  };
  const files = agents.map((agent) => fila(agent.id, agent.nom)).filter((f) => f.clients > 0 || f.visites90 > 0);
  files.sort((a, b) => b.facturacio - a.facturacio);
  const senseAgent = fila(null, "Sense agent");
  if (senseAgent.clients > 0) files.push(senseAgent);
  return files;
}

export type FilaTerritori = { nom: string; clients: number; facturacio: number; variacio: number | null };

/** Per comarca o per tipus de client: les primeres per facturació, i la resta agrupada. */
export function perClau(clients: ClientTauler[], clau: (client: ClientTauler) => string | null, maxim = 8): FilaTerritori[] {
  const grups = new Map<string, ClientTauler[]>();
  for (const client of clients) {
    const nom = (clau(client) ?? "").trim() || "Sense dada";
    grups.set(nom, [...(grups.get(nom) ?? []), client]);
  }
  const files = [...grups.entries()].map(([nom, dels]) => {
    const facturacio = suma(dels.map((c) => c.periode));
    return { nom, clients: dels.length, facturacio, variacio: variacioEntre(facturacio, suma(dels.map((c) => c.periode1))) };
  });
  files.sort((a, b) => b.facturacio - a.facturacio);
  if (files.length <= maxim + 1) return files;
  const resta = files.slice(maxim);
  const facturacio = suma(resta.map((f) => f.facturacio));
  return [...files.slice(0, maxim), { nom: `Altres (${resta.length})`, clients: suma(resta.map((f) => f.clients)), facturacio, variacio: null }];
}

/** Els vins més servits enguany (línies d'albarà), i els tastats que encara no s'han servit. */
export function vinsDestacats(vins: ViTauler[], maxim = 10) {
  const servits = vins.filter((vi) => vi.linies > 0).sort((a, b) => b.linies - a.linies).slice(0, maxim);
  const tastatsSenseCompra = vins.filter((vi) => vi.tastos > 0 && vi.linies === 0).sort((a, b) => b.tastos - a.tastos).slice(0, maxim);
  return { servits, tastatsSenseCompra };
}

// ------------------------------------------------------------------- micro

export type ClientDAtencio = {
  id: string;
  nom: string;
  categoria: string | null;
  periode: number;
  periode1: number;
  variacio: number | null;
  /** Dies des de la darrera activitat, o null si no n'hi ha hagut mai. */
  diesSenseVisita: number | null;
};

const ambVisita = (client: ClientTauler, darrera: Map<string, string>, avui: string): ClientDAtencio => {
  const ultima = darrera.get(client.id)?.slice(0, 10) ?? null;
  return {
    id: client.id,
    nom: client.nom,
    categoria: client.categoria,
    periode: client.periode,
    periode1: client.periode1,
    variacio: client.variacio,
    diesSenseVisita: ultima ? diesDesDe(ultima, avui) : null,
  };
};

/** Els que més facturació perden respecte de l'any passat: on primer cal anar. */
export function clientsQuePerden(clients: ClientTauler[], darrera: Map<string, string>, avui: string, maxim = 8): ClientDAtencio[] {
  return clients
    .filter((c) => TENDENCIES_DE_RISC.has(c.tendencia ?? "") && c.periode1 > 0)
    .sort((a, b) => (b.periode1 - b.periode) - (a.periode1 - a.periode))
    .slice(0, maxim)
    .map((c) => ambVisita(c, darrera, avui));
}

/** Clients A i B sense cap activitat en tres mesos: la cartera bona que es refreda. */
export function bonsClientsSenseVisita(clients: ClientTauler[], darrera: Map<string, string>, avui: string, maxim = 8): ClientDAtencio[] {
  return clients
    .filter((c) => ["A", "B"].includes((c.categoria ?? "").toUpperCase()))
    .map((c) => ambVisita(c, darrera, avui))
    .filter((c) => c.diesSenseVisita === null || c.diesSenseVisita > 90)
    .sort((a, b) => b.periode - a.periode)
    .slice(0, maxim);
}

/** Oportunitats vives amb tancament previst dins de `dies` dies, o ja passat. */
export function oportunitatsATancar(oportunitats: OportunitatTauler[], avui: string, dies = 14): OportunitatTauler[] {
  const fins = diaMes(avui, dies);
  return oportunitats
    .filter((o) => !ETAPES_TANCADES.has(o.etapa ?? "") && o.tancamentPrevist && o.tancamentPrevist.slice(0, 10) <= fins)
    .sort((a, b) => (a.tancamentPrevist ?? "").localeCompare(b.tancamentPrevist ?? ""));
}

/** Leads dels darrers 30 dies que encara no tenen cap activitat. */
export function leadsSenseMoure(leads: LeadTauler[], activitats: ActivitatTauler[], avui: string): LeadTauler[] {
  const des = diaMes(avui, -30);
  const ambActivitat = new Set(activitats.map((a) => a.lead).filter(Boolean));
  return leads
    .filter((l) => (l.dataAlta ?? "").slice(0, 10) >= des && !ambActivitat.has(l.id) && !["convertit", "descartat"].includes(l.estat ?? ""))
    .sort((a, b) => (b.dataAlta ?? "").localeCompare(a.dataAlta ?? ""));
}

export function toDosVencuts(tasques: TascaTauler[], avui: string): TascaTauler[] {
  return tasques
    .filter((t) => !["feta", "cancellada"].includes(t.estat ?? "") && t.venciment && t.venciment.slice(0, 10) < avui)
    .sort((a, b) => (a.venciment ?? "").localeCompare(b.venciment ?? ""));
}

/** Les visites d'aquesta setmana (dilluns a diumenge) i les que ja s'han fet. */
export function visitesDeLaSetmana(activitats: ActivitatTauler[], avui: string) {
  const [any, mes, dd] = avui.split("-").map(Number);
  const diaSetmana = (new Date(Date.UTC(any, mes - 1, dd)).getUTCDay() + 6) % 7;
  const dilluns = diaMes(avui, -diaSetmana);
  const diumenge = diaMes(dilluns, 6);
  const deLaSetmana = activitats.filter((a) => a.esVisita && (a.data ?? "").slice(0, 10) >= dilluns && (a.data ?? "").slice(0, 10) <= diumenge);
  return {
    total: deLaSetmana.length,
    fetes: deLaSetmana.filter((a) => (a.data ?? "").slice(0, 10) < avui).length,
    avui: deLaSetmana.filter((a) => (a.data ?? "").slice(0, 10) === avui).length,
  };
}
