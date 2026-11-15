export type MotiuFallada = "sense-credencials" | "autenticacio" | "consulta" | "xarxa";

/** Error de la capa FactuSol, amb el motiu separat per poder explicar-lo a la interfície. */
export class ErrorFactusol extends Error {
  /** Si val la pena tornar-ho a provar de seguida: la xarxa, un tall del gateway, una resposta que no és JSON. */
  readonly passatger: boolean;

  constructor(
    readonly motiu: MotiuFallada,
    missatge: string,
    opcions: { passatger?: boolean } = {},
  ) {
    super(missatge);
    this.name = "ErrorFactusol";
    this.passatger = opcions.passatger ?? motiu === "xarxa";
  }
}
