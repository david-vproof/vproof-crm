/**
 * Quins clients porten marques a les llistes (vegeu `domini/marques-client.ts`):
 * els que tenen atributs i els que tenen To-Do pendents. Dues consultes
 * agrupades, una per mena, que es fan un cop per pantalla.
 */
import "server-only";

import { clientsAmbAtributs } from "@/serveis/atributs";
import { clientsAmbDeures } from "@/serveis/crm-deures";

export type ClientsMarcats = { atributs: Set<string>; deures: Set<string> };

/** Sense tombar la pantalla si Directus falla: sense marques, la llista surt igual. */
export async function clientsMarcats(): Promise<ClientsMarcats> {
  const [atributs, deures] = await Promise.all([
    clientsAmbAtributs().catch(() => new Set<string>()),
    clientsAmbDeures().catch(() => new Set<string>()),
  ]);
  return { atributs, deures };
}
