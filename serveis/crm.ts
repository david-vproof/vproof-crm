/**
 * D'on surten les dades del CRM.
 *
 * De Directus, sempre. Les files es tradueixen al vocabulari de `domini/crm`,
 * de manera que els càlculs i les pantalles no saben d'on venen.
 */
import "server-only";

import { ErrorDades } from "@/apis/sqlite/client";
import { llegeixCrm, teAccesCrm, type CrmEnCru, type FilaActivitat, type FilaOportunitat, type FilaTasca } from "@/apis/sqlite/crm";
import {
  ETAPES,
  PROBABILITAT,
  type Activitat,
  type Crm,
  type Etapa,
  type Oportunitat,
  type Origen,
  type Tasca,
  type TipusActivitat,
} from "@/domini/crm";
import type { DefinicioTipus } from "@/domini/crm-tipus-activitat";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

export type FontCrm = {
  crm: Crm;
  nomAgent: (codi: number) => string;
  /** El tipus de client ja arriba pel seu nom, des de la fitxa de Directus. */
  nomCanal: (codi: string) => string;
  /** Per què no hi ha dades, si no n'hi ha. */
  avis: string | null;
};

const ETAPA: Record<string, Etapa> = {
  contacte: "Contacte",
  qualificada: "Qualificada",
  tast: "Tast",
  proposta: "Proposta",
  negociacio: "Negociació",
  guanyada: "Guanyada",
  perduda: "Perduda",
};

const TIPUS: Record<string, TipusActivitat> = {
  trucada: "Trucada",
  correu: "Correu",
  reunio: "Reunió",
  visita_sense_vi: "Visita",
  visita_amb_vi: "Visita amb vi",
  visita_celler_client: "Visita de celler a client",
  visita_cellers_client: "Visita de celler a client",
  visita_celler: "Visita al celler",
};

/** Un tipus creat a Configuració entra als càlculs per les seves marques: una visita, o «Altres» si no ho és. */
function tipusDelCalcul(valor: string | null, tipus: DefinicioTipus[]): TipusActivitat {
  const conegut = TIPUS[valor ?? ""];
  if (conegut) return conegut;
  const propi = tipus.find((definicio) => definicio.valor === valor);
  if (propi && !propi.visita) return "Altres";
  return propi?.ambVi ? "Visita amb vi" : "Visita";
}

const PRIORITAT: Record<string, Tasca["prioritat"]> = { alta: "alta", normal: "mitjana", baixa: "baixa" };

const CRM_BUIT: Crm = { oportunitats: [], activitats: [], tasques: [] };

/**
 * Els càlculs agrupen els comercials per codi numèric. Directus els identifica
 * amb UUID, així que se'ls dona un índex estable ordenant-los per nom; el zero
 * queda per a les fitxes sense assignar, com al mode demo.
 */
function indexaComercials(usuaris: CrmEnCru["usuaris"]) {
  const nom = (u: CrmEnCru["usuaris"][number]) =>
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || "Sense nom";

  const ordenats = [...usuaris].sort((a, b) => nom(a).localeCompare(nom(b), "ca"));
  const codis = new Map<string, number>();
  const noms = new Map<number, string>([[0, "Sense assignar"]]);

  ordenats.forEach((usuari, posicio) => {
    codis.set(usuari.id, posicio + 1);
    noms.set(posicio + 1, nom(usuari));
  });

  return {
    codi: (id: string | null) => (id ? (codis.get(id) ?? 0) : 0),
    nom: (codi: number) => noms.get(codi) ?? `Comercial ${codi}`,
  };
}

function compte(fila: { client?: { nom_comercial: string | null } | null; lead?: { nom: string | null } | null }) {
  return fila.client?.nom_comercial ?? fila.lead?.nom ?? "Sense client";
}

