"use client";

import {
  type ErrorCopia, type EstatEnViu, type Fase, FITXA_TAULA, NOM_FASE, SENSE_NOTICIES_S, fasesDe, resumComptadors, tantPerCent,
} from "@/domini/sincronitzacio";
import { durada, quantitat } from "@/lib/format";

import { EtiquetaEstatExecucio } from "./EstatExecucio";

/**
 * Una passada vista en viu: en quina fase és, quant n'ha fet, quant fa que
 * dura i, sobretot, si el servidor segueix dient alguna cosa. Quan calla massa
 * estona, ho diu; quan el flux es talla, ho diu i deixa tornar-s'hi a enganxar.
 * Només pinta: l'estat li arriba de `useCuaSincronitzacio`.
 */
export function SeguimentEnViu({
  estat,
  ara,
  darrerSenyal,
  connexio,
  alReconnectar,
}: {
  estat: EstatEnViu;
  /** El rellotge de la pantalla, en ms: avança cada segon mentre hi ha res en marxa. */
  ara: number;
  /** Quan va arribar el darrer senyal del servidor, en ms. */
  darrerSenyal: number | null;
  connexio: "ok" | "reconnectant" | "perduda";
  alReconnectar?: () => void;
}) {
  const { final, fase, detall, fets, total, comptadors, errors } = estat;
  const tant = tantPerCent(fets, total);
  const inici = Date.parse(estat.inici);
  const transcorregut = final ? Date.parse(final.fi) - inici : ara - inici;
  const silenci = !final && darrerSenyal !== null ? Math.round((ara - darrerSenyal) / 1000) : 0;
  const senseAvanc = !final ? Math.round((ara - Date.parse(estat.actualitzatEl)) / 1000) : 0;

  return (
    <div className="space-y-3">
      <Fases taula={estat.taula} actual={fase} acabada={Boolean(final)} fallida={final?.estat === "error"} />

      {!final ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[14px] text-ink">
              <span className="font-medium">{NOM_FASE[fase]}</span>
              {detall ? <span className="text-muted"> · {detall}</span> : null}
            </p>
            <p className="text-[12.5px] tabular-nums text-muted">
              {tant !== null ? `${quantitat(fets!)} de ${quantitat(total!)} · ${tant} %` : null}
            </p>
          </div>
          <Barra tant={tant} />
          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] tabular-nums text-muted">
            <span>Fa {durada(transcorregut)} que dura</span>
            {senseAvanc >= 5 ? <span>· darrer avanç fa {durada(senseAvanc * 1000)}</span> : null}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <EtiquetaEstatExecucio estat={final.estat} />
          <span className="text-muted">en {durada(transcorregut)}</span>
        </div>
      )}

      <p className="text-[13px] text-ink-soft">{resumComptadors(comptadors)}</p>

      {final?.missatge ? (
        <p className={`rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${final.estat === "error" ? "bg-wine-tint text-wine-deep" : "bg-parchment text-ink"}`}>
          {final.missatge}
        </p>
      ) : null}

      {!final && connexio === "ok" && silenci >= SENSE_NOTICIES_S ? (
        <Avis to="ambre">
          El servidor no diu res des de fa {durada(silenci * 1000)}. Les lectures grans de FactuSol poden trigar més d&apos;un minut;
          si passa de cinc, la passada s&apos;ha perdut i el registre la donarà per interrompuda.
        </Avis>
      ) : null}
      {connexio === "reconnectant" ? <Avis to="ambre">S&apos;ha tallat la connexió amb el servidor. Tornant a connectar…</Avis> : null}
      {connexio === "perduda" ? (
        <Avis to="vi">
          No s&apos;ha pogut tornar a connectar. La passada pot continuar al servidor: el registre ho dirà.{" "}
          {alReconnectar ? (
            <button type="button" onClick={alReconnectar} className="font-medium underline underline-offset-2">
              Torna-ho a provar
            </button>
          ) : null}
        </Avis>
      ) : null}

      {errors.length > 0 ? <LlistaErrors errors={errors} total={comptadors.fallits} /> : null}
    </div>
  );
}

/** El camí de la passada, amb la fase on és. */
function Fases({ taula, actual, acabada, fallida }: { taula: EstatEnViu["taula"]; actual: Fase; acabada: boolean; fallida: boolean }) {
  const fases = fasesDe(taula);
  const posicio = fases.indexOf(actual);
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-1 text-[11px] uppercase tracking-[0.06em]" aria-label="Fases de la passada">
      {fases.map((fase, i) => {
        const feta = acabada ? !fallida || i < posicio : i < posicio;
        const esActual = !acabada && i === posicio;
        const fallaAqui = acabada && fallida && i === posicio;
        return (
          <li key={fase} className="flex items-center gap-1">
            {i > 0 ? <span className="text-line" aria-hidden>›</span> : null}
            <span
              aria-current={esActual ? "step" : undefined}
              className={
                fallaAqui
                  ? "font-semibold text-wine-deep"
                  : esActual
                    ? "font-semibold text-wine"
                    : feta
                      ? "text-ink-soft"
                      : "text-muted/60"
              }
            >
              {NOM_FASE[fase].split(" ")[0]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Determinada si se sap el total; si no, es mou perquè es vegi que la cosa va. */
function Barra({ tant }: { tant: number | null }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={tant ?? undefined}
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-parchment"
    >
      {tant === null ? (
        <div className="barra-indeterminada h-full w-full" />
      ) : (
        <div className="h-full rounded-full bg-wine transition-[width] duration-500 ease-out" style={{ width: `${tant}%` }} />
      )}
    </div>
  );
}

function Avis({ to, children }: { to: "ambre" | "vi"; children: React.ReactNode }) {
  const classes = to === "ambre" ? "bg-amber-50 text-amber-900" : "bg-wine-tint text-wine-deep";
  return (
    <p role="status" className={`rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${classes}`}>
      {children}
    </p>
  );
}

const NOM_OPERACIO_CURT = { crear: "crear", actualitzar: "actualitzar", absent: "marcar absent" } as const;

/** Les files que Directus no ha acceptat, plegades: el nom de cadascuna, i el motiu. */
export function LlistaErrors({ errors, total }: { errors: ErrorCopia[]; total: number }) {
  const quants = Math.max(total, errors.length);
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50/60">
      <summary className="cursor-pointer select-none px-3.5 py-2.5 text-[13px] font-medium text-amber-900">
        {quantitat(quants)} {quants === 1 ? "fitxa que no s'ha pogut copiar" : "fitxes que no s'han pogut copiar"}
        {errors.length < quants ? <span className="font-normal text-amber-800"> (se n&apos;ensenyen {errors.length})</span> : null}
      </summary>
      <ul className="divide-y divide-amber-200/70 border-t border-amber-200 text-[12.5px]">
        {errors.map((error, i) => (
          <li key={`${error.codi}-${error.operacio}-${i}`} className="px-3.5 py-2">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[12px] text-muted">{error.codi}</span>
              <span className="font-medium text-ink">{error.nom || "—"}</span>
              <span className="text-muted">
                en {NOM_OPERACIO_CURT[error.operacio]}
                {error.colleccio ? ` a ${error.colleccio}` : ""}
              </span>
            </span>
            <span className="mt-0.5 block text-muted">{error.motiu}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** El nom d'una taula, per als rètols. */
export function nomTaula(taula: EstatEnViu["taula"]) {
  return FITXA_TAULA[taula].etiqueta;
}
