/**
 * Els cellers: de qui es compra. No són una taula pròpia del portal sinó els
 * proveïdors que porta la sincronització de FactuSol (`crm_proveidors`).
 *
 * Aquí hi ha la cerca que alimenta el selector de celler d'una activitat. N'hi
 * ha 651 i creixeran, així que no s'ofereixen en una llista: es cerquen, i per
 * més d'una variable, perquè d'un celler te'n pot venir al cap el nom, el
 * poble, la província o el número que té a l'ERP.
 */
import "server-only";

import { agrupaPer, llistaAmbTotal, obteItem, type Condicio } from "@/apis/directus/crm";
import { FITXES } from "@/domini/crm-fitxes";
import { CAMPS_ORDRE_CELLERS } from "@/domini/llistats-erp";
import type { Ordre } from "@/domini/ordre-llistat";

const COLLECCIO = FITXES.proveidors.colleccio;

/** Per quins camps de text es cerca. El codi d'ERP va a part: és un número. */
const CAMPS_TEXT = ["nom_comercial", "rao_social", "nif", "poblacio", "provincia", "correu"];

const CAMPS = [
  "id", "nom_comercial", "rao_social", "nif", "tipus", "estat",
  "poblacio", "provincia", "pais", "telefon", "correu", "codi_erp",
];

export type FitxaCeller = {
  id: string;
  nom_comercial: string | null;
  rao_social: string | null;
  nif: string | null;
  tipus: string | null;
  estat: string | null;
  poblacio: string | null;
  provincia: string | null;
  pais: string | null;
  telefon: string | null;
  correu: string | null;
  codi_erp: number | null;
};

export type FiltreCellers = {
  cerca?: string;
  /** «proveidor» (cellers i proveïdors de mercaderia) o «creditor» (serveis). */
  tipus?: string;
  provincia?: string;
  limit?: number;
};

export const PER_CERCA = 40;

/**
 * Un mateix terme es prova a tots els camps alhora: qui escriu «vilafranca»
 * busca un poble i qui escriu «158», un codi d'ERP.
 */
function condicionsDeCerca(terme: string): Condicio[] {
  const net = terme.trim();
  if (!net) return [];
  const proves: Condicio[] = CAMPS_TEXT.map((camp) => ({ [camp]: { _icontains: net } }));
  // _icontains contra una columna de números peta a Directus: el codi es prova
  // per igualtat, i només si el terme ho és tot de xifres.
  if (/^\d+$/.test(net)) proves.push({ codi_erp: { _eq: Number(net) } });
  return [{ _or: proves }];
}

export async function cercaCellers(filtre: FiltreCellers = {}) {
  const condicions: Condicio[] = [
    ...condicionsDeCerca(filtre.cerca ?? ""),
    ...(filtre.tipus ? [{ tipus: { _eq: filtre.tipus } } as Condicio] : []),
    ...(filtre.provincia ? [{ provincia: { _eq: filtre.provincia } } as Condicio] : []),
  ];

  const { files, total } = await llistaAmbTotal<FitxaCeller>(COLLECCIO, {
    camps: CAMPS,
    ordre: "nom_comercial",
    limit: filtre.limit ?? PER_CERCA,
    condicions,
  });
  return { files, total };
}

// ----------------------------------------------------- pantalla de cellers

export const PER_PAGINA_CELLERS = 12;

export type LlistaCellers = { files: FitxaCeller[]; total: number; pagina: number; perPagina: number };

/**
 * El llistat de la pantalla de cellers, paginat. Per defecte va pel codi de
 * FactuSol, com el de clients; amb una columna triada, per aquella i, a
 * igualtat, pel codi, perquè la paginació no balli.
 */
export async function llistaCellers({
  cerca = "",
  pagina = 1,
  ordre = null,
}: { cerca?: string; pagina?: number; ordre?: Ordre | null } = {}): Promise<LlistaCellers> {
  const paginaSegura = Math.max(1, pagina);
  const campOrdre = ordre ? CAMPS_ORDRE_CELLERS[ordre.camp] : undefined;
  const { files, total } = await llistaAmbTotal<FitxaCeller>(COLLECCIO, {
    camps: CAMPS,
    ordre: campOrdre ? `${ordre!.descendent ? "-" : ""}${campOrdre},codi_erp` : "codi_erp",
    limit: PER_PAGINA_CELLERS,
    salta: (paginaSegura - 1) * PER_PAGINA_CELLERS,
    condicions: condicionsDeCerca(cerca),
  });
  return { files, total, pagina: paginaSegura, perPagina: PER_PAGINA_CELLERS };
}

export type DetallCeller = FitxaCeller & {
  persona_contacte: string | null;
  mobil: string | null;
  web: string | null;
  adreca: string | null;
  codi_postal: string | null;
  forma_pagament: string | null;
  retencio: number | string | null;
  descompte: number | string | null;
  iban: string | null;
  bic: string | null;
  banc: string | null;
  compte_comptable: string | null;
  data_alta: string | null;
  erp_modificat_el: string | null;
  observacions: string | null;
  notes: string | null;
};

const CAMPS_DETALL = [
  ...CAMPS,
  "persona_contacte", "mobil", "web", "adreca", "codi_postal", "forma_pagament", "retencio", "descompte",
  "iban", "bic", "banc", "compte_comptable", "data_alta", "erp_modificat_el", "observacions", "notes",
];

/** La fitxa sencera d'un celler, per a la seva pantalla de detall. */
export async function cellerPerId(id: string): Promise<DetallCeller | null> {
  return obteItem<DetallCeller>(COLLECCIO, id, CAMPS_DETALL);
}

/** Les províncies que hi ha de debò, per al desplegable del selector. */
export async function provinciesDeCellers(tipus = "") {
  try {
    return await agrupaPer(COLLECCIO, "provincia", tipus ? { tipus: { _eq: tipus } } : undefined);
  } catch {
    // Sense agrupació no hi ha filtre de província, però la cerca segueix.
    return [];
  }
}
