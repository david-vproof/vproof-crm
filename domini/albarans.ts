/**
 * Els albarans de venda dels clients (`crm_albarans` i les seves línies,
 * `crm_albarans_linies`): la lògica pura per ensenyar-los a la fitxa del
 * client. Els portarà l'ERP (vprooferp); qui els llegeix és `serveis/albarans.ts`.
 */

/** Quants exercicis enrere s'ensenyen, a més de l'actual. */
export const ANYS_ENRERE_ALBARANS = 1;

/** Com es llegeix un albarà: «1/345». */
export function numeroAlbara(serie: string | null, numero: number | null) {
  return serie ? `${serie}/${numero ?? "?"}` : String(numero ?? "?");
}

// ------------------------------------------------------- a la fitxa del client

/** Una línia tal com la llegeix la fitxa. Els decimals poden arribar com a text. */
export type LiniaDeFitxa = {
  id: string;
  posicio: number | null;
  descripcio: string | null;
  erp_article: string | null;
  quantitat: number | string | null;
  preu: number | string | null;
  descompte: number | string | null;
  import: number | string | null;
  erp_absent_des_de: string | null;
  article: { id: string; nom: string | null; imatge: string | null } | null;
};

export type AlbaraDeFitxa = {
  id: string;
  serie: string | null;
  numero: number | null;
  data: string | null;
  linies: LiniaDeFitxa[] | null;
};

export function numero(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Les línies vigents d'un albarà, en l'ordre de l'albarà, i el seu import sumat. */
export function liniesDAlbara(albara: AlbaraDeFitxa) {
  const linies = (albara.linies ?? [])
    .filter((linia) => !linia.erp_absent_des_de)
    .sort((a, b) => (a.posicio ?? 0) - (b.posicio ?? 0));
  const total = linies.reduce((suma, linia) => suma + (numero(linia.import) ?? 0), 0);
  return { linies, total: Math.round(total * 100) / 100 };
}
