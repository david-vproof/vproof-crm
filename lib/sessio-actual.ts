/**
 * La sessió de qui fa la petició, llegida de la galeta. Per a pàgines i
 * accions del servidor; el middleware la llegeix pel seu compte.
 */
import "server-only";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { AbastDades } from "@/domini/abast";
import { GALETA_SESSIO, veuTot, verificaToken, type Sessio } from "@/lib/sessio";

export const sessioActual = cache(async (): Promise<Sessio | null> => {
  return verificaToken((await cookies()).get(GALETA_SESSIO)?.value);
});

/**
 * Què veu i què toca qui té la sessió oberta. L'administrador i el manager ho
 * veuen tot; la resta, només els clients del seu agent comercial i el que en
 * penja, i sense agent, cap (vegeu `domini/abast.ts`). Sense id de la base de dades
 * (les credencials locals) tampoc es filtra: val més veure-ho tot que una
 * pantalla buida sense explicació.
 */
export type Abast = AbastDades & {
  /** L'id de la base de dades de qui té la sessió: el que queda estampat a les fitxes que crea. */
  jo: string | null;
  /**
   * El filtre d'abans per comercial («cada u només les activitats que porta»).
   * Ja no s'aplica: l'abast per agent el substitueix, i qui no ho veu tot veu
   * les activitats i els To-Do dels seus clients, els faci qui els faci. Es
   * conserva, sempre null, perquè qui el rep no hagi de canviar.
   */
  deQui: null;
  /** El codi d'agent de l'ERP (AGECLI), per filtrar el que es llegeix de l'ERP en directe. */
  codiAgent: number | null;
  /** No ho veu tot i no té agent: no veu cap client. Per dir-li-ho. */
  senseAgent: boolean;
};

export const abastDeLaSessio = cache(async (): Promise<Abast> => {
  const sessio = await sessioActual();
  const jo = sessio?.id ?? null;
  const totes = !jo || veuTot(sessio);
  const agent = totes ? null : (sessio?.agent?.id ?? null);
  return {
    jo,
    totes,
    deQui: null,
    agent,
    codiAgent: totes ? null : (sessio?.agent?.codiErp ?? null),
    senseAgent: !totes && !agent,
  };
});

/**
 * Les pantalles de qui ho veu tot (l'ERP, la Configuració): a un comercial li
 * surten com si no existissin, igual que Usuaris a qui no administra. Es crida
 * a dalt de cada pàgina, perquè tancar-les al menú no és tancar-les.
 */
export async function exigeixVeuTot() {
  const { totes } = await abastDeLaSessio();
  if (!totes) notFound();
}

/** El mateix per a accions i rutes de l'API, que no poden fer un 404 de pàgina: diu si pot. */
export async function potVeureTot() {
  return (await abastDeLaSessio()).totes;
}
