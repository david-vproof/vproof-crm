/**
 * L'abast d'un usuari sobre les dades del CRM: quins clients veu.
 *
 * L'administrador i el manager ho veuen tot. La resta només veu els seus
 * clients, els que a FactuSol porten el seu agent comercial (el vincle és el
 * camp `agent` del compte de Directus, que es tria a Usuaris), i tot el que en
 * penja: leads del mateix agent, contactes, oportunitats, activitats, deures,
 * establiments, facturació, albarans, atributs i vins d'activitat. Qui no té
 * agent no veu cap client.
 *
 * El filtre s'aplica a totes les pantalles d'un sol lloc: a cada lectura de
 * Directus (`apis/directus/crm.ts`), que hi afegeix la condició d'aquí. Les
 * col·leccions que no són de cap client (articles, agents, segments, zones,
 * plantilles, configuració…) no es toquen.
 */

export type AbastDades = {
  /** Si veu els clients de tothom. */
  totes: boolean;
  /** L'agent comercial (id de `crm_agents`) de qui mira, si no ho veu tot. */
  agent: string | null;
  /** L'id de Directus de qui mira, per les fitxes que són seves encara que no tinguin client. */
  jo: string | null;
};

type Condicio = Record<string, unknown>;

/** Cap fila: la condició per a qui no té agent. L'id mai és nul. */
const RES: Condicio = { id: { _null: true } };

/** Les col·leccions amb el camp `agent` a la pròpia fila: a elles s'estampa l'agent en crear. */
export const COLLECCIONS_AMB_AGENT = new Set(["crm_clients", "crm_leads", "crm_activitats"]);

/** Per a cada col·lecció que és d'algun client, com s'arriba al seu agent (i a qui la porta, si té sentit). */
function condicions(colleccio: string, agent: string, jo: string | null): Condicio[] | null {
  const deAgent = (cami: string[]) => cami.reduceRight<Condicio>((dins, tros) => ({ [tros]: dins }), { _eq: agent });
  const meva = (camp: string): Condicio[] => (jo ? [{ [camp]: { _eq: jo } }] : []);
  switch (colleccio) {
    case "crm_clients":
    case "crm_leads":
      return [deAgent(["agent"])];
    case "crm_activitats":
      // Una activitat sense client ni lead (sense agent) la veu qui l'ha feta.
      return [deAgent(["agent"]), ...meva("comercial")];
    case "crm_contactes":
      return [deAgent(["client", "agent"]), deAgent(["lead", "agent"])];
    case "crm_oportunitats":
      return [deAgent(["client", "agent"]), deAgent(["lead", "agent"]), ...meva("comercial")];
    case "crm_tasques":
      return [deAgent(["client", "agent"]), deAgent(["lead", "agent"]), deAgent(["activitat", "agent"]), ...meva("responsable")];
    case "crm_establiments":
    case "crm_facturacio":
    case "crm_albarans":
    case "crm_client_atributs":
      return [deAgent(["client", "agent"])];
    case "crm_albarans_linies":
      return [deAgent(["albara", "client", "agent"])];
    case "crm_activitats_vins":
      return [deAgent(["activitat", "agent"]), ...(jo ? [{ activitat: { comercial: { _eq: jo } } }] : [])];
    default:
      return null;
  }
}

/** Si la col·lecció és d'algun client i, per tant, es filtra per abast. */
export function esColleccioDeClients(colleccio: string) {
  return condicions(colleccio, "x", null) !== null;
}

/**
 * La condició de Directus que limita una col·lecció a l'abast, o null si no
 * cal filtrar (ho veu tot, o la col·lecció no és de cap client).
 */
export function condicioDAbast(colleccio: string, abast: AbastDades): Condicio | null {
  if (abast.totes) return null;
  if (!esColleccioDeClients(colleccio)) return null;
  if (!abast.agent) return RES;
  const alternatives = condicions(colleccio, abast.agent, abast.jo)!;
  return alternatives.length === 1 ? alternatives[0] : { _or: alternatives };
}

/**
 * El que es crea en una col·lecció amb agent porta el de qui ho crea, si no
 * en porta cap: si no, qui no ho veu tot crearia una fitxa que no veuria.
 */
export function ambAgentDe(colleccio: string, dades: Record<string, unknown>, abast: AbastDades): Record<string, unknown> {
  if (abast.totes || !abast.agent || !COLLECCIONS_AMB_AGENT.has(colleccio)) return dades;
  return dades.agent ? dades : { ...dades, agent: abast.agent };
}
