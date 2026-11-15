/**
 * Les fotos dels productes: les mides en què es serveixen.
 */

/** Com es demana una foto al portal: en miniatura per als llistats o sencera. */
export type MidaImatge = "petita" | "gran";

export function midaDImatge(valor: string | null | undefined): MidaImatge {
  return valor === "petita" ? "petita" : "gran";
}
