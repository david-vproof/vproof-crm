"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { ICONES } from "@/components/Icones";
import { useTancaFitxa } from "@/components/crm/FonsCrm";

/** El títol de la fitxa, que dona nom a la capa per als lectors de pantalla. */
export const ID_TITOL_FITXA = "titol-fitxa-client";

/**
 * La capa de la fitxa d'un client: tota la pantalla al telèfon, i a
 * l'ordinador amb un marge que deixa veure que la vista d'on es ve hi és al
 * darrere. Es tanca amb «Tanca», tocant fora o amb Escape.
 *
 * Viu al layout de la fitxa i no a la pàgina: canviar de pestanya no la torna
 * a muntar, i l'entrada només es veu en obrir-la.
 */
export function CapaFitxa({ children }: { children: ReactNode }) {
  const tanca = useTancaFitxa();
  const capa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    capa.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // L'Escape és de qui hi ha a sobre: un modal de dins, o el camp on s'escriu, que no s'ha de perdre.
      if (document.querySelector("dialog[open]") || capa.current?.querySelector('[aria-modal="true"]')) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return;
      tanca();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [tanca]);

  return (
    // Per sobre de tot el que hi pugui haver obert al darrere, el modal de regió del mapa inclòs.
    <div className="fixed inset-0 z-[60]">
      <div
        aria-hidden
        onClick={tanca}
        className="absolute inset-0 bg-ink/35 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />
      <div
        ref={capa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ID_TITOL_FITXA}
        tabIndex={-1}
        className="absolute inset-0 flex flex-col overflow-hidden bg-cream outline-none transition-[opacity,translate] duration-200 ease-out starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none sm:inset-3 sm:rounded-2xl sm:border sm:border-line sm:shadow-2xl lg:inset-4"
      >
        {children}
      </div>
    </div>
  );
}

export function BotoTanca() {
  const tanca = useTancaFitxa();
  const Tancar = ICONES.tancar;
  return (
    <button
      type="button"
      onClick={tanca}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] text-muted transition hover:border-ink hover:text-ink"
    >
      <Tancar className="size-[15px]" />
      Tanca
    </button>
  );
}
