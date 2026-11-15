/**
 * L'abast que toca aplicar a les lectures de la base de dades d'aquest moment.
 *
 * Normalment és el de la sessió de la petició. Però hi ha feina que no és de
 * cap usuari i ha de veure-ho tot: la sincronització amb l'ERP, que si
 * anés filtrada donaria per absents els clients que no veu. Aquesta feina es
 * fa dins de `senseAbast`, i fora de tota petició (el programador) no hi ha
 * sessió i tampoc es filtra.
 */
import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { AbastDades } from "@/domini/abast";
import { abastDeLaSessio } from "@/lib/sessio-actual";

const context = new AsyncLocalStorage<{ senseAbast: boolean }>();

/** Executa `feina` veient-ho tot, sigui qui sigui qui la demana. Per a la sincronització i el manteniment. */
export function senseAbast<T>(feina: () => Promise<T>): Promise<T> {
  return context.run({ senseAbast: true }, feina);
}

/**
 * L'abast de la petició en curs, o null si no cal filtrar: s'és dins de
 * `senseAbast`, no hi ha cap petició (el programador) o qui mira ho veu tot.
 */
export async function abastActual(): Promise<AbastDades | null> {
  if (context.getStore()?.senseAbast) return null;
  let abast: AbastDades;
  try {
    abast = await abastDeLaSessio();
  } catch {
    // Fora d'una petició (`cookies()` no hi és): feina de màquina, sense filtre.
    return null;
  }
  return abast.totes ? null : abast;
}
