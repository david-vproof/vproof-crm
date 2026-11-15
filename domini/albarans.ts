/**
 * Els albarans de venda de FactuSol: capçaleres (F_ALB) i línies (F_LAL). Aquí
 * hi ha la lògica pura: quins exercicis es porten, com es diu cada albarà i
 * cada línia a Directus i quins camps s'hi copien. Qui llegeix i escriu és
 * `serveis/sincronitzacio.ts`; qui els ensenya a la fitxa del client,
 * `serveis/albarans.ts`.
 *
 * FactuSol té una base de dades per exercici i la numeració hi és pròpia: el
 * codi d'un albarà al portal porta l'exercici davant perquè no se'n trepitgin
 * dos de números iguals d'anys diferents.
 */
import { avuiLocal } from "./facturacio";
import type { CatalegsErp, ValorsErp } from "./sincronitzacio";

/** Quants exercicis enrere es porten, a més de l'actual. Les línies de tres anys serien massa per a cada passada. */
export const ANYS_ENRERE_ALBARANS = 1;

/** Els exercicis que es porten, del més antic a l'actual. */
export function exercicisDAlbarans(ara: Date) {
  const { any } = avuiLocal(ara);
  return Array.from({ length: ANYS_ENRERE_ALBARANS + 1 }, (_, i) => any - ANYS_ENRERE_ALBARANS + i);
}

/** Una fila de F_ALB, amb l'exercici d'on s'ha llegit. */
export type AlbaraErp = {
  TIPALB: string; // Sèrie
  CODALB: number; // Número dins de la sèrie i l'exercici
  FECALB: string; // Data (ISO)
  CLIALB: number; // Client (CODCLI)
  ESTALB: number; // Estat, tal com el desa FactuSol
  exercici: number;
};

/** Una fila de F_LAL, amb l'exercici d'on s'ha llegit. */
export type LiniaAlbaraErp = {
  TIPLAL: string; // Sèrie de l'albarà
  CODLAL: number; // Número de l'albarà
  POSLAL: number; // Posició de la línia
  ARTLAL: string; // Article (CODART)
  DESLAL: string; // Descripció, tal com surt a l'albarà
  CANLAL: number; // Quantitat
  PRELAL: number; // Preu unitari
  DT1LAL: number; // Descompte en percentatge
  TOTLAL: number; // Import de la línia, sense IVA
  exercici: number;
};

const text = (valor: unknown) => String(valor ?? "").trim();

/** «2026-1-345»: exercici, sèrie i número. És el codi_erp de l'albarà a Directus. */
export function codiAlbara(exercici: number, serie: unknown, numero: unknown) {
  return `${exercici}-${text(serie)}-${Number(numero)}`;
}

/** Com es llegeix un albarà: «1/345». */
export function numeroAlbara(serie: string | null, numero: number | null) {
  return serie ? `${serie}/${numero ?? "?"}` : String(numero ?? "?");
}

function arrodoneix(valor: unknown, decimals: number) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  const factor = 10 ** decimals;
  return Math.round(numero * factor) / factor;
}

function dataIso(valor: unknown) {
  const dia = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor ?? ""));
  return dia && Number(dia[1]) > 1900 ? dia[0] : null;
}

// ------------------------------------------------------------ capçaleres

/** Camps de crm_albarans que té l'ERP com a amo, en l'ordre que fa l'empremta. */
export const CAMPS_ERP_ALBARA = ["codi_erp", "exercici", "serie", "numero", "data", "client", "erp_client", "erp_estat"] as const;

/**
 * Els camps que rep Directus d'una fila de F_ALB. El client apunta a la seva
 * fitxa del CRM; si no n'hi ha (és de baixa, o no és a la còpia), queda buit i
 * la passada no el porta: vegeu `albaraAdmes`.
 */
export function valorsAlbaraDesDeErp(albara: AlbaraErp, { clients }: CatalegsErp): ValorsErp {
  const codiClient = Number(albara.CLIALB) || 0;
  return {
    codi_erp: codiAlbara(albara.exercici, albara.TIPALB, albara.CODALB),
    exercici: albara.exercici,
    serie: text(albara.TIPALB) || null,
    numero: Number(albara.CODALB),
    data: dataIso(albara.FECALB),
    client: codiClient ? (clients[String(codiClient)] ?? null) : null,
    erp_client: codiClient || null,
    erp_estat: Number(albara.ESTALB) || 0,
  };
}

/** Només es porten els albarans d'un client que surt al CRM: els de baixa no surten enlloc. */
export function albaraAdmes(valors: ValorsErp) {
  return valors.client !== null;
}

// ---------------------------------------------------------------- línies

/** Camps de crm_albarans_linies que té l'ERP com a amo, en l'ordre que fa l'empremta. */
export const CAMPS_ERP_LINIA = [
  "codi_erp", "albara", "posicio", "article", "erp_article", "descripcio", "quantitat", "preu", "descompte", "import",
] as const;

/** «2026-1-345-3»: el codi de l'albarà i la posició de la línia. */
export function codiLinia(linia: LiniaAlbaraErp) {
  return `${codiAlbara(linia.exercici, linia.TIPLAL, linia.CODLAL)}-${Number(linia.POSLAL)}`;
}

/**
 * Els camps que rep Directus d'una fila de F_LAL. `albarans` i `articles` van
 * del codi a l'id de Directus. Una línia d'un albarà que no es porta no
 * n'ha de tenir: torna null.
 */
export function valorsLiniaDesDeErp(
  linia: LiniaAlbaraErp,
  albarans: Map<string, string>,
  articles: Record<string, string>,
): ValorsErp | null {
  const albara = albarans.get(codiAlbara(linia.exercici, linia.TIPLAL, linia.CODLAL));
  if (!albara) return null;
  const codiArticle = text(linia.ARTLAL);
  const descompte = arrodoneix(linia.DT1LAL, 2);
  return {
    codi_erp: codiLinia(linia),
    albara,
    posicio: Number(linia.POSLAL),
    // Una línia de text lliure no porta article; un article que no és actiu no és a la còpia.
    article: codiArticle ? (articles[codiArticle] ?? null) : null,
    erp_article: codiArticle || null,
    descripcio: text(linia.DESLAL) || null,
    quantitat: arrodoneix(linia.CANLAL, 3),
    preu: arrodoneix(linia.PRELAL, 4),
    descompte: descompte || null,
    import: arrodoneix(linia.TOTLAL, 2),
  };
}

// ------------------------------------------------------- a la fitxa del client

/** Una línia tal com la llegeix la fitxa. Directus torna els decimals com a text. */
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
