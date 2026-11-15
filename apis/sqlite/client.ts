/**
 * El que comparteixen les lectures i les escriptures de la base de dades: el
 * tipus d'error que en surt. El navegador no arriba mai aquí: `server-only`
 * fa que importar-ho des d'un component de client sigui un error de
 * compilació.
 */
import "server-only";

export type MotiuError = "configuracio" | "credencials" | "suspes" | "servei" | "xarxa";

export class ErrorDades extends Error {
  /** El codi HTTP equivalent de l'error, si n'hi ha: 4xx vol dir que les dades no valen. */
  readonly estat?: number;
  /** El camp que no existeix al model, si l'error és d'aquests. */
  readonly camp?: string;

  constructor(
    readonly motiu: MotiuError,
    missatge: string,
    detalls: { estat?: number; camp?: string } = {},
  ) {
    super(missatge);
    this.name = "ErrorDades";
    this.estat = detalls.estat;
    this.camp = detalls.camp;
  }
}
