/**
 * Les lectures del tauler de negoci. Tot passa per l'abast de la sessió
 * (vegeu `domini/abast.ts`): un comercial hi veu la seva cartera, i qui ho
 * veu tot, la casa sencera o un agent triat.
 */
import "server-only";

import { activitatsPerClientEntre, darreraActivitatPerClient, llista, llistaAmbTotal, llistaTot, type Condicio } from "@/apis/sqlite/crm";
import { ZONA } from "@/domini/crm-planner";
import type { ActivitatTauler, AgentTauler, ClientTauler, LeadTauler, MesFacturat, OportunitatTauler, TascaTauler, ViTauler } from "@/domini/crm-tauler";
import { ESTAT_CLIENT_BAIXA } from "@/domini/estats-client";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

export type DadesTauler = {
  avui: string;
  clients: ClientTauler[];
  activitats: ActivitatTauler[];
  oportunitats: OportunitatTauler[];
  tasques: TascaTauler[];
  leads: LeadTauler[];
  mesos: MesFacturat[];
  vins: ViTauler[];
  agents: AgentTauler[];
  fetesEnguany: Map<string, number>;
  darreraActivitat: Map<string, string>;
};

type FilaClient = {
  id: string; nom_comercial: string | null; agent: string | null; comarca: string | null;
  tipus_client: { nom: string | null } | null; categoria: string | null; periodicitat: string | number | null; data_alta: string | null;
  facturacio_periode: number | string | null; facturacio_periode_1: number | string | null; facturacio_any_1: number | string | null;
  facturacio_variacio: number | string | null; facturacio_tendencia: string | null;
};
type FilaActivitat = { id: string; tipus: string | null; data: string | null; client: string | null; lead: string | null; agent: string | null };
type FilaOportunitat = {
  id: string; titol: string | null; etapa: string | null; valor: number | string | null; probabilitat: number | null; tancament_previst: string | null;
  client: { id: string; nom_comercial: string | null; agent: string | null } | null; lead: { id: string; nom: string | null } | null;
};
type FilaTasca = {
  id: string; titol: string | null; venciment: string | null; estat: string | null;
  client: { id: string; nom_comercial: string | null } | null; lead: { id: string; nom: string | null } | null;
};
type FilaLead = { id: string; nom: string | null; data_alta: string | null; date_created: string | null; estat: string | null; poblacio: string | null };
type Agregat = Record<string, unknown> & { sum?: { base?: string | number | null }; count?: { id?: string | number | null } };

const numero = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** El dia d'avui a la bodega, en clau «2026-10-27». */
export function avuiALaBodega() {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
}

/** Els agents de FactuSol, per triar-ne un al tauler i per posar nom a cada fila. */
export async function agentsDelTauler(): Promise<AgentTauler[]> {
  const files = await llistaTot<{ id: string; nom: string | null }>("crm_agents", ["id", "nom"], "nom");
  return files.map((fila) => ({ id: fila.id, nom: fila.nom ?? "Sense nom" }));
}

/**
 * Tot el que el tauler necessita, d'una tirada. Amb `agent`, només la cartera
 * d'aquell agent (per a qui ho veu tot i en vol mirar un).
 */
