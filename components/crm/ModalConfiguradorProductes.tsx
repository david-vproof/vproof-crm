"use client";

import { useEffect, useRef, useState } from "react";

import { ConfiguradorProductes } from "@/components/crm/ConfiguradorProductes";
import { ICONES } from "@/components/Icones";
import type { ClientOLead, ProducteDeCataleg } from "@/domini/cistella-productes";

/**
 * El configurador de productes en modal, des del formulari d'una activitat: el
 * mateix que a la pàgina «Selector de productes», però «Aplica a l'activitat» torna
 * la cistella al camp de productes. Només es munta amb el modal obert, així el
 * catàleg i les plantilles es demanen en obrir-lo i surten al dia.
 *
 * És un <dialog> del navegador: es tanca amb Escape, amb la creu o tocant
 * fora. Va dins del formulari de l'activitat, però cap botó l'envia.
 */
export function ModalConfiguradorProductes({
  inicials,
  clients = [],
  alAplicar,
}: {
  inicials: string[];
  /** El client (o clients) o el lead de l'activitat: el configurador comença amb ells triats. */
  clients?: ClientOLead[];
  alAplicar: (productes: ProducteDeCataleg[]) => void;
}) {
  const dialeg = useRef<HTMLDialogElement>(null);
  const tocaFons = useRef(false);
  const [obert, setObert] = useState(false);

  useEffect(() => {
    const element = dialeg.current;
    if (!element) return;
    if (obert && !element.open) element.showModal();
    if (!obert && element.open) element.close();
  }, [obert]);

  const Tancar = ICONES.tancar;
  const Productes = ICONES.productes;

  return (
    <>
      <button
        type="button"
        onClick={() => setObert(true)}
        aria-haspopup="dialog"
        title="Omple els productes amb el configurador: per criteris, o d'una plantilla"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink"
      >
        <Productes className="size-4 text-muted" />
        Configurador
      </button>

      <dialog
        ref={dialeg}
        aria-label="Configurador de productes"
        onClose={() => setObert(false)}
        onPointerDown={(e) => {
          tocaFons.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (tocaFons.current && e.target === e.currentTarget) setObert(false);
        }}
        // «hidden open:flex» i no «flex»: un display propi guanya al del navegador i el diàleg tancat es veuria.
        className="m-auto hidden h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[1240px] flex-col overflow-hidden rounded-xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-[rgba(23,16,15,0.5)] open:flex"
      >
        {obert ? (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Activitat</p>
                <h2 className="font-display text-[20px] leading-tight">Configurador de productes</h2>
              </div>
              <button
                type="button"
                onClick={() => setObert(false)}
                aria-label="Tanca"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink"
              >
                <Tancar className="size-[18px]" />
              </button>
            </header>
            <div className="min-h-0 flex-1">
              <ConfiguradorProductes
                inicials={inicials}
                clientsInicials={clients}
                alAplicar={(productes) => {
                  alAplicar(productes);
                  setObert(false);
                }}
              />
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}
