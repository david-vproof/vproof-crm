import "server-only";

import { llistaClients, obtenirClient, type FiltreClients } from "@/apis/factusol";
import type { Client, LlistaClients } from "@/domini/tipus";
import { abastDeLaSessio } from "@/lib/sessio-actual";

/**
 * Punt d'entrada de les dades de clients: la taula F_CLI de FactuSol. Passa
 * per l'abast de qui mira, com el CRM (vegeu `domini/abast.ts`): qui no ho
 * veu tot només té els clients del seu agent, i sense agent, cap.
 */
async function agentDeLAbast(): Promise<number | null | undefined> {
  const abast = await abastDeLaSessio();
  return abast.totes ? undefined : abast.codiAgent;
}

export async function clientsDelPortal(filtre: Omit<FiltreClients, "agent"> = {}): Promise<LlistaClients> {
  return llistaClients({ ...filtre, agent: await agentDeLAbast() });
}

export async function clientDelPortal(codi: number): Promise<Client | null> {
  return obtenirClient(codi, await agentDeLAbast());
}

/**
 * Reexportacions perquè la presentació tingui una sola porta: quan les dades
 * vinguin de la rèplica i no de l'API, aquí es podrà canviar l'origen sense
 * tocar cap pantalla.
 */
export { carregaCatalegs, nomAgent, nomFormaPagament, nomTarifa } from "@/apis/factusol/catalegs";
export { ErrorFactusol, type MotiuFallada } from "@/apis/factusol/errors";
export type { Client, LlistaClients } from "@/domini/tipus";
