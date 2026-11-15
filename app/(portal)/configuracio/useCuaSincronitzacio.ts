import { useCallback, useEffect, useRef, useState } from "react";

import type { EstatEnViu, EstatExecucio, Taula } from "@/domini/sincronitzacio";

import { type OientsFlux, engegaISegueix, segueix } from "./flux-sincronitzacio";

/** Una taula de la cua: què se n'ha vist i com ha acabat. */
export type Pas = {
  taula: Taula;
  situacio: "cua" | "en_curs" | "acabat";
  estat: EstatEnViu | null;
  final: { estat: Exclude<EstatExecucio, "en_curs">; missatge: string } | null;
  /** Amb el servidor: si el flux s'ha tallat, la passada continua allà i s'hi torna a enganxar. */
  connexio: "ok" | "reconnectant" | "perduda";
};

/** Quants cops es prova de tornar a enganxar-se a una passada si el flux s'ha tallat. */
const REINTENTS = 3;
const ESPERA_REINTENT_MS = 2_000;

const espera = (ms: number) => new Promise<void>((resol) => setTimeout(resol, ms));

/**
 * La cua de sincronitzacions que porta el navegador. Les taules es fan d'una
 * en una i en ordre, cadascuna dins de la seva petició: així cada passada té el
 * temps sencer que el servidor li dona. També s'enganxa a passades que ja
 * corren (engegades pel programador, per algú altre o abans de recarregar).
 */
export function useCuaSincronitzacio() {
  const [passos, setPassos] = useState<Pas[]>([]);
  /** Si és aquest navegador qui porta la cua: llavors tancar la pestanya la talla. */
  const [conduint, setConduint] = useState(false);
  const [darrerSenyal, setDarrerSenyal] = useState<number | null>(null);
  const [ara, setAra] = useState(() => Date.now());
  const viu = useRef(true);

  useEffect(() => {
    viu.current = true;
    return () => {
      viu.current = false;
    };
  }, []);

  const enMarxa = passos.some((pas) => pas.situacio !== "acabat");

  // El rellotge de la pantalla: mentre hi ha res en marxa, cada segon.
  useEffect(() => {
    if (!enMarxa) return;
    setAra(Date.now());
    const rellotge = setInterval(() => setAra(Date.now()), 1000);
    return () => clearInterval(rellotge);
  }, [enMarxa]);

  // Qui porta la cua no hauria de tancar la pestanya a mig fer: el navegador pregunta.
  useEffect(() => {
    if (!conduint) return;
    const avisa = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", avisa);
    return () => window.removeEventListener("beforeunload", avisa);
  }, [conduint]);

  const actualitza = useCallback((taula: Taula, canvi: Partial<Pas> | ((pas: Pas) => Partial<Pas>)) => {
    if (!viu.current) return;
    setPassos((previs) => previs.map((pas) => (pas.taula === taula ? { ...pas, ...(typeof canvi === "function" ? canvi(pas) : canvi) } : pas)));
  }, []);

  const corre = useCallback(
    async (taula: Taula, mode: "engega" | "segueix"): Promise<void> => {
      let enganxar = false;
      const oients: OientsFlux = {
        alSenyal: () => {
          if (viu.current) setDarrerSenyal(Date.now());
        },
        alEstat: (estat) =>
          actualitza(taula, {
            estat,
            connexio: "ok",
            situacio: estat.final ? "acabat" : "en_curs",
            final: estat.final ? { estat: estat.final.estat, missatge: estat.final.missatge } : null,
          }),
        alFinal: (final) => {
          // El servidor diu que ja n'hi ha una en marxa: s'hi enganxa en comptes de donar-la per fallida.
          if (final.resultat?.jaEnMarxa) {
            enganxar = true;
            return;
          }
          if (final.resultat) {
            const { estat, missatge } = final.resultat;
            actualitza(taula, (pas) => ({ situacio: "acabat", final: pas.final ?? { estat, missatge } }));
          } else if (final.execucio) {
            const { estat, missatge } = final.execucio;
            actualitza(taula, { situacio: "acabat", final: { estat: estat === "en_curs" ? "error" : estat, missatge: missatge ?? "" } });
          } else if (final.error) {
            actualitza(taula, { situacio: "acabat", final: { estat: "error", missatge: final.error } });
          } else {
            actualitza(taula, (pas) => ({ situacio: "acabat", final: pas.final }));
          }
        },
      };

      let arribatAlFinal = false;
      try {
        arribatAlFinal = await (mode === "engega" ? engegaISegueix : segueix)(taula, oients);
      } catch (error) {
        actualitza(taula, { situacio: "acabat", final: { estat: "error", missatge: (error as Error).message } });
        return;
      }
      if (enganxar) return corre(taula, "segueix");
      if (arribatAlFinal) return;

      // El flux s'ha tallat sense final. La passada continua al servidor: s'hi torna a enganxar.
      for (let intent = 0; intent < REINTENTS && viu.current; intent += 1) {
        actualitza(taula, { connexio: "reconnectant" });
        await espera(ESPERA_REINTENT_MS);
        try {
          if (await segueix(taula, oients)) return;
        } catch {
          // Es torna a provar.
        }
      }
      actualitza(taula, { connexio: "perduda" });
    },
    [actualitza],
  );

  /** Engega les taules, en l'ordre donat, una darrere l'altra. Resol quan s'han fet totes. */
  const engega = useCallback(
    async (taules: Taula[]) => {
      setPassos(taules.map((taula) => ({ taula, situacio: "cua", estat: null, final: null, connexio: "ok" })));
      setDarrerSenyal(Date.now());
      setConduint(true);
      try {
        for (const taula of taules) {
          if (!viu.current) break;
          actualitza(taula, { situacio: "en_curs" });
          await corre(taula, "engega");
        }
      } finally {
        if (viu.current) setConduint(false);
      }
    },
    [actualitza, corre],
  );

  /** S'enganxa a passades que ja corren. Resol quan han acabat totes. */
  const enganxa = useCallback(
    async (taules: Taula[]) => {
      setPassos(taules.map((taula) => ({ taula, situacio: "en_curs", estat: null, final: null, connexio: "ok" })));
      setDarrerSenyal(Date.now());
      await Promise.all(taules.map((taula) => corre(taula, "segueix")));
    },
    [corre],
  );

  const reconnecta = useCallback((taula: Taula) => corre(taula, "segueix"), [corre]);

  return { passos, conduint, enMarxa, darrerSenyal, ara, engega, enganxa, reconnecta };
}
