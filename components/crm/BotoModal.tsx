"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { ICONES } from "@/components/Icones";

/**
 * Una marca rodona al costat del nom d'un client, a les llistes, que obre un
 * modal: la «A» dels atributs i la «!» dels To-Do. El contingut només es munta
 * amb el modal obert, així el que demana es demana en obrir-lo i torna a sortir
 * al dia cada vegada.
 *
 * És un <dialog> del navegador: es tanca amb Escape, amb la creu o tocant fora.
 */
export function BotoModal({
  marca,
  etiqueta,
  apartat,
  nom,
  to,
  mida = "petita",
  enllac,
  children,
}: {
  /** El que es veu al botó: «A», «!». */
  marca: string;
  /** El que en diu el lector de pantalla i el rètol: «Atributs de…». */
  etiqueta: string;
  /** El títol petit del modal: «Atributs», «To-Do pendents». */
  apartat: string;
  nom: string;
  /** Els colors del botó, en classes senceres perquè Tailwind les trobi. */
  to: string;
  /** La gran és per al dit, al costat dels botons de trucar de les fitxes del telèfon. */
  mida?: "petita" | "gran";
  /** On es veu sencer, al peu del modal. */
  enllac: { href: string; text: string };
  children: ReactNode;
}) {
  const dialeg = useRef<HTMLDialogElement>(null);
  const tocaFons = useRef(false);
  const titol = useId();
  const [obert, setObert] = useState(false);

  useEffect(() => {
    const element = dialeg.current;
    if (!element) return;
    if (obert && !element.open) element.showModal();
    if (!obert && element.open) element.close();
  }, [obert]);

  const Tancar = ICONES.tancar;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // Pot anar dins d'una fila que ja fa alguna cosa en tocar-la.
          e.stopPropagation();
          setObert(true);
        }}
        aria-haspopup="dialog"
        aria-label={etiqueta}
        title={etiqueta}
        className={`inline-grid shrink-0 place-items-center font-semibold leading-none transition ${to} ${
          mida === "gran" ? "size-9 rounded-lg text-[14px]" : "size-5 rounded-full text-[10.5px]"
        }`}
      >
        {marca}
      </button>

      <dialog
        ref={dialeg}
        aria-labelledby={titol}
        onClose={() => setObert(false)}
        onPointerDown={(e) => {
          tocaFons.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (tocaFons.current && e.target === e.currentTarget) setObert(false);
        }}
        // El color del fons va escrit: als navegadors d'abans del 2024, ::backdrop no veu les variables del tema.
        className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[440px] overflow-hidden rounded-xl bg-white p-0 text-ink shadow-2xl transition-[opacity,scale] duration-150 ease-out backdrop:bg-[rgba(23,16,15,0.5)] starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none"
      >
        {obert ? (
          <div className="flex max-h-[calc(100dvh-32px)] flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{apartat}</p>
                <h2 id={titol} className="break-words font-display text-[20px] leading-tight">
                  {nom}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setObert(false)}
                aria-label="Tanca"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:text-ink"
              >
                <Tancar className="size-[16px]" />
              </button>
            </header>

            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

            <footer className="border-t border-line px-5 py-3 text-right">
              <Link href={enllac.href} onClick={() => setObert(false)} className="text-[13px] text-marca transition hover:underline">
                {enllac.text} →
              </Link>
            </footer>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

/**
 * El que demana el contingut d'un modal en muntar-se: una ruta de l'API que
 * torna JSON. Mentre arriba, «Un moment…»; si falla, l'error.
 */
export function useDemanda<T>(ruta: string) {
  const [dades, setDades] = useState<{ valor?: T; error?: string } | null>(null);
  useEffect(() => {
    const aturador = new AbortController();
    fetch(ruta, { signal: aturador.signal })
      .then((resposta) => resposta.json())
      .then((cos: T & { error?: string }) => setDades(cos.error ? { error: cos.error } : { valor: cos }))
      .catch(() => {
        if (!aturador.signal.aborted) setDades({ error: "No s'han pogut llegir." });
      });
    return () => aturador.abort();
  }, [ruta]);
  return dades;
}
