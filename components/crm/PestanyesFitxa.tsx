"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { RUTA_FITXA_CLIENT } from "@/lib/navegacio";

export type Pestanya = { clau: string; etiqueta: string; compte?: number; href: string };

/**
 * Si s'acaba de tocar un enllaç de la fitxa (una secció, una fila, «+ Nova»):
 * el que arribi ha de començar a dalt. Viu fora del component perquè, en obrir
 * una fila, la filera es torna a muntar.
 */
let alineaEnArribar = false;

/** El primer pare que es desplaça: al telèfon, tota la fitxa; a l'ordinador, la columna. */
function pareQueEsDesplaca(element: HTMLElement) {
  for (let pare = element.parentElement; pare; pare = pare.parentElement) {
    const { overflowY } = getComputedStyle(pare);
    if (overflowY === "auto" || overflowY === "scroll") return pare;
  }
  return null;
}

/**
 * Les seccions de la fitxa d'un client. A l'ordinador, enganxades a dalt de la
 * columna i amb el botó de desar a la dreta quan hi ha alguna cosa oberta per
 * editar; al telèfon, «Desa» va a baix (vegeu FitxaClient).
 *
 * Canviar de secció substitueix l'entrada de l'historial en lloc d'afegir-ne
 * una: «Tanca» (i el botó d'enrere del navegador) ha de sortir de la fitxa,
 * no recórrer les seccions que s'hi han mirat.
 */
export function PestanyesFitxa({
  pestanyes,
  actual,
  children,
}: {
  pestanyes: Pestanya[];
  actual: string;
  /** El que va a la dreta: «Desa». */
  children?: ReactNode;
}) {
  const marca = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const capa = marca.current?.closest('[role="dialog"]');
    const enClicar = (e: Event) => {
      if ((e.target as Element | null)?.closest?.(`a[href^="${RUTA_FITXA_CLIENT}"]`)) alineaEnArribar = true;
    };
    capa?.addEventListener("click", enClicar, true);
    return () => capa?.removeEventListener("click", enClicar, true);
  }, []);

  // La secció nova (o el que s'hi obre) comença a dalt, just sota la filera, i
  // no on hagi quedat el desplaçament de l'anterior: al telèfon, el navegador hi
  // deixa l'enllaç tocat a mitja pantalla. A dalt hi pot haver enganxada la
  // franja del nom: la filera va a sota.
  useLayoutEffect(() => {
    const element = marca.current;
    const pare = element ? pareQueEsDesplaca(element) : null;
    if (!alineaEnArribar || !element || !pare) return;
    alineaEnArribar = false;
    const franja = pare.querySelector<HTMLElement>("[data-capcalera-fitxa]");
    const tapa = franja && getComputedStyle(franja).position === "sticky" ? franja.offsetHeight : 0;
    pare.scrollTop += element.getBoundingClientRect().top - (pare.getBoundingClientRect().top + tapa);
  }, [actual]);

  return (
    <>
      <div ref={marca} aria-hidden />
      {/* Les seccions embolcallen: mai no rasquen de costat. Al telèfon van en
          pastilles, perquè el subratllat repartit en dues files no diria on ets. */}
      <nav
        aria-label="Seccions de la fitxa"
        // Sense seccions (l'alta), al telèfon no hi queda res: «Desa» hi va a baix.
        className={`${pestanyes.length === 0 ? "hidden lg:flex" : "flex"} flex-wrap items-center gap-x-1 gap-y-1 border-b border-line bg-cream px-3 py-2 sm:px-5 sm:py-0 lg:sticky lg:top-0 lg:z-10`}
      >
        {pestanyes.map((pestanya) => {
          const activa = pestanya.clau === actual;
          return (
            <Link
              key={pestanya.clau}
              href={pestanya.href}
              replace
              scroll={false}
              aria-current={activa ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] transition-colors sm:-mb-px sm:rounded-none sm:border-b-2 sm:py-2.5 ${
                activa
                  ? "bg-parchment font-medium text-ink sm:border-wine sm:bg-transparent"
                  : "text-muted hover:bg-parchment/60 hover:text-ink-soft sm:border-transparent sm:hover:border-line sm:hover:bg-transparent"
              }`}
            >
              {pestanya.etiqueta}
              {pestanya.compte === undefined ? null : (
                <span
                  className={`rounded px-1.5 py-px text-[11px] tabular-nums ${
                    activa ? "bg-wine-tint text-wine-deep" : "bg-parchment text-muted"
                  }`}
                >
                  {pestanya.compte}
                </span>
              )}
            </Link>
          );
        })}
        {children ? <div className="ml-auto hidden items-center gap-2 py-1 pl-2 lg:flex">{children}</div> : null}
      </nav>
    </>
  );
}
