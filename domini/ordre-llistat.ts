/**
 * L'ordre d'un llistat per columna, tal com viatja a l'URL i com s'aplica.
 *
 *   ordre=poblacio    ascendent      ordre=-poblacio    descendent
 *
 * El fa servir qualsevol llistat que no sigui una fitxa del CRM (aquelles
 * tenen el seu a `crm-llistat.ts`, lligat a la definició de la fitxa): les
 * pantalles de l'ERP, que llegeixen de l'ERP o de la seva còpia.
 */

export type Ordre = { camp: string; descendent: boolean };

/** Una columna per la qual es pot ordenar, amb el nom que surt al desplegable. */
export type ColumnaOrdenable = { camp: string; etiqueta: string };

export const PARAM_ORDRE = "ordre";

/** L'ordre de l'URL, només si és d'una columna coneguda: qualsevol altra cosa s'ignora. */
export function llegeixOrdre(brut: string | string[] | undefined, columnes: ColumnaOrdenable[]): Ordre | null {
  const text = (Array.isArray(brut) ? brut[0] : brut ?? "").trim();
  if (!text) return null;
  const descendent = text.startsWith("-");
  const camp = descendent ? text.slice(1) : text;
  return columnes.some((columna) => columna.camp === camp) ? { camp, descendent } : null;
}

/** L'ordre tal com va a l'URL; buit si no n'hi ha. */
export function escriuOrdre(ordre: Ordre | null) {
  return ordre ? `${ordre.descendent ? "-" : ""}${ordre.camp}` : "";
}

/** Clicar la capçalera va d'ascendent a descendent i després treu l'ordre. */
export function seguentOrdre(actual: Ordre | null, camp: string): Ordre | null {
  if (actual?.camp !== camp) return { camp, descendent: false };
  return actual.descendent ? null : { camp, descendent: true };
}

/** El valor pel qual s'ordena una fila; buit o nul, va al final. */
export type ClauDOrdre<F> = (fila: F) => string | number | null | undefined;

function esBuit(valor: string | number | null | undefined) {
  return valor === null || valor === undefined || (typeof valor === "string" && valor.trim() === "");
}

function compara(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  // «numeric» perquè el codi 9 vagi abans del 10 i l'anyada 2019 abans de la 2020.
  return String(a).localeCompare(String(b), "ca", { numeric: true, sensitivity: "base" });
}

/**
 * Ordena a memòria les files d'un llistat que ja s'ha llegit sencer. Els
 * valors buits van sempre al final, pugi o baixi l'ordre; a igualtat mana la
 * clau per defecte, perquè la llista no balli entre una pàgina i l'altra.
 */
export function ordena<F>(files: F[], ordre: Ordre | null, claus: Record<string, ClauDOrdre<F>>, perDefecte?: ClauDOrdre<F>): F[] {
  const clau = ordre ? claus[ordre.camp] : undefined;
  if (!ordre || !clau) return files;
  const sentit = ordre.descendent ? -1 : 1;
  return [...files].sort((x, y) => {
    const a = clau(x);
    const b = clau(y);
    const buitA = esBuit(a);
    const buitB = esBuit(b);
    if (buitA || buitB) return buitA === buitB ? 0 : buitA ? 1 : -1;
    const resultat = compara(a!, b!) * sentit;
    if (resultat !== 0 || !perDefecte) return resultat;
    const [da, db] = [perDefecte(x), perDefecte(y)];
    return esBuit(da) || esBuit(db) ? 0 : compara(da!, db!);
  });
}
