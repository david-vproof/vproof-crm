/**
 * Les activitats d'enguany de cada client, per comparar-les amb la seva
 * periodicitat. Es compten al moment i no es desen: així no cal recalcular res
 * cada cop que es crea, es mou o s'esborra una activitat, ni quan passen els dies.
 */
import "server-only";

import { activitatsPerClientEntre } from "@/apis/sqlite/crm";
import { seguimentDe, type Seguiment } from "@/domini/crm-periodicitat";
import { avuiLocal, instantDeLocal } from "@/domini/crm-planner";

export type ActivitatsDEnguany = {
  /** El dia d'avui, del fus del negoci: el que diu quina part de l'any ha passat. */
  dia: string;
  fetes: Map<string, number>;
};

/**
 * Des de l'1 de gener, hora d'aquí, fins ara. Les que tenen data més endavant
 * encara no s'han fet i no compten, estiguin tancades o no.
 */
export async function activitatsDEnguany(ara = new Date(), client?: string): Promise<ActivitatsDEnguany> {
  const dia = avuiLocal(ara);
  const any = dia.slice(0, 4);
  const desde = instantDeLocal(`${any}-01-01T00:00`) ?? `${any}-01-01T00:00:00.000Z`;
  return { dia, fetes: await activitatsPerClientEntre(desde, ara.toISOString(), client) };
}

/** Com va un sol client. Sense periodicitat no es demana res a Directus. */
export async function seguimentDelClient(id: string, periodicitat: unknown, ara = new Date()): Promise<Seguiment | null> {
  if (!seguimentDe(periodicitat, 0, avuiLocal(ara))) return null;
  const { dia, fetes } = await activitatsDEnguany(ara, id);
  return seguimentDe(periodicitat, fetes.get(id) ?? 0, dia);
}