function aOportunitat(fila: FilaOportunitat, codiAgent: (id: string | null) => number): Oportunitat {
  const etapa = ETAPA[fila.etapa ?? ""] ?? "Contacte";
  const tancada = etapa === "Guanyada" || etapa === "Perduda";

  return {
    id: fila.id,
    titol: fila.titol ?? "Sense títol",
    compte: compte(fila),
    clientId: fila.client?.codi_erp ?? null,
    canal: fila.tipus_client?.nom ?? "Sense classificar",
    etapa,
    valor: Number(fila.valor ?? 0),
    probabilitat: fila.probabilitat ?? PROBABILITAT[etapa],
    agent: codiAgent(fila.comercial),
    obertaEl: fila.data_obertura ?? fila.date_created ?? "",
    tancamentPrevist: fila.tancament_previst ?? "",
    tancadaEl: fila.data_tancament ?? null,
    // Si ningú ha registrat fins on va arribar, se'n dedueix el mínim segur:
    // les guanyades han recorregut l'embut sencer i les obertes, fins on són.
    etapaAssolida:
      fila.etapa_assolida ??
      (etapa === "Guanyada" ? ETAPES.length : Math.max(1, ETAPES.indexOf(etapa as (typeof ETAPES)[number]) + 1)),
    origen: (fila.lead?.origen as Origen) ?? "Client existent",
    poblacio: fila.client?.poblacio ?? fila.lead?.poblacio ?? "",
    contacte: fila.lead?.persona_contacte ?? "",
    ...(tancada ? {} : {}),
  };
}

function aActivitat(fila: FilaActivitat, codiAgent: (id: string | null) => number, tipus: DefinicioTipus[]): Activitat {
  return {
    id: fila.id,
    data: fila.data ?? fila.date_created ?? "",
    tipus: tipusDelCalcul(fila.tipus, tipus),
    compte: fila.client?.nom_comercial ?? fila.lead?.nom ?? fila.celler?.nom_comercial ?? "Sense client",
    oportunitatId: fila.oportunitat ?? null,
    agent: codiAgent(fila.comercial),
    resum: fila.resum ?? fila.assumpte ?? "",
    celler: fila.celler?.nom_comercial ?? null,
    referencies: fila.referencies ?? null,
    assistents: fila.assistents ?? null,
  };
}

function aTasca(fila: FilaTasca, codiAgent: (id: string | null) => number): Tasca {
  return {
    id: fila.id,
    titol: fila.titol ?? "Sense títol",
    venciment: fila.venciment ?? "",
    agent: codiAgent(fila.responsable),
    compte: compte(fila),
    oportunitatId: fila.oportunitat ?? null,
    prioritat: PRIORITAT[fila.prioritat ?? "normal"] ?? "mitjana",
    feta: fila.estat === "feta",
  };
}

export async function crmDelPortal(): Promise<FontCrm> {
  const identitat = (codi: number) => `Comercial ${codi}`;
  if (!teAccesCrm()) {
    return {
      crm: CRM_BUIT,
      nomAgent: identitat,
      nomCanal: (codi) => codi,
      avis: "El portal encara no té accés al CRM: falten DIRECTUS_URL o DIRECTUS_TOKEN.",
    };
  }

  try {
    const [cru, tipus] = await Promise.all([llegeixCrm(), tipusActivitat()]);
    const comercials = indexaComercials(cru.usuaris);
    const crm: Crm = {
      oportunitats: cru.oportunitats.map((fila) => aOportunitat(fila, comercials.codi)),
      activitats: cru.activitats.map((fila) => aActivitat(fila, comercials.codi, tipus)),
      tasques: cru.tasques.map((fila) => aTasca(fila, comercials.codi)),
    };

    const buit = crm.oportunitats.length === 0 && crm.activitats.length === 0;
    return {
      crm,
      nomAgent: comercials.nom,
      nomCanal: (codi) => codi,
      avis: buit ? "El CRM de Directus encara no té cap oportunitat ni cap activitat registrada." : null,
    };
  } catch (error) {
    if (error instanceof ErrorDades) {
      return { crm: CRM_BUIT, nomAgent: identitat, nomCanal: (codi) => codi, avis: error.message };
    }
    throw error;
  }
}
