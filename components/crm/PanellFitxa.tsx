import Link from "next/link";
import type { ReactNode } from "react";

import { esborraFitxaAccio } from "@/app/(portal)/crm/accions";
import { BotoDesa, EdicioFitxa } from "@/components/crm/EdicioFitxa";
import { FITXES, type ClauFitxa, type Fitxa } from "@/domini/crm-fitxes";

/** Què esborraria el botó: la fitxa del panell. */
export type Esborrable = { entitat: ClauFitxa; id: string; nom: string; retorn: string };

/**
 * La fitxa s'obre en un panell lateral. El llistat es queda al darrere i no es
 * perd el context. (Els clients no: tenen fitxa pròpia a pantalla sencera,
 * FitxaClient, perquè d'un client en penja massa per a una columna.)
 *
 * Les accions van repartides per pes: desar i sortir a la capçalera, i
 * esborrar, que no té marxa enrere, sol al peu i en vermell.
 *
 * Tots els enllaços van amb `scroll={false}`: moure's pel panell canvia l'adreça,
 * però el llistat del darrere s'ha de quedar on era.
 */
export function PanellFitxa({
  fitxa,
  titol,
  tancar,
  confirmant,
  hrefEsborrar,
  esborrable,
  edicio = null,
  resum,
  enrere,
  children,
}: {
  fitxa: Fitxa;
  titol: string;
  /** On porta tancar el panell: el fons i, si no hi ha formulari, el botó «Tanca». */
  tancar: string;
  confirmant: boolean;
  hrefEsborrar: string;
  esborrable: Esborrable | null;
  /** Quin formulari hi ha obert (entitat i id), o cap. Amb formulari, la botonera té «Desa». */
  edicio?: string | null;
  /** Una línia sota el títol: de qui és una activitat. */
  resum?: ReactNode;
  /** Si s'hi ha arribat des d'una altra fitxa, l'enllaç per tornar-hi: va a dalt de tot. */
  enrere?: { href: string; text: string };
  children: ReactNode;
}) {
  return (
    // La clau fa que cada fitxa editada comenci amb l'estat del desat a zero.
    <EdicioFitxa key={edicio ?? "lectura"}>
      <div className="fixed inset-0 z-40">
        <Link href={tancar} scroll={false} aria-label="Tanca la fitxa" className="absolute inset-0 bg-ink/25" />

        <aside className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-cream shadow-2xl">
          <header className="flex items-start justify-between gap-4 px-5 pt-4">
            <div className="min-w-0">
              {enrere ? (
                <Link href={enrere.href} scroll={false} className="mb-1.5 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                  ← {enrere.text}
                </Link>
              ) : null}
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{fitxa.singular}</p>
              <h2 className="truncate font-display text-[21px] leading-tight">{titol}</h2>
            </div>
            {/* Sortir és una sola cosa, s'editi o no: per això no hi ha cap × a part de «Desa». */}
            {/* L'alçada del botó es reserva sempre, també mentre es confirma un esborrat, que no en té cap. */}
            <div className="flex h-8 shrink-0 items-center gap-3">
              {/* Mentre es confirma l'esborrat, l'única decisió és la del peu. */}
              {confirmant ? null : (
                <>
                  <Link href={tancar} scroll={false} className="text-[13px] text-muted transition-colors hover:text-ink">
                    Tanca
                  </Link>
                  {edicio ? <BotoDesa /> : null}
                </>
              )}
            </div>
          </header>

          {resum ? <div className="px-5 pt-1.5 text-[12.5px]">{resum}</div> : null}

          <div className="mt-3 border-b border-line" />

          {/* overscroll-contain: arribar al final del panell no ha de desplaçar la pàgina de sota (a l'iPhone, en rebotar). */}
          <div className="scroll-slim flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

          {esborrable ? (
            <PeuEsborrar esborrable={esborrable} confirmant={confirmant} hrefEsborrar={hrefEsborrar} />
          ) : null}
        </aside>
      </div>
    </EdicioFitxa>
  );
}

/**
 * El peu del panell, fix sota el contingut. Esborrar és l'única acció sense
 * marxa enrere: es demana dues vegades, i la segona al mateix lloc que la primera.
 */
function PeuEsborrar({
  esborrable,
  confirmant,
  hrefEsborrar,
}: {
  esborrable: Esborrable;
  confirmant: boolean;
  hrefEsborrar: string;
}) {
  const { singular, article } = FITXES[esborrable.entitat];
  const que = `${article === "nou" ? "aquest" : "aquesta"} ${singular.toLowerCase()}`;

  if (!confirmant) {
    return (
      <footer className="border-t border-line px-5 py-3">
        <Link
          href={hrefEsborrar}
          scroll={false}
          className="inline-flex items-center rounded-lg bg-marca px-3 py-1.5 text-[13px] font-medium text-cream transition hover:bg-marca-fosc"
        >
          Esborra {que}
        </Link>
      </footer>
    );
  }

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-marca/30 bg-marca-clar px-5 py-3">
      <p className="text-[13px] text-marca-fosc">
        Segur que vols esborrar «{esborrable.nom}»? No es pot desfer.
      </p>
      <div className="flex items-center gap-3">
        <Link href={esborrable.retorn} scroll={false} className="text-[13px] text-muted hover:text-ink">
          Cancel·la
        </Link>
        <form action={esborraFitxaAccio}>
          <input type="hidden" name="entitat" value={esborrable.entitat} />
          <input type="hidden" name="id" value={esborrable.id} />
          <input type="hidden" name="retorn" value={esborrable.retorn} />
          <button
            type="submit"
            className="rounded-lg bg-marca px-3 py-1.5 text-[13px] font-medium text-cream transition hover:bg-marca-fosc"
          >
            Sí, esborra
          </button>
        </form>
      </div>
    </footer>
  );
}
