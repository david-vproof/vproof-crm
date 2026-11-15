/**
 * Els atributs d'un client: frases curtes que el caracteritzen («terrassa amb
 * vistes», «carta de productes naturals», «tanca els dilluns»). Cadascun és un
 * registre de `crm_client_atributs`; s'hi posen des de la pestanya Atributs de
 * la fitxa o en tancar una activitat del client.
 *
 * Aquí hi ha la neteja del que arriba dels formularis; qui llegeix i escriu és
 * `serveis/atributs.ts`.
 */

/** Llarg màxim d'un atribut: és una etiqueta, no una nota. */
export const MAXIM_TEXT_ATRIBUT = 120;
/** Quants se'n poden afegir de cop en tancar una activitat. */
export const MAXIM_ATRIBUTS_DE_COP = 20;

export type Atribut = {
  id: string;
  text: string;
  /** Quan es va posar (ISO). */
  creat: string | null;
  /** Qui el va posar, si se sap. */
  qui: string | null;
  /** L'assumpte de l'activitat en què es va apuntar, si va ser en tancar-ne una. */
  activitat: string | null;
};

/** Un atribut net: sense espais de sobres i tallat al llarg màxim. Buit si no hi ha res. */
export function netejaAtribut(brut: unknown) {
  return typeof brut === "string" ? brut.trim().replace(/\s+/g, " ").slice(0, MAXIM_TEXT_ATRIBUT) : "";
}

/** Si dos atributs diuen el mateix: sense distingir majúscules. */
export function mateixAtribut(a: string, b: string) {
  return a.toLocaleLowerCase("ca") === b.toLocaleLowerCase("ca");
}

/**
 * Els atributs que arriben d'un camp ocult amb JSON (el tancament d'una
 * activitat): nets, sense buits ni repetits i com a molt `MAXIM_ATRIBUTS_DE_COP`.
 */
export function llegeixAtributsJson(brut: unknown): string[] {
  let files: unknown;
  try {
    files = typeof brut === "string" ? JSON.parse(brut) : brut;
  } catch {
    return [];
  }
  const nets: string[] = [];
  for (const fila of Array.isArray(files) ? files : []) {
    const text = netejaAtribut(fila);
    if (!text || nets.some((previ) => mateixAtribut(previ, text))) continue;
    nets.push(text);
    if (nets.length === MAXIM_ATRIBUTS_DE_COP) break;
  }
  return nets;
}
