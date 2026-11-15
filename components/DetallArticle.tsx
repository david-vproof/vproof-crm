"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { ICONES } from "@/components/Icones";
import { Dada } from "@/components/UI";
import { dataCurta } from "@/lib/format";
import type { FitxaArticle } from "@/serveis/articles";

/** Els camps programables de FactuSol. El títol de cadascun el posa la bodega allà. */
const PROGRAMABLES = [1, 2, 3, 4, 5] as const;

/**
 * Un article que s'obre: el que es passa com a fill fa de botó, i en tocar-lo
 * surt un modal amb la foto gran i la fitxa de l'article. La foto gran només es
 * demana en obrir-lo, perquè el llistat no la carregui per a cada fila. Com que
 * Directus la transforma en demanar-la i triga una mica, mentrestant hi ha la
 * miniatura, que ja és a la memòria cau, i l'espai de la foto no canvia de mida.
 *
 * És un <dialog> del navegador: es tanca amb Escape, deixa inert el que hi ha
 * darrere i, en tancar-se, torna el focus al botó. També es tanca tocant fora.
 */
export function DetallArticle({
  article,
  petita,
  gran,
  className = "",
  children,
}: {
  article: FitxaArticle;
  /** L'adreça de la miniatura, que fa de foto mentre arriba la gran. */
  petita: string | null;
  /** L'adreça de la foto gran, o null si l'article no en té. */
  gran: string | null;
  /** Les classes del botó que l'obre. */
  className?: string;
  children: ReactNode;
}) {
  const dialeg = useRef<HTMLDialogElement>(null);
  // Si el toc ha començat al fons. Sense això, seleccionar text de la fitxa i
  // deixar anar el botó a fora també el tancaria.
  const tocaFons = useRef(false);
  const [obert, setObert] = useState(false);
  const [fotoCarregada, setFotoCarregada] = useState(false);
  const titol = useId();

  useEffect(() => {
    const element = dialeg.current;
    if (!element) return;
    if (obert && !element.open) element.showModal();
    if (!obert && element.open) element.close();
  }, [obert]);

  const nom = article.nom ?? "Sense nom";
  const Tancar = ICONES.tancar;
  const Icona = ICONES.articles;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFotoCarregada(false);
          setObert(true);
        }}
        aria-haspopup="dialog"
        className={`text-left ${className}`}
      >
        {children}
      </button>

      <dialog
        ref={dialeg}
        aria-labelledby={titol}
        onClose={() => setObert(false)}
        // El fons és el mateix <dialog>: el contingut l'omple sencer.
        onPointerDown={(e) => {
          tocaFons.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (tocaFons.current && e.target === e.currentTarget) setObert(false);
        }}
        // El color del fons va escrit: als navegadors d'abans del 2024, ::backdrop no veu les variables del tema.
        className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[880px] overflow-hidden rounded-xl bg-white p-0 text-ink shadow-2xl transition-[opacity,scale] duration-150 ease-out backdrop:bg-[rgba(23,16,15,0.5)] starting:scale-[0.98] starting:opacity-0 motion-reduce:transition-none"
      >
        {obert ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setObert(false)}
              aria-label="Tanca"
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg border border-line bg-white/90 text-muted backdrop-blur transition hover:text-ink"
            >
              <Tancar className="size-[18px]" />
            </button>

            <div className="grid max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* L'alçada és fixa: la foto gran arriba al cap d'una estona i el modal no ha de saltar. */}
              <div className="relative flex h-[42dvh] items-center justify-center bg-parchment/50 p-4 md:h-[min(70dvh,620px)] md:p-8">
                {gran ? (
                  <>
                    {petita && !fotoCarregada ? (
                      <Image
                        src={petita}
                        alt=""
                        aria-hidden
                        width={160}
                        height={160}
                        unoptimized
                        className="absolute inset-0 m-auto h-full w-full object-contain p-4 opacity-60 blur-[2px] md:p-8"
                      />
                    ) : null}
                    {/* Ja arriba a la mida que toca des de Directus: no cal que Next la torni a optimitzar. */}
                    <Image
                      src={gran}
                      alt={`Foto de ${nom}`}
                      width={1200}
                      height={1200}
                      unoptimized
                      onLoad={() => setFotoCarregada(true)}
                      className={`relative h-full w-full object-contain transition-opacity duration-200 motion-reduce:transition-none ${
                        fotoCarregada ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </>
                ) : (
                  <span className="flex aspect-square w-full max-w-[200px] flex-col items-center justify-center gap-2 text-muted/50">
                    <Icona className="size-1/3" />
                    <span className="text-[13px]">Sense foto a FactuSol</span>
                  </span>
                )}
              </div>

              <div className="min-w-0 p-5 md:p-7">
                <p className="font-mono text-[13px] text-muted">{article.codi_erp}</p>
                {/* Marge a la dreta: a l'escriptori, la creu de tancar cau damunt del títol. */}
                <h2 id={titol} className="mt-1 font-display text-[26px] leading-[1.15] tracking-[-0.01em] md:pr-10">
                  {nom}
                </h2>

                <dl className="mt-5 space-y-3">
                  <Dada
                    etiqueta="Celler"
                    valor={
                      article.celler ? (
                        <Link href={`/cellers/${article.celler.id}`} className="transition hover:text-wine">
                          {article.celler.nom_comercial ?? "Sense nom"}
                        </Link>
                      ) : (
                        ""
                      )
                    }
                  />
                  <Dada etiqueta="Família" valor={article.familia} />
                  <Dada etiqueta="Codi de barres" valor={article.codi_barres ? <span className="font-mono">{article.codi_barres}</span> : ""} />
                  <Dada etiqueta="Ref. proveïdor" valor={article.referencia_proveidor} />
                  <Dada etiqueta="Garantia" valor={article.garantia} />
                  {PROGRAMABLES.map((n) => (
                    <Dada key={n} etiqueta={`Camp programable ${n}`} valor={article[`camp_programable_${n}`]} />
                  ))}
                  <Dada etiqueta="Alta" valor={dataCurta(article.data_alta ?? undefined)} />
                </dl>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
