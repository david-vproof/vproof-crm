/**
 * Base compartida per parlar amb Directus des del servidor.
 *
 * La identitat i el CRM en pengen tots dos. El navegador no arriba mai aquí:
 * `server-only` fa que importar-ho des d'un component de client sigui un error
 * de compilació, no una fuita.
 */
import "server-only";

export type MotiuError = "configuracio" | "credencials" | "suspes" | "servei" | "xarxa";

export class ErrorDirectus extends Error {
  /** El codi HTTP amb què ha respost Directus, si ha arribat a respondre. */
  readonly estat?: number;
  /** El camp que Directus diu que no existeix o no es pot tocar, si l'error és d'aquests. */
  readonly camp?: string;

  constructor(
    readonly motiu: MotiuError,
    missatge: string,
    detalls: { estat?: number; camp?: string } = {},
  ) {
    super(missatge);
    this.name = "ErrorDirectus";
    this.estat = detalls.estat;
    this.camp = detalls.camp;
  }
}

export const BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
/** Testimoni del compte de màquina: només llegeix el CRM. */
export const TESTIMONI = process.env.DIRECTUS_TOKEN ?? "";
// Cloud Run escala a zero: la primera petició paga l'arrencada en fred.
const ESPERA_MS = Number(process.env.DIRECTUS_ESPERA_MS ?? 30_000);

export function estaConfigurat() {
  return BASE.length > 0;
}

export async function demana(ruta: string, opcions: RequestInit = {}, esperaMs = ESPERA_MS) {
  try {
    return await fetch(`${BASE}${ruta}`, {
      ...opcions,
      cache: "no-store",
      signal: AbortSignal.timeout(esperaMs),
    });
  } catch (causa) {
    const error = causa as Error;
    throw new ErrorDirectus(
      "xarxa",
      error.name === "TimeoutError"
        // Passa per aquí tot el que es demana a Directus, no només l'entrada: el
        // missatge ha de servir igual per a un lot de la sincronització.
        ? `Directus no ha respost en ${Math.round(esperaMs / 1000)} segons.`
        : `No s'ha pogut contactar amb ${BASE}: ${error.message}`,
    );
  }
}

export async function codiError(resposta: Response) {
  const cos = (await resposta.json().catch(() => ({}))) as {
    errors?: { extensions?: { code?: string } }[];
  };
  return cos.errors?.[0]?.extensions?.code ?? "";
}
