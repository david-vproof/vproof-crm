/**
 * La tendència de facturació d'un client i el resum que se'n desa a la seva
 * fitxa, perquè la llista de clients el pugui ensenyar, ordenar i filtrar.
 *
 * Va a part de `domini/facturacio.ts` i sense cap import: la fitxa de clients
 * (`crm-fitxes.ts`) en necessita les opcions, i així no hi entra cap cicle.
 */

/** A partir de quina variació respecte de l'any passat es parla de créixer o baixar. */
export const LLINDAR_TENDENCIA = 10;

export const TENDENCIES: [string, string][] = [
  ["creix", "Creix"],
  ["estable", "Estable"],
  ["baixa", "Baixa"],
  ["nou", "Nou"],
  ["perdut", "Perdut"],
  ["sense", "Sense facturació"],
];

/** Els camps de `crm_clients` que porten el resum. Els calcula la sincronització. */
export const CAMPS_RESUM_FACTURACIO = [
  "facturacio_exercici",
  "facturacio_fins_mes",
  "facturacio_any_2",
  "facturacio_any_1",
  "facturacio_periode_2",
  "facturacio_periode_1",
  "facturacio_periode",
  "facturacio_variacio",
  "facturacio_tendencia",
] as const;

export type ResumClient = {
  /** L'any en curs quan es va calcular. */
  facturacio_exercici: number;
  /** L'últim mes tancat quan es va calcular: el període va de gener fins aquí. */
  facturacio_fins_mes: number;
  facturacio_any_2: number;
  facturacio_any_1: number;
  facturacio_periode_2: number;
  facturacio_periode_1: number;
  facturacio_periode: number;
  facturacio_variacio: number | null;
  facturacio_tendencia: string | null;
};

/**
 * Com va el client: el període d'enguany contra el mateix de l'any passat.
 * Al gener encara no hi ha cap mes tancat, i no se'n diu res.
 */
export function tendenciaDe({
  finsMes,
  actual,
  anterior,
  totalsAnteriors,
}: {
  finsMes: number;
  actual: number;
  anterior: number;
  /** Els dos exercicis sencers d'abans: qui hi facturava i ara no, s'ha perdut. */
  totalsAnteriors: number;
}): string | null {
  if (finsMes <= 0) return null;
  if (actual <= 0) return anterior > 0 || totalsAnteriors > 0 ? "perdut" : "sense";
  if (anterior <= 0) return "nou";
  const variacio = ((actual - anterior) / anterior) * 100;
  return variacio >= LLINDAR_TENDENCIA ? "creix" : variacio <= -LLINDAR_TENDENCIA ? "baixa" : "estable";
}
