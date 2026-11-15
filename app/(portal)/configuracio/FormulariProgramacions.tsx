"use client";

import { useActionState, useState } from "react";

import { type Programacio, type Taula, FITXA_TAULA, PERIODICITATS, TAULES, esDiaria } from "@/domini/sincronitzacio";
import { dataHoraCurta } from "@/lib/format";

import { desaProgramacions, type EstatConfiguracio } from "./actions";

/**
 * La programació de totes les taules en un sol formulari: una fila per taula,
 * un sol «Desa». El portal fa la passada sol amb la periodicitat triada; les
 * diàries i setmanals, a l'hora indicada, en hora local de la bodega.
 */
export function FormulariProgramacions({
  inicials,
  properes,
}: {
  inicials: Record<Taula, Programacio>;
  properes: Record<Taula, string | null>;
}) {
  const [estat, accio, desant] = useActionState<EstatConfiguracio, FormData>(desaProgramacions, {});
  const [minuts, setMinuts] = useState<Record<Taula, number>>(
    () => Object.fromEntries(TAULES.map((taula) => [taula, inicials[taula].periodicitatMinuts])) as Record<Taula, number>,
  );

  return (
    <form action={accio} className="space-y-3">
      <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white">
        {TAULES.map((taula) => {
          const inicial = inicials[taula];
          const ambHora = esDiaria({ ...inicial, periodicitatMinuts: minuts[taula] });
          return (
            <li key={taula} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <label className="flex min-w-[150px] items-center gap-2 text-[13.5px]">
                <input type="checkbox" name={`${taula}_activa`} defaultChecked={inicial.activa} className="size-4 accent-wine" />
                <span className="font-medium text-ink">{FITXA_TAULA[taula].etiqueta}</span>
              </label>

              <label className="block">
                <span className="sr-only">Periodicitat de {FITXA_TAULA[taula].plural}</span>
                <select
                  name={`${taula}_periodicitat`}
                  defaultValue={String(inicial.periodicitatMinuts)}
                  onChange={(e) => setMinuts((previs) => ({ ...previs, [taula]: Number(e.target.value) }))}
                  className="field-compacte w-auto min-w-[160px]"
                >
                  {PERIODICITATS.map((p) => (
                    <option key={p.minuts} value={p.minuts}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`flex items-center gap-2 ${ambHora ? "" : "invisible"}`} aria-hidden={!ambHora}>
                <span className="text-[12.5px] text-muted">a les</span>
                <input type="time" name={`${taula}_hora`} defaultValue={inicial.hora} disabled={!ambHora} className="field-compacte w-auto" />
              </label>

              <span className="ml-auto text-[12.5px] text-muted">
                {inicial.activa ? (properes[taula] ? `Propera: ${dataHoraCurta(properes[taula])}` : "Propera: pendent de calcular") : "Aturada"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={desant} className="btn-compacte">
          {desant ? "Desant…" : "Desa la programació"}
        </button>
        <p className="text-[12.5px] text-muted">Les hores són les de la bodega. El programador mira cada minut si toca alguna passada.</p>
      </div>

      {estat.missatge ? (
        <p
          role="status"
          className={`rounded-lg px-3.5 py-2.5 text-[13px] ${estat.to === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-wine-tint text-wine-deep"}`}
        >
          {estat.missatge}
        </p>
      ) : null}
    </form>
  );
}
