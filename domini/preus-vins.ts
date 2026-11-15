/**
 * El preu dels vins als selectors: el preu de venda sense IVA que l'ERP deixa a
 * cada producte. Va a part del catàleg: per vi, un preu, i un criteri per
 * quedar-se entre dos preus.
 *
 * Lògica pura: el servei el llegeix i el navegador en fa el criteri.
 */

/** Per vi (id d'article), el preu de la tarifa sense IVA. Un vi que no hi és no té preu a la tarifa. */
export type Preus = Record<string, number>;

/** El criteri: entre un mínim i un màxim, en euros, tal com s'escriuen al camp. Buits, no filtren. */
export type FiltrePreu = { minim: string; maxim: string };

export const FILTRE_PREU_BUIT: FiltrePreu = { minim: "", maxim: "" };

/** «12,5» o «12.5» → 12.5; buit o il·legible → null. */
export function importDeCamp(text: string): number | null {
  const net = text.trim().replace(",", ".");
  if (!net) return null;
  const numero = Number(net);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function filtrePreuActiu(filtre: FiltrePreu) {
  return importDeCamp(filtre.minim) !== null || importDeCamp(filtre.maxim) !== null;
}

/**
 * Si el vi passa el criteri de preu. Sense preus llegits (null) o sense
 * límits, no filtra. Amb límits, un vi sense preu a la tarifa no passa: no se
 * sap quant val, i qui filtra per preu busca els que en tenen.
 */
export function passaFiltrePreu(id: string, preus: Preus | null, filtre: FiltrePreu) {
  if (!preus) return true;
  const minim = importDeCamp(filtre.minim);
  const maxim = importDeCamp(filtre.maxim);
  if (minim === null && maxim === null) return true;
  const preu = preus[id];
  if (preu === undefined) return false;
  return (minim === null || preu >= minim) && (maxim === null || preu <= maxim);
}

/** Els preus per vi a partir de la columna `preu` dels productes: els que no en tenen no hi surten. */
export function preusDeProductes(files: { id: string; preu: number | string | null }[]): Preus {
  const preus: Preus = {};
  for (const fila of files) {
    const preu = Number(fila.preu);
    if (fila.preu !== null && fila.preu !== "" && Number.isFinite(preu)) preus[fila.id] = preu;
  }
  return preus;
}
