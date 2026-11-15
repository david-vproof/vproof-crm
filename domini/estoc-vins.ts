/**
 * L'estoc dels vins, per al selector de vins.
 *
 * Ve de FactuSol en viu, no de la sincronització: canvia amb cada albarà i la
 * passada va a hores. FactuSol el té a F_STO, una fila per article i
 * magatzem, amb dues xifres: l'actual (ACTSTO, el que hi ha físicament) i el
 * disponible (DISSTO, l'actual menys el que ja està compromès en comandes).
 * Els magatzems són a F_ALM; els de la bodega porten un número davant del
 * nom («1 GENERAL», «8 SANT BARTOMEU DE GRAU»), que els ordena.
 *
 * Lògica pura: s'agrega aquí i el navegador en fa el criteri i la marca.
 */
import { nomDeLloc } from "@/lib/format";

/** Una fila de F_STO: l'article, el magatzem i les dues xifres. */
export type EstocErp = { ARTSTO: string; ALMSTO: string; ACTSTO: number | string | null; DISSTO: number | string | null };

/** Una fila de F_ALM: el codi i el nom del magatzem. */
export type MagatzemErp = { CODALM: string; NOMALM: string | null };

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

/**
 * El nom d'un magatzem tal com s'ensenya: sense el número de davant i com a
 * nom propi («8 SANT BARTOMEU DE GRAU» → «Sant Bartomeu de Grau»). Si no té
 * nom, el codi.
 */
export function nomDeMagatzem(magatzem: MagatzemErp) {
  const net = (magatzem.NOMALM ?? "").replace(/^\s*\d+\s*/, "").trim();
  return net ? nomDeLloc(net) : magatzem.CODALM.trim();
}

/** L'ordre dels magatzems: el número de davant del nom, i després el nom. */
function ordreDeMagatzem(magatzem: MagatzemErp) {
  const numero = /^\s*(\d+)/.exec(magatzem.NOMALM ?? "");
  return numero ? Number(numero[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * De les files de F_STO a l'estoc per vi. `idPerCodi` diu quin article del
 * portal és cada CODART; les files d'articles que no hi són (descatalogats) no
 * compten. Els magatzems on un vi té les dues xifres a zero no surten al
 * desglòs: només hi ha els que diuen alguna cosa.
 */
export function agregaEstoc(files: EstocErp[], magatzems: MagatzemErp[], idPerCodi: Map<string, string>): Estocs {
  const ordenats = [...magatzems].sort((a, b) => ordreDeMagatzem(a) - ordreDeMagatzem(b) || nomDeMagatzem(a).localeCompare(nomDeMagatzem(b), "ca"));
  const posicio = new Map(ordenats.map((magatzem, i) => [magatzem.CODALM.trim(), i]));
  const noms = new Map(ordenats.map((magatzem) => [magatzem.CODALM.trim(), nomDeMagatzem(magatzem)]));

  const estocs: Estocs = {};
  for (const fila of files) {
    const id = idPerCodi.get(String(fila.ARTSTO ?? "").trim());
    if (!id) continue;
    const actual = numero(fila.ACTSTO);
    const disponible = numero(fila.DISSTO);
    if (actual === 0 && disponible === 0) continue;
    const codi = String(fila.ALMSTO ?? "").trim();
    const estoc = (estocs[id] ??= { actual: 0, disponible: 0, magatzems: [] });
    estoc.actual += actual;
    estoc.disponible += disponible;
    estoc.magatzems.push({ codi, nom: noms.get(codi) ?? codi, actual, disponible });
  }
  for (const estoc of Object.values(estocs)) {
    estoc.magatzems.sort((a, b) => (posicio.get(a.codi) ?? Number.MAX_SAFE_INTEGER) - (posicio.get(b.codi) ?? Number.MAX_SAFE_INTEGER));
  }
  return estocs;
}

/** Si el vi passa el criteri d'estoc. Sense estocs llegits (null), no filtra. */
export function passaFiltreEstoc(id: string, estocs: Estocs | null, filtre: FiltreEstoc) {
  if (!estocs || filtre === "tots") return true;
  const disponible = estocs[id]?.disponible ?? 0;
  return filtre === "amb" ? disponible > 0 : disponible <= 0;
}
