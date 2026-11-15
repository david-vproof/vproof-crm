/** Abreviatures de mes per als eixos dels gràfics. */
const MESOS_CURTS = ["gen", "feb", "mar", "abr", "mai", "jun", "jul", "ago", "set", "oct", "nov", "des"];

/** "2026-09" → "set 26" */
export function etiquetaMes(clau: string) {
  const [any, mes] = clau.split("-");
  return `${MESOS_CURTS[Number(mes) - 1]} ${any.slice(2)}`;
}
