/**
 * Els establiments dels clients: les direccions d'entrega de l'ERP, de la
 * còpia que en manté la sincronització de clients (`crm_establiments`). Les
 * dades són de l'ERP i s'hi canvien; el que és del portal és el punt del mapa,
 * que es pot situar o moure des de la fitxa.
 *
 * Un establiment que desapareix de l'ERP, o el d'un client que passa a baixa,
 * no s'esborra de la còpia: queda marcat com a absent. Per això totes les
 * lectures d'aquí el deixen fora.
 */
import "server-only";

import { actualitzaItem, llistaAmbTotal, type Condicio } from "@/apis/sqlite/crm";

export const COLLECCIO_ESTABLIMENTS = "crm_establiments";

/** Només els que avui són a l'ERP. */
export const ESTABLIMENTS_VIUS: Condicio = { erp_absent_des_de: { _null: true } };

/**
 * Només els que són un punt d'entrega de producte: a l'ERP, la marca «dirección
 * de entrega por defecto para la impresión de partes de reparación» (REPOBR)
 * s'hi fa servir per assenyalar les adreces que no ho són. El mapa les deixa fora.
 */
export const ESTABLIMENTS_DENTREGA: Condicio = { per_reparacions: { _eq: false } };

export type Establiment = {
  id: string;
  nom: string | null;
  /** El número de l'adreça dins del client, a l'ERP. */
  erp_codi: number | null;
  adreca: string | null;
  codi_postal: string | null;
  poblacio: string | null;
  provincia: string | null;
  pais: string | null;
  telefon: string | null;
  persona_contacte: string | null;
  correu: string | null;
  latitud: number | string | null;
  longitud: number | string | null;
  /** Marcada a l'ERP com a adreça per a parts de reparació: no és un punt d'entrega i no surt al mapa. */
  per_reparacions: boolean | null;
};

export const CAMPS_ESTABLIMENT = [
  "id", "nom", "erp_codi", "adreca", "codi_postal", "poblacio", "provincia", "pais", "telefon", "persona_contacte", "correu",
  "latitud", "longitud", "per_reparacions",
];

/** Els establiments d'un client, en l'ordre de l'ERP, per a la pestanya de la seva fitxa. */
export async function establimentsDelClient(client: string): Promise<Establiment[]> {
  const { files } = await llistaAmbTotal<Establiment>(COLLECCIO_ESTABLIMENTS, {
    camps: CAMPS_ESTABLIMENT,
    ordre: "erp_codi",
    limit: -1,
    condicions: [ESTABLIMENTS_VIUS, { client: { _eq: client } }],
  });
  return files;
}

/**
 * El punt del mapa d'un establiment, posat a mà des de la fitxa del client.
 * És l'únic que no és de l'ERP: la sincronització no el toca. Les
 * coordenades arriben tal com les dona el mapa; fora de rang no es desen.
 */
export async function desaPuntEstabliment(id: string, latitud: number, longitud: number) {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud) || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    throw new Error("El punt no és vàlid.");
  }
  await actualitzaItem(COLLECCIO_ESTABLIMENTS, id, { latitud: Number(latitud.toFixed(6)), longitud: Number(longitud.toFixed(6)) });
}
