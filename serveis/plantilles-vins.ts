/**
 * Les plantilles del configurador de vins: una cistella desada amb nom, els
 * criteris amb què es va fer i una línia per vi. (La columna `quantitat` de
 * les línies ja no es fa servir: es va deixar de demanar quantitats.) Són del
 * CRM, a `crm_plantilles_vins` i `crm_plantilles_vins_linies`; FactuSol no
 * hi té res a veure. Les veu tothom: són seleccions de la casa, no de cadascú.
 */
import "server-only";

import { actualitzaItem, creaItem, creaItems, esborraItem, esborraItems, llistaAmbTotal, obteItem } from "@/apis/sqlite/crm";
import {
  MAXIM_VINS_PER_PLANTILLA, llegeixCriteris, type CriterisVins, type LiniaPlantilla, type Plantilla, type ResumPlantilla,
} from "@/domini/cistella-vins";

const PLANTILLES = "crm_plantilles_vins";
const LINIES = "crm_plantilles_vins_linies";

type FilaResum = {
  id: string;
  nom: string | null;
  descripcio: string | null;
  date_created: string | null;
  date_updated: string | null;
  comercial: { first_name: string | null; last_name: string | null } | null;
  linies: { id: string }[] | null;
};

type FilaLinia = { id: string; article: { id: string; nom: string | null } | null; ordre: number | null };

type FilaPlantilla = Omit<FilaResum, "linies"> & { criteris: unknown; linies: FilaLinia[] | null };

const CAMPS_RESUM = [
  "id", "nom", "descripcio", "date_created", "date_updated", "comercial.first_name", "comercial.last_name", "linies.id",
];

function resum(fila: FilaResum | FilaPlantilla): ResumPlantilla {
  const linies = fila.linies ?? [];
  return {
    id: fila.id,
    nom: fila.nom?.trim() || "Sense nom",
    descripcio: fila.descripcio?.trim() ?? "",
    qui: [fila.comercial?.first_name, fila.comercial?.last_name].filter(Boolean).join(" ") || null,
    creat: fila.date_created,
    modificat: fila.date_updated,
    vins: linies.length,
  };
}

/** Totes les plantilles, per nom. */
export async function llistaPlantilles(): Promise<ResumPlantilla[]> {
  const { files } = await llistaAmbTotal<FilaResum>(PLANTILLES, { camps: CAMPS_RESUM, ordre: "nom", limit: -1 });
  return files.map(resum);
}

export async function obtePlantilla(id: string): Promise<Plantilla | null> {
  const fila = await obteItem<FilaPlantilla>(PLANTILLES, id, [
    ...CAMPS_RESUM, "criteris", "linies.id", "linies.article.id", "linies.article.nom", "linies.ordre",
  ]);
  if (!fila) return null;
  const linies = [...(fila.linies ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  return {
    ...resum(fila),
    criteris: llegeixCriteris(fila.criteris),
    linies: linies.map((linia) => ({ article: linia.article?.id ?? null, nom: linia.article?.nom ?? null })),
  };
}

export type DadesPlantilla = { nom: string; descripcio: string; criteris: CriterisVins; linies: LiniaPlantilla[] };

export class ErrorPlantilla extends Error {}

function comprova(dades: DadesPlantilla) {
  if (!dades.nom) throw new ErrorPlantilla("Posa-li un nom a la plantilla.");
  if (dades.linies.length === 0) throw new ErrorPlantilla("La cistella és buida: afegeix-hi algun vi abans de desar-la.");
  if (dades.linies.length > MAXIM_VINS_PER_PLANTILLA) {
    throw new ErrorPlantilla(`Una plantilla pot portar com a molt ${MAXIM_VINS_PER_PLANTILLA} vins.`);
  }
}

/** Crea una plantilla amb les seves línies. Torna l'id. */
export async function creaPlantilla(dades: DadesPlantilla, comercial: string | null): Promise<string> {
  comprova(dades);
  const id = await creaItem(PLANTILLES, {
    nom: dades.nom,
    descripcio: dades.descripcio || null,
    criteris: dades.criteris,
    ...(comercial ? { comercial } : {}),
  });
  await creaItems(LINIES, dades.linies.map((linia) => ({ ...linia, plantilla: id })));
  return id;
}

/** Deixa la plantilla com diuen les dades: la capçalera, i les línies de nou. */
export async function actualitzaPlantilla(id: string, dades: DadesPlantilla) {
  comprova(dades);
  const actual = await obteItem<{ id: string }>(PLANTILLES, id, ["id"]);
  if (!actual) throw new ErrorPlantilla("Aquesta plantilla ja no existeix.");
  await actualitzaItem(PLANTILLES, id, { nom: dades.nom, descripcio: dades.descripcio || null, criteris: dades.criteris });
  const { files } = await llistaAmbTotal<{ id: string }>(LINIES, { camps: ["id"], limit: -1, filtre: { camp: "plantilla", valor: id } });
  await esborraItems(LINIES, files.map((fila) => fila.id));
  await creaItems(LINIES, dades.linies.map((linia) => ({ ...linia, plantilla: id })));
}

/** Esborra la plantilla. Les línies cauen soles (CASCADE). */
export async function esborraPlantilla(id: string) {
  await esborraItem(PLANTILLES, id);
}
