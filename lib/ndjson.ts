/**
 * Un flux de línies JSON (NDJSON): una línia per missatge, que és com el
 * servidor explica una sincronització mentre la fa. Serveix a les dues bandes:
 * el navegador el llegeix amb `fetch`, que —a diferència d'EventSource— també
 * admet POST, i el servidor l'escriu amb `fluxNdjson`.
 */

export const TIPUS_NDJSON = "application/x-ndjson; charset=utf-8";

/**
 * Llegeix una resposta línia a línia i crida `perLinia` amb cada objecte.
 * Acaba quan el servidor tanca el flux. Una línia que no sigui JSON (un tros
 * tallat per la xarxa) es deixa estar.
 */
export async function llegeixNdjson(resposta: Response, perLinia: (missatge: unknown) => void) {
  if (!resposta.body) return;
  const lector = resposta.body.getReader();
  const descodificador = new TextDecoder();
  let resta = "";

  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    resta += descodificador.decode(value, { stream: true });
    const linies = resta.split("\n");
    resta = linies.pop() ?? "";
    for (const linia of linies) emet(linia, perLinia);
  }
  emet(resta, perLinia);
}

function emet(linia: string, perLinia: (missatge: unknown) => void) {
  const neta = linia.trim();
  if (!neta) return;
  try {
    perLinia(JSON.parse(neta));
  } catch {
    // Un tros a mitges: el següent missatge sencer ja ho posa al dia.
  }
}

/**
 * Una resposta que s'escriu a poc a poc. `cos` rep com emetre un missatge;
 * el flux es tanca sol quan `cos` acaba, i si `cos` peta, el darrer missatge
 * és l'error. Quan qui mira se'n va, `senyal` s'avorta i emetre deixa de fer
 * res, però `cos` continua fins al final: la feina del servidor no depèn de
 * qui la mira.
 */
export function fluxNdjson(cos: (emet: (missatge: unknown) => void, senyal: AbortSignal) => Promise<void>): Response {
  const codificador = new TextEncoder();
  const aturador = new AbortController();
  let obert = true;

  const flux = new ReadableStream<Uint8Array>({
    start(controlador) {
      const emet = (missatge: unknown) => {
        if (!obert) return;
        try {
          controlador.enqueue(codificador.encode(`${JSON.stringify(missatge)}\n`));
        } catch {
          obert = false;
        }
      };
      const tanca = () => {
        if (!obert) return;
        obert = false;
        try {
          controlador.close();
        } catch {
          // Ja era tancat.
        }
      };
      cos(emet, aturador.signal)
        .catch((error: Error) => emet({ tipus: "final", error: error.message }))
        .finally(tanca);
    },
    cancel() {
      obert = false;
      aturador.abort();
    },
  });

  return new Response(flux, {
    headers: {
      "Content-Type": TIPUS_NDJSON,
      // Que cap intermediari no guardi ni ajunti els trossos: han d'arribar a mesura que surten.
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