export async function dadesDelTauler(agent: string | null): Promise<DadesTauler> {
  const avui = avuiALaBodega();
  const exercici = Number(avui.slice(0, 4));
  const iniciExercici = `${exercici}-01-01`;
  const perAgent: Condicio[] = agent ? [{ agent: { _eq: agent } }] : [];
  const perAgentDelClient: Condicio[] = agent ? [{ client: { agent: { _eq: agent } } }] : [];
  const filtre = (condicions: Condicio[]) => (condicions.length ? `&filter=${encodeURIComponent(JSON.stringify(condicions.length === 1 ? condicions[0] : { _and: condicions }))}` : "");

  const [clients, activitats, oportunitats, tasques, leads, mesos, linies, tastos, agents, fetesEnguany, darreraActivitat, definicions] = await Promise.all([
    llistaAmbTotal<FilaClient>("crm_clients", {
      camps: [
        "id", "nom_comercial", "agent", "comarca", "tipus_client.nom", "categoria", "periodicitat", "data_alta",
        "facturacio_periode", "facturacio_periode_1", "facturacio_any_1", "facturacio_variacio", "facturacio_tendencia",
      ],
      limit: -1,
      // Els de baixa no compten: ni a la cartera ni a la facturació.
      condicions: [{ _or: [{ estat: { _null: true } }, { estat: { _neq: ESTAT_CLIENT_BAIXA.valor } }] }, ...perAgent],
    }),
    llista<FilaActivitat>(`/items/crm_activitats?limit=-1&fields=id,tipus,data,client,lead,agent${filtre([{ data: { _gte: `${exercici - 1}-01-01` } }, ...perAgent])}`),
    llista<FilaOportunitat>(`/items/crm_oportunitats?limit=-1&fields=id,titol,etapa,valor,probabilitat,tancament_previst,client.id,client.nom_comercial,client.agent,lead.id,lead.nom${filtre(perAgentDelClient)}`),
    llista<FilaTasca>(`/items/crm_tasques?limit=-1&fields=id,titol,venciment,estat,client.id,client.nom_comercial,lead.id,lead.nom${filtre([{ _or: [{ estat: { _null: true } }, { estat: { _nin: ["feta", "cancellada"] } }] }, ...perAgentDelClient])}`),
    llista<FilaLead>(`/items/crm_leads?limit=-1&fields=id,nom,data_alta,date_created,estat,poblacio${filtre(perAgent)}`),
    llista<Agregat>(`/items/crm_facturacio?aggregate[sum]=base&groupBy[]=exercici&groupBy[]=mes&limit=-1${filtre([{ exercici: { _gte: exercici - 1 } }, ...perAgentDelClient])}`),
    llista<Agregat>(`/items/crm_albarans_linies?aggregate[count]=id&groupBy[]=article&limit=-1${filtre([{ albara: { data: { _gte: iniciExercici } } }, ...(agent ? [{ albara: { client: { agent: { _eq: agent } } } }] : [])])}`),
    llista<Agregat>(`/items/crm_activitats_vins?aggregate[count]=id&groupBy[]=article&limit=-1${filtre([{ activitat: { data: { _gte: iniciExercici } } }, ...(agent ? [{ activitat: { agent: { _eq: agent } } }] : [])])}`),
    agentsDelTauler(),
    activitatsPerClientEntre(iniciExercici, `${exercici + 1}-01-01`),
    darreraActivitatPerClient(`${avui}T23:59:59`),
    tipusActivitat(),
  ]);
  const tipusDeVisita = new Set(definicions.filter((tipus) => tipus.visita).map((tipus) => tipus.valor));

  // Els vins: el nom dels que han sortit en alguna línia o en algun tast.
  const perArticle = new Map<string, ViTauler>();
  for (const fila of linies) {
    const id = String(fila.article ?? "");
    if (!id) continue;
    perArticle.set(id, { id, nom: "", linies: numero(fila.count?.id), tastos: 0 });
  }
  for (const fila of tastos) {
    const id = String(fila.article ?? "");
    if (!id) continue;
    const vi = perArticle.get(id) ?? { id, nom: "", linies: 0, tastos: 0 };
    vi.tastos = numero(fila.count?.id);
    perArticle.set(id, vi);
  }
  if (perArticle.size > 0) {
    // El catàleg sencer i no només els ids: centenars d'ids a l'adreça no hi caben.
    const articles = await llistaTot<{ id: string; nom: string | null }>("crm_articles", ["id", "nom"]);
    for (const article of articles) {
      const vi = perArticle.get(article.id);
      if (vi) vi.nom = article.nom ?? "Sense nom";
    }
  }

  return {
    avui,
    clients: clients.files.map((fila) => ({
      id: fila.id,
      nom: fila.nom_comercial ?? "Sense nom",
      agent: fila.agent,
      comarca: fila.comarca,
      tipus: fila.tipus_client?.nom ?? null,
      categoria: fila.categoria,
      periodicitat: fila.periodicitat,
      dataAlta: fila.data_alta,
      periode: numero(fila.facturacio_periode),
      periode1: numero(fila.facturacio_periode_1),
      any1: numero(fila.facturacio_any_1),
      variacio: fila.facturacio_variacio === null ? null : numero(fila.facturacio_variacio),
      tendencia: fila.facturacio_tendencia,
    })),
    activitats: activitats.map(({ tipus, ...fila }) => ({ ...fila, esVisita: tipusDeVisita.has(tipus ?? "") })),
    oportunitats: oportunitats.map((fila) => ({
      id: fila.id,
      titol: fila.titol,
      etapa: fila.etapa,
      valor: numero(fila.valor),
      probabilitat: numero(fila.probabilitat),
      tancamentPrevist: fila.tancament_previst,
      client: fila.client ? { id: fila.client.id, nom: fila.client.nom_comercial, agent: fila.client.agent } : null,
      lead: fila.lead ? { id: fila.lead.id, nom: fila.lead.nom } : null,
    })),
    tasques: tasques.map((fila) => ({
      id: fila.id,
      titol: fila.titol,
      venciment: fila.venciment,
      estat: fila.estat,
      client: fila.client ? { id: fila.client.id, nom: fila.client.nom_comercial } : null,
      lead: fila.lead ? { id: fila.lead.id, nom: fila.lead.nom } : null,
    })),
    leads: leads.map((fila) => ({ id: fila.id, nom: fila.nom, dataAlta: fila.data_alta ?? fila.date_created, estat: fila.estat, poblacio: fila.poblacio })),
    mesos: mesos.map((fila) => ({ exercici: numero(fila.exercici), mes: numero(fila.mes), base: numero(fila.sum?.base) })),
    vins: [...perArticle.values()].filter((vi) => vi.nom),
    agents,
    fetesEnguany,
    darreraActivitat,
  };
}
