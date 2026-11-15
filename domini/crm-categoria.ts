/**
 * La categoria dels clients, calculada per franges de facturació.
 *
 * Cada lletra comença a partir d'un import de facturació de l'exercici passat
 * sencer (base imposable, sense IVA), i al client li toca la de la franja on
 * cau. Les franges es desen a Directus (`crm_categories`) i es canvien a
 * Configuració. Tot és càlcul pur. No s'ha de confondre amb el potencial, que
 * és la mateixa escala però la posa a mà qui porta el compte.
 */
import type { Lletra } from "./crm-fitxes";

export type Franja = { lletra: Lletra; desDe: number };

/** De la més baixa a la més alta: cada una ha de començar per sobre de l'anterior. */
export const ORDRE_FRANGES: Lletra[] = ["E", "D", "C", "B", "A"];

/** El quadre de partida: E fins a 1.500 €, D fins a 2.500 €, C fins a 5.000 €, B fins a 7.500 € i A a partir d'aquí. */
export const FRANGES_PER_DEFECTE: Franja[] = [
  { lletra: "E", desDe: 0 },
  { lletra: "D", desDe: 1500 },
  { lletra: "C", desDe: 2500 },
  { lletra: "B", desDe: 5000 },
  { lletra: "A", desDe: 7500 },
];

/** Les franges tal com arriben de Directus. Una lletra que hi falti agafa el valor de partida. */
export function llegeixFranges(files: { lletra: string | null; des_de: number | string | null }[]): Franja[] {
  return ORDRE_FRANGES.map((lletra) => {
    const fila = files.find((f) => f.lletra === lletra);
    const desDe = Number(fila?.des_de);
    return { lletra, desDe: fila && Number.isFinite(desDe) ? desDe : FRANGES_PER_DEFECTE.find((f) => f.lletra === lletra)!.desDe };
  });
}

/** Per què unes franges no valen, o res si valen. */
export function validaFranges(franges: Franja[]): string | null {
  let anterior: Franja | null = null;
  for (const lletra of ORDRE_FRANGES) {
    const franja = franges.find((f) => f.lletra === lletra);
    if (!franja || !Number.isFinite(franja.desDe)) return `Cal un import per a la lletra ${lletra}.`;
    if (franja.desDe < 0) return "Els imports no poden ser negatius.";
    if (anterior && franja.desDe <= anterior.desDe) {
      return `La franja ${lletra} ha de començar per sobre de la ${anterior.lletra} (${anterior.desDe} €).`;
    }
    anterior = franja;
  }
  return null;
}

/** La lletra d'una facturació. Per sota de la franja més baixa —una facturació negativa— també és la més baixa. */
export function categoriaDe(facturacio: number, franges: Franja[]): Lletra {
  const base = Number.isFinite(facturacio) ? facturacio : 0;
  for (const lletra of [...ORDRE_FRANGES].reverse()) {
    const franja = franges.find((f) => f.lletra === lletra);
    if (franja && base >= franja.desDe) return lletra;
  }
  return ORDRE_FRANGES[0];
}
