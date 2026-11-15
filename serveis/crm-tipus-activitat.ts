/**
 * Els tipus d'activitat de `crm_tipus_activitat`, que es canvien a Configuració.
 * Vegeu `domini/crm-tipus-activitat.ts`.
 */
import "server-only";

import { cache } from "react";

import { ErrorDades } from "@/apis/sqlite/client";
import { actualitzaItems, agrupaPer, creaItems, esborraItems, llistaTot } from "@/apis/sqlite/crm";
import { FITXES, type ClauFitxa, type Fitxa } from "@/domini/crm-fitxes";
import {
  TIPUS_BASE,
  ambTipusActivitat,
  esTipusBase,
  validaTipus,
  valorNouDeTipus,
  type DefinicioTipus,
  type TipusEnviat,
} from "@/domini/crm-tipus-activitat";

const COLLECCIO = "crm_tipus_activitat";
const CAMPS = ["id", "valor", "nom", "visita", "amb_vi", "amb_celler", "actiu", "ordre"];
/** Entre un tipus i el següent: un de nou va al final de tot. */
const SALT_ORDRE = 10;

type Fila = {
  id: string;
  valor: string | null;
  nom: string | null;
  visita: boolean | null;
  amb_vi: boolean | null;
  amb_celler: boolean | null;
  actiu: boolean | null;
  ordre: number | null;
};

export class ErrorTipusActivitat extends Error {}

function aDefinicio(fila: Fila): DefinicioTipus {
  return {
    id: fila.id,
    valor: fila.valor ?? "",
    nom: fila.nom ?? fila.valor ?? "",
    visita: fila.visita === true,
    ambVi: fila.amb_vi === true,
    ambCeller: fila.amb_celler === true,
    actiu: fila.actiu === true,
  };
}

function aColumnes(tipus: TipusEnviat) {
  return { nom: tipus.nom, visita: tipus.visita, amb_vi: tipus.ambVi, amb_celler: tipus.ambCeller, actiu: tipus.actiu };
}

const llegeixFiles = () => llistaTot<Fila>(COLLECCIO, CAMPS, "ordre");

/** Tal com són a Directus. Si la taula no hi és, falla: Configuració ho ha de dir. */
export async function llistaTipusActivitat(): Promise<DefinicioTipus[]> {
  return (await llegeixFiles()).filter((fila) => fila.valor).map(aDefinicio);
}

/**
 * Els tipus per fer-los servir: una sola lectura per petició, encara que els
 * demanin diverses parts de la pàgina.
 *
 * Mentre Directus no té la taula (respon 403, com a tot el que no existeix) o és
 * buida, manen els de partida: el CRM no s'ha de parar per això. Qualsevol altre
 * error es deixa passar: desar una activitat amb una llista equivocada li
 * esborraria el celler i els vins.
 */
export const tipusActivitat = cache(async (): Promise<DefinicioTipus[]> => {
  try {
    const llista = await llistaTipusActivitat();
    return llista.length > 0 ? llista : TIPUS_BASE;
  } catch (error) {
    if (error instanceof ErrorDades && error.estat === 403) return TIPUS_BASE;
    throw error;
  }
});

/** La descripció d'una fitxa amb el que depèn de Directus ja posat: a les activitats, els tipus. */
export async function fitxaViva(clau: ClauFitxa): Promise<Fitxa> {
  return clau === "activitats" ? ambTipusActivitat(FITXES.activitats, await tipusActivitat()) : FITXES[clau];
}

/** Quantes activitats hi ha de cada tipus: amb alguna, un tipus ja no es pot esborrar. */
export async function usosDelsTipus(): Promise<Record<string, number>> {
  const grups = await agrupaPer(FITXES.activitats.colleccio, "tipus");
  return Object.fromEntries(grups.map((grup) => [grup.valor, grup.quants]));
}

/**
 * Desa el que s'ha canviat a la taula de Configuració. Només es toca el que
 * arriba: un tipus que algú altre hagi creat mentrestant no s'esborra perquè
 * aquest formulari no el conegués. Per això els que s'esborren van a part.
 */
export async function desaTipusActivitat(enviats: TipusEnviat[], perEsborrar: string[]) {
  const [files, usos] = await Promise.all([llegeixFiles(), usosDelsTipus()]);
  const actuals = files.filter((fila) => fila.valor).map(aDefinicio);

  const esborrats = actuals.filter((tipus) => perEsborrar.includes(tipus.id!));
  for (const tipus of esborrats) {
    if (esTipusBase(tipus.valor)) {
      throw new ErrorTipusActivitat(`«${tipus.nom}» és un dels tipus de base: no es pot esborrar, només desactivar.`);
    }
    if (usos[tipus.valor]) {
      throw new ErrorTipusActivitat(`«${tipus.nom}» ja té activitats: no es pot esborrar, només desactivar.`);
    }
  }

  const delFormulari = new Map(enviats.filter((tipus) => tipus.id).map((tipus) => [tipus.id!, tipus]));
  const conservats = actuals.filter((tipus) => !esborrats.includes(tipus));
  const canviats = conservats.flatMap((tipus) => {
    const nou = delFormulari.get(tipus.id!);
    if (!nou) return [];
    const igual =
      nou.nom === tipus.nom && nou.visita === tipus.visita && nou.ambVi === tipus.ambVi && nou.ambCeller === tipus.ambCeller && nou.actiu === tipus.actiu;
    return igual ? [] : [nou];
  });
  const nous = enviats.filter((tipus) => !tipus.id);

  const error = validaTipus([...conservats.map((tipus) => delFormulari.get(tipus.id!) ?? tipus), ...nous]);
  if (error) throw new ErrorTipusActivitat(error);

  // També els que s'esborren: un valor no es reaprofita ni en la mateixa desada.
  const usats = new Set(actuals.map((tipus) => tipus.valor));
  const darrerOrdre = Math.max(0, ...files.map((fila) => fila.ordre ?? 0));
  const perCrear = nous.map((tipus, posicio) => {
    const valor = valorNouDeTipus(tipus.nom, usats);
    usats.add(valor);
    return { ...aColumnes(tipus), valor, ordre: darrerOrdre + (posicio + 1) * SALT_ORDRE };
  });

  await actualitzaItems(COLLECCIO, canviats.map((tipus) => ({ id: tipus.id!, ...aColumnes(tipus) })));
  await creaItems(COLLECCIO, perCrear);
  await esborraItems(COLLECCIO, esborrats.map((tipus) => tipus.id!));

  return { creats: perCrear.length, canviats: canviats.length, esborrats: esborrats.length };
}
