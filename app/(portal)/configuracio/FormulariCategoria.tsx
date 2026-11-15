"use client";

import { useActionState, useState } from "react";

import { TO_LLETRA } from "@/components/crm/Lletres";
import { ORDRE_FRANGES, type Franja } from "@/domini/crm-categoria";

import { desaCategoria, type EstatConfiguracio } from "./actions";

const EUROS = new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Les columnes de la taula de franges. Al telèfon no hi ha «fins a»: ho diu la fila de dalt. */
const COLUMNES = "grid grid-cols-[56px_minmax(0,1fr)_52px] items-center gap-3 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_72px]";

/**
 * Les franges de la categoria: a partir de quin import de facturació de
 * l'exercici passat comença cada lletra. En desar, es recalcula la categoria
 * de tots els clients.
 */
export function FormulariCategoria({ franges, quants }: { franges: Franja[]; quants: Record<string, number> }) {
  const [estat, accio, desant] = useActionState<EstatConfiguracio, FormData>(desaCategoria, {});
  const [valors, setValors] = useState<Record<string, string>>(() =>
    Object.fromEntries(franges.map((franja) => [franja.lletra, String(franja.desDe)])),
  );
  // Com es llegeix: la lletra més alta a dalt.
  const lletres = [...ORDRE_FRANGES].reverse();

  return (
    <form action={accio} className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className={`${COLUMNES} border-b border-line bg-cream/70 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted`}>
          <span>Lletra</span>
          <span>A partir de</span>
          <span className="hidden sm:block">Fins a</span>
          <span className="text-right">Clients</span>
        </div>

        <ul className="divide-y divide-line/70">
          {lletres.map((lletra, i) => {
            // La franja s'acaba on comença la lletra de sobre; la més alta no s'acaba.
            const sobre = i === 0 ? null : lletres[i - 1];
            const finsA = sobre === null ? null : Number(valors[sobre]);
            return (
              <li key={lletra} className={`${COLUMNES} px-3 py-2`}>
                <span className={`inline-flex w-9 justify-center rounded-full py-0.5 text-[13px] font-semibold ${TO_LLETRA[lletra]}`}>
                  {lletra}
                </span>
                <label className="flex min-w-0 items-center gap-1.5">
                  <span className="sr-only">Categoria {lletra} a partir de</span>
                  <input
                    type="number"
                    name={`des_de_${lletra}`}
                    min={0}
                    step="any"
                    required
                    value={valors[lletra] ?? ""}
                    onChange={(e) => setValors((previs) => ({ ...previs, [lletra]: e.target.value }))}
                    className="field-compacte !w-full max-w-[150px] tabular-nums"
                  />
                  <span className="text-[13px] text-muted">€</span>
                </label>
                <span className="hidden text-[13px] tabular-nums text-muted sm:block">
                  {finsA === null ? "i amunt" : Number.isFinite(finsA) ? `fins a ${EUROS.format(finsA)}` : "—"}
                </span>
                <span className="text-right text-[13px] tabular-nums text-ink-soft">{quants[lletra] ?? 0}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={desant} className="btn-compacte">
          {desant ? "Desant i recalculant…" : "Desa i recalcula"}
        </button>
        <p className="text-[12.5px] text-muted">Una facturació per sota de la franja E —negativa, per rectificatives— també és E.</p>
      </div>

      {estat.missatge ? (
        <p
          role="status"
          className={`rounded-lg px-3.5 py-2.5 text-[13px] ${estat.to === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-marca-clar text-marca-fosc"}`}
        >
          {estat.missatge}
        </p>
      ) : null}
    </form>
  );
}
