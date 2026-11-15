/**
 * La periodicitat d'un client: quantes activitats l'any s'hi volen fer, i com
 * es va respecte d'això enguany.
 *
 * Va a part i sense cap import, com la tendència de facturació: la fitxa de
 * clients (`crm-fitxes.ts`) en necessita les opcions i no hi ha d'entrar cap cicle.
 */

/** Valor desat: activitats l'any. Així la columna s'ordena de menys a més sovint. */
export const PERIODICITATS: [string, string][] = [
  ["52", "Setmanal (52 l'any)"],
  ["26", "Quinzenal (26 l'any)"],
  ["12", "Mensual (12 l'any)"],
  ["6", "Bimestral (6 l'any)"],
  ["4", "Trimestral (4 l'any)"],
  ["3", "Quadrimestral (3 l'any)"],
  ["2", "Semestral (2 l'any)"],
  ["1", "Anual (1 l'any)"],
];

/** Com es diu a la cel·la, on l'etiqueta sencera no hi cap. */
export const PERIODICITATS_CURTES: Record<string, string> = Object.fromEntries(
  PERIODICITATS.map(([valor, etiqueta]) => [valor, etiqueta.split(" ")[0]]),
);

export const SEGUIMENTS: [string, string][] = [
  ["complert", "Objectiu complert"],
  ["al_dia", "Al dia"],
  ["a_prop", "Una mica endarrerit"],
  ["endarrerit", "Endarrerit"],
];

/**
 * Per sota de quina part del que tocava ja no es parla d'anar «una mica»
 * endarrerit. Amb poques activitats l'any, una sola que falti ja hi cau.
 */
export const LLINDAR_A_PROP = 0.75;

export type Seguiment = {
  /** Activitats l'any que es volen fer. */
  objectiu: number;
  /** Les fetes des de l'1 de gener fins ara. */
  fetes: number;
  /** Les que, a data d'avui i repartides per l'any, ja s'haurien d'haver fet. Amb decimals. */
  esperades: number;
  /** Les que falten per estar al dia, senceres. Zero si no en falta cap. */
  falten: number;
  estat: string;
};

/** Quina part de l'any ha passat, de 0 a 1, amb l'1 de gener i el 31 de desembre sencers. */
export function partDeLAny(dia: string): number {
  const [any, mes, dd] = dia.split("-").map(Number);
  const inici = Date.UTC(any, 0, 1);
  const dies = (Date.UTC(any + 1, 0, 1) - inici) / 86_400_000;
  const passats = (Date.UTC(any, mes - 1, dd) - inici) / 86_400_000 + 1;
  return Math.min(1, Math.max(0, passats / dies));
}

/**
 * Com va un client respecte de la seva periodicitat, a data de `dia`
 * (AAAA-MM-DD, del fus del negoci). Sense periodicitat, no se'n diu res.
 *
 * Es compta per activitats senceres: el que falta és la part entera del que
 * tocava menys les fetes. Així, a l'estiu, un client trimestral amb dues
 * visites va al dia encara que en toquessin 2,6, i al gener ningú no va
 * endarrerit perquè encara no n'hi tocava cap.
 */
export function seguimentDe(periodicitat: unknown, fetes: number, dia: string): Seguiment | null {
  const objectiu = Number(periodicitat);
  if (!Number.isFinite(objectiu) || objectiu <= 0) return null;

  const esperades = objectiu * partDeLAny(dia);
  const falten = Math.max(0, Math.floor(esperades) - fetes);
  const estat =
    fetes >= objectiu
      ? "complert"
      : falten === 0
        ? "al_dia"
        : fetes >= esperades * LLINDAR_A_PROP
          ? "a_prop"
          : "endarrerit";
  return { objectiu, fetes, esperades, falten, estat };
}
