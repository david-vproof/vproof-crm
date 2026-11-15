"use client";

import { useMemo, useState } from "react";

import {
  DIES,
  ESTATS_DIA,
  horariBuit,
  llegeixHorari,
  type Bloc,
  type EstatDia,
  type Horari,
} from "@/domini/crm-horaris";

/** Els dies feiners, que és el que se sol copiar d'una tirada. */
const FEINERS = [0, 1, 2, 3, 4];

const TO_ESTAT: Record<EstatDia, string> = {
  obert: "border-line bg-white text-ink",
  preferent: "border-emerald-200 bg-emerald-50 text-emerald-800",
  bloquejat: "border-wine/30 bg-wine-tint text-wine-deep",
};

function sumaMinuts(hora: string, minuts: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, (h || 0) * 60 + (m || 0) + minuts));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** El bloc que es proposa: el matí si no n'hi ha cap, i si no, després de l'últim. */
function blocNou(blocs: Bloc[]): Bloc {
  if (blocs.length === 0) return { de: "08:00", a: "13:00" };
  const ultim = blocs[blocs.length - 1];
  return { de: sumaMinuts(ultim.a, 240), a: sumaMinuts(ultim.a, 420) };
}

/**
 * La matriu d'un horari: una fila per dia, amb l'estat del dia i els seus blocs.
 *
 * Els dies van en files i no en columnes perquè un camp d'hora no cap en una
 * setena part de l'amplada, i perquè un dia pot tenir més blocs que un altre.
 *
 * El valor viatja en un camp ocult amb JSON, de manera que el formulari de
 * fitxes el desa com qualsevol altre camp.
 */
export function MatriuHoraris({ nom, inicial }: { nom: string; inicial: unknown }) {
  const [horari, setHorari] = useState<Horari>(() => llegeixHorari(inicial));
  const json = useMemo(() => JSON.stringify(horari), [horari]);

  function canviaDia(posicio: number, canvi: Partial<Horari[number]>) {
    setHorari((previ) => previ.map((dia, i) => (i === posicio ? { ...dia, ...canvi } : dia)));
  }

  function canviaBloc(posicio: number, index: number, canvi: Partial<Bloc>) {
    setHorari((previ) =>
      previ.map((dia, i) =>
        i === posicio
          ? { ...dia, blocs: dia.blocs.map((bloc, j) => (j === index ? { ...bloc, ...canvi } : bloc)) }
          : dia,
      ),
    );
  }

  /** El dilluns marca la pauta de la setmana laboral: es copia i s'ajusta. */
  function copiaFeiners() {
    setHorari((previ) =>
      previ.map((dia, i) =>
        FEINERS.includes(i) ? { estat: previ[0].estat, blocs: previ[0].blocs.map((b) => ({ ...b })) } : dia,
      ),
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={nom} value={json} />

      <ul className="space-y-1.5">
        {horari.map((dia, posicio) => (
          <li
            key={DIES[posicio]}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border px-2 py-1.5 ${TO_ESTAT[dia.estat]}`}
          >
            <span className="w-[78px] shrink-0 text-[12.5px] font-medium">{DIES[posicio]}</span>

            <select
              aria-label={`Estat de ${DIES[posicio]}`}
              value={dia.estat}
              onChange={(e) => canviaDia(posicio, { estat: e.target.value as EstatDia })}
              className="field-compacte !w-auto !bg-white/80"
            >
              {ESTATS_DIA.map(([valor, text]) => (
                <option key={valor} value={valor}>
                  {text}
                </option>
              ))}
            </select>

            {dia.estat === "bloquejat" ? (
              <span className="text-[12.5px] opacity-70">No s&apos;hi va</span>
            ) : (
              <>
                {dia.blocs.map((bloc, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <input
                      type="time"
                      aria-label={`${DIES[posicio]}, inici del bloc ${index + 1}`}
                      value={bloc.de}
                      onChange={(e) => canviaBloc(posicio, index, { de: e.target.value })}
                      className="field-compacte !w-[100px] !bg-white/80"
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      aria-label={`${DIES[posicio]}, fi del bloc ${index + 1}`}
                      value={bloc.a}
                      onChange={(e) => canviaBloc(posicio, index, { a: e.target.value })}
                      className="field-compacte !w-[100px] !bg-white/80"
                    />
                    <button
                      type="button"
                      aria-label={`Treu el bloc ${index + 1} de ${DIES[posicio]}`}
                      onClick={() =>
                        canviaDia(posicio, { blocs: dia.blocs.filter((_, j) => j !== index) })
                      }
                      className="grid size-6 place-items-center rounded-md text-[14px] leading-none opacity-60 transition hover:bg-white hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={() => canviaDia(posicio, { blocs: [...dia.blocs, blocNou(dia.blocs)] })}
                  className="rounded-md border border-current/20 bg-white/70 px-2 py-1 text-[12px] transition hover:bg-white"
                >
                  + bloc
                </button>

                {dia.blocs.length === 0 ? (
                  <span className="text-[12px] opacity-60">Sense horari indicat</span>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <button
          type="button"
          onClick={copiaFeiners}
          className="rounded-lg border border-line bg-white px-2.5 py-1.5 transition hover:border-ink"
        >
          Copia dilluns a tots els feiners
        </button>
        <button
          type="button"
          onClick={() => setHorari(horariBuit())}
          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-muted transition hover:border-ink hover:text-ink"
        >
          Buida
        </button>
        <span className="text-muted">
          Un dia preferent és on convé posar la visita; un de bloquejat no s&apos;hi posa mai.
        </span>
      </div>
    </div>
  );
}
