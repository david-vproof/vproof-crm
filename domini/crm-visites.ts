/**
 * Quant fa que no es visita un client, en trams de tres mesos: és el que
 * pinta el fons de cada fila de la llista de clients, perquè d'un cop d'ull
 * es vegi a qui toca anar a veure.
 *
 * Va sense cap import, com la periodicitat: només calcula amb dies AAAA-MM-DD.
 */

/** Mesos que dura cada tram. */
export const MESOS_PER_TRAM = 3;

/** Del més recent (0) al més oblidat (3). Qui no té cap activitat cau a l'últim. */
export type TramVisita = 0 | 1 | 2 | 3;

export const TRAMS_VISITA: { tram: TramVisita; etiqueta: string }[] = [
  { tram: 0, etiqueta: "Menys de 3 mesos" },
  { tram: 1, etiqueta: "De 3 a 6 mesos" },
  { tram: 2, etiqueta: "De 6 a 9 mesos" },
  { tram: 3, etiqueta: "Més de 9 mesos o mai" },
];

const UN_DIA = 86_400_000;

const instantDe = (dia: string) => {
  const [any, mes, dd] = dia.split("-").map(Number);
  return Date.UTC(any, mes - 1, dd);
};

/** Dies sencers de `darrera` a `dia`. Negatiu si la darrera encara ha de venir. */
export function diesDesDe(darrera: string, dia: string): number {
  return Math.round((instantDe(dia) - instantDe(darrera)) / UN_DIA);
}

/**
 * Mesos sencers de calendari de `darrera` a `dia`: del 15 de gener al 14
 * d'abril en són dos, i el 15 d'abril ja en són tres.
 */
export function mesosDesDe(darrera: string, dia: string): number {
  const [anyD, mesD, ddD] = darrera.split("-").map(Number);
  const [anyA, mesA, ddA] = dia.split("-").map(Number);
  const mesos = (anyA - anyD) * 12 + (mesA - mesD) - (ddA < ddD ? 1 : 0);
  return Math.max(0, mesos);
}

/** El tram que toca a data de `dia`. Sense cap activitat, l'últim. */
export function tramDeVisita(darrera: string | null, dia: string): TramVisita {
  if (!darrera) return 3;
  return Math.min(3, Math.floor(mesosDesDe(darrera, dia) / MESOS_PER_TRAM)) as TramVisita;
}

const DIA_CURT = (dia: string) => {
  const [any, mes, dd] = dia.split("-");
  return `${Number(dd)}/${Number(mes)}/${any}`;
};

/** «Darrera activitat fa 4 mesos (12/6/2026)», «Darrera activitat fa 12 dies», «Sense cap activitat». */
export function descriuDarreraVisita(darrera: string | null, dia: string): string {
  if (!darrera) return "Sense cap activitat";
  const dies = diesDesDe(darrera, dia);
  if (dies <= 0) return `Darrera activitat avui (${DIA_CURT(darrera)})`;
  if (dies === 1) return `Darrera activitat ahir (${DIA_CURT(darrera)})`;
  const mesos = mesosDesDe(darrera, dia);
  if (mesos === 0) return `Darrera activitat fa ${dies} dies (${DIA_CURT(darrera)})`;
  if (mesos < 24) return `Darrera activitat fa ${mesos === 1 ? "1 mes" : `${mesos} mesos`} (${DIA_CURT(darrera)})`;
  const anys = Math.floor(mesos / 12);
  return `Darrera activitat fa ${anys} anys (${DIA_CURT(darrera)})`;
}
