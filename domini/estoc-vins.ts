/**
 * L'estoc dels vins, per al selector de vins.
 *
 * El deixa l'ERP a cada producte, amb dues xifres: l'actual (el que hi ha
 * físicament) i el disponible (l'actual menys el que ja està compromès en
 * comandes). Lògica pura: s'agrega aquí i el navegador en fa el criteri i la
 * marca.
 */

/** L'estoc d'un vi en un magatzem. */
export type EstocMagatzem = { codi: string; nom: string; actual: number; disponible: number };

/** L'estoc d'un vi: la suma de tots els magatzems i el desglòs, en l'ordre dels magatzems. */
export type EstocVi = { actual: number; disponible: number; magatzems: EstocMagatzem[] };

/** Per vi (id d'article), el seu estoc. Un vi que no hi és no en té enlloc. */
export type Estocs = Record<string, EstocVi>;

/** El criteri: tots els vins, només els que tenen estoc disponible, o només els que no en tenen. */
export type FiltreEstoc = "tots" | "amb" | "sense";

export const FILTRES_ESTOC: { valor: FiltreEstoc; etiqueta: string }[] = [
  { valor: "tots", etiqueta: "Tant si en tenim com si no" },
  { valor: "amb", etiqueta: "Només amb estoc disponible" },
  { valor: "sense", etiqueta: "Només sense estoc disponible" },
];

const numero = (valor: unknown) => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
};

/** Una fila de producte amb l'estoc que hi ha deixat l'ERP: l'actual i el disponible. */
export type EstocDeProducte = { id: string; estoc_actual: number | string | null; estoc_disponible: number | string | null };

/**
 * De les columnes d'estoc dels productes a l'estoc per vi. Tot és d'un sol
 * magatzem, el general, fins que l'ERP en porti el desglòs. Els que tenen les
 * dues xifres buides o a zero no hi surten: no en tenim enlloc.
 */
export function estocsDeProductes(files: EstocDeProducte[]): Estocs {
  const estocs: Estocs = {};
  for (const fila of files) {
    const actual = numero(fila.estoc_actual);
    const disponible = fila.estoc_disponible === null || fila.estoc_disponible === "" ? actual : numero(fila.estoc_disponible);
    if (actual === 0 && disponible === 0) continue;
    estocs[fila.id] = { actual, disponible, magatzems: [{ codi: "general", nom: "General", actual, disponible }] };
  }
  return estocs;
}

/** Si el vi passa el criteri d'estoc. Sense estocs llegits (null), no filtra. */
export function passaFiltreEstoc(id: string, estocs: Estocs | null, filtre: FiltreEstoc) {
  if (!estocs || filtre === "tots") return true;
  const disponible = estocs[id]?.disponible ?? 0;
  return filtre === "amb" ? disponible > 0 : disponible <= 0;
}
