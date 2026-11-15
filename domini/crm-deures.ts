/**
 * Els deures que deixa una activitat en tancar-se.
 *
 * En tancar una visita no n'hi ha prou d'apuntar què es farà després en una
 * línia de text: del que es diu asseguts en surten diverses coses per fer, i
 * cadascuna es tanca pel seu compte. Per això són N i no una, i per això
 * viatgen fins a la propera visita del mateix compte, on es marquen.
 *
 * Es desen com a tasques del CRM, que ja porten estat, responsable i de quina
 * activitat vénen: un deure no és res més que una tasca nascuda d'un tancament
 * o apuntada a mà a la fitxa del client, i llavors sense activitat.
 *
 * Tot és càlcul pur: aquí només s'hi neteja i s'hi ordena.
 */

/** Fins on s'estira un deure. Prou per a una frase, no per a un acta. */
export const MAXIM_TEXT = 160;

/** Quants se n'accepten d'una tirada: passat això és una llista de la compra. */
export const MAXIM_DEURES = 20;

export type Deure = {
  id: string;
  text: string;
  fet: boolean;
  /** Prioritat de la tasca, per si algú l'ha apujada des de la base de dades. */
  prioritat: string;
  /** Data de venciment, si en té. */
  venciment: string;
  /** De quina activitat ve, per poder dir d'on surt. Buit si s'ha apuntat a mà. */
  activitat: string;
  /** Assumpte i dia de l'activitat que el va deixar, o «Apuntat a mà» i el dia, per situar-lo. */
  origen: string;
};

/**
 * Neteja el que arriba del formulari. Es retallen els espais, es deixen fora
 * els buits i els repetits —escriure dues vegades el mateix deure és un
 * lliscada, no dues feines— i es talla la llista si s'ha anat de mare.
 */
export function llegeixDeures(brut: unknown): string[] {
  const files = Array.isArray(brut) ? brut : [];
  const nets: string[] = [];

  for (const fila of files) {
    if (typeof fila !== "string") continue;
    const text = fila.trim().replace(/\s+/g, " ").slice(0, MAXIM_TEXT);
    if (!text) continue;
    if (nets.some((previ) => previ.toLowerCase() === text.toLowerCase())) continue;
    nets.push(text);
    if (nets.length === MAXIM_DEURES) break;
  }

  return nets;
}

/** El mateix, però des del text pla d'un camp ocult amb JSON. */
export function llegeixDeuresJson(brut: unknown): string[] {
  if (typeof brut !== "string") return llegeixDeures(brut);
  try {
    return llegeixDeures(JSON.parse(brut));
  } catch {
    return [];
  }
}

/**
 * Els deures per pintar-los: primer el que queda per fer i, dins de cada grup,
 * el més antic al davant. El que fa temps que penja és el que convé tancar.
 */
export function ordenaDeures(deures: Deure[]): Deure[] {
  return [...deures].sort(
    (a, b) =>
      Number(a.fet) - Number(b.fet) ||
      a.origen.localeCompare(b.origen, "ca") ||
      a.text.localeCompare(b.text, "ca"),
  );
}

export function comptaPendents(deures: Deure[]) {
  return deures.filter((deure) => !deure.fet).length;
}
