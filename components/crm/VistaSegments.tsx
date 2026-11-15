import Link from "next/link";

import { AccionsSegment } from "@/components/crm/AccionsSegment";
import { PlanificacioLliure } from "@/components/crm/PlanificacioLliure";
import { CercadorLlistat } from "@/components/FiltresLlistat";
import { EstatBuit } from "@/components/UI";
import { COLOR_SENSE_SEGMENT, SENSE_SEGMENT } from "@/domini/crm-planner";
import { descriuSegment } from "@/domini/crm-segments";
import { opcionsDeTipus } from "@/domini/crm-tipus-activitat";
import { segmentsAmbComptes, type CompteDelSegment, type SegmentAmbComptes } from "@/serveis/crm-segments";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

const enllacSegment = (id: string, cerca: string) =>
  `/crm?${new URLSearchParams({ v: "segments", ...(cerca ? { q: cerca } : {}), r: id })}`;

function Targeta({ segment, cerca, opcionsTipus }: { segment: SegmentAmbComptes; cerca: string; opcionsTipus: [string, string][] }) {
  const quants = segment.comptes.length;

  return (
    <details className="group card overflow-hidden">
      {/* Tot el resum obre i tanca; per editar el segment hi ha l'enllaç de dins,
          perquè un enllaç dins del resum faria les dues coses alhora. */}
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 transition-colors hover:bg-parchment/40">
        <span className="text-[10px] leading-none text-muted transition-transform group-open:rotate-90">▶</span>
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />

        <span className="text-[14.5px] font-medium text-ink">{segment.nom}</span>
        {segment.codi ? (
          <span className="rounded bg-parchment px-1.5 py-0.5 font-mono text-[11.5px] text-muted">{segment.codi}</span>
        ) : null}

        {/* Al telèfon es queda la línia sencera: escanyada entre el nom i el
            recompte no s'hi llegiria res, i és el que explica el segment. */}
        <span className="w-full truncate text-[12.5px] text-muted sm:w-auto sm:min-w-0 sm:flex-1">
          {descriuSegment(segment)}
        </span>

        <span className="shrink-0 rounded-full bg-parchment px-2 py-0.5 text-[12px] tabular-nums text-ink-soft">
          {quants} {quants === 1 ? "client" : "clients"}
        </span>
      </summary>

      <div className="border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-[12.5px] text-muted">
          <span>
            Prioritat {segment.ordre} · {segment.mode === "algun" ? "algun criteri" : "tots els criteris"}
          </span>
          <Link href={enllacSegment(segment.id, cerca)} className="text-muted underline underline-offset-2 hover:text-ink">
            Edita el segment
          </Link>
        </div>

        {quants === 0 ? (
          <p className="px-3.5 pb-3 text-[13px] text-muted">
            Cap client compleix aquests criteris ara mateix.
          </p>
        ) : (
          <AccionsSegment comptes={segment.comptes} nomSegment={segment.nom} opcionsTipus={opcionsTipus} />
        )}
      </div>
    </details>
  );
}

/**
 * El segment automàtic: els clients que no encaixen en cap dels altres. No té
 * criteris propis ni s'edita, però s'hi pot fer la ronda igual que a qualsevol.
 */
function TargetaSenseSegment({
  comptes,
  totalComptes,
  opcionsTipus,
}: {
  comptes: CompteDelSegment[];
  totalComptes: number;
  opcionsTipus: [string, string][];
}) {
  return (
    <details className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 transition-colors hover:bg-parchment/40">
        <span className="text-[10px] leading-none text-muted transition-transform group-open:rotate-90">▶</span>
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR_SENSE_SEGMENT }} />

        <span className="text-[14.5px] font-medium text-ink">Clients sense segment</span>
        <span className="rounded bg-parchment px-1.5 py-0.5 text-[11.5px] text-muted">Automàtic</span>

        <span className="w-full truncate text-[12.5px] text-muted sm:w-auto sm:min-w-0 sm:flex-1">
          No encaixen en cap dels altres segments
        </span>

        <span className="shrink-0 rounded-full bg-parchment px-2 py-0.5 text-[12px] tabular-nums text-ink-soft">
          {comptes.length} de {totalComptes}
        </span>
      </summary>

      <div className="border-t border-line">
        <p className="px-3.5 py-2 text-[12.5px] text-muted">Es calcula sol a partir dels altres segments: no es pot editar.</p>
        <AccionsSegment comptes={comptes} nomSegment={SENSE_SEGMENT} opcionsTipus={opcionsTipus} />
      </div>
    </details>
  );
}

/**
 * El llistat de segments: cada un es desplega i ensenya els comptes que ha
 * seleccionat, amb el que cal per decidir si el filtre fa el que ha de fer.
 */
export async function VistaSegments({ cerca }: { cerca: string }) {
  let dades;
  let definicions;
  try {
    [dades, definicions] = await Promise.all([segmentsAmbComptes(cerca), tipusActivitat()]);
  } catch (error) {
    return (
      <div className="p-5">
        <EstatBuit titol="No s'ha pogut llegir el CRM" text={(error as Error).message} />
      </div>
    );
  }

  const { segments, clientsSenseSegment, totalComptes } = dades;
  const opcionsTipus = opcionsDeTipus(definicions);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Es pot planificar sense segment: triar clients al modal i fer-los la ronda de seguida. */}
      <PlanificacioLliure
        hrefNouSegment="/crm?v=segments&r=nou"
        opcionsTipus={opcionsTipus}
        esquerra={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <CercadorLlistat accio="/crm" valor={cerca} marcador="Cerca segments…" ocults={{ v: "segments" }} />
            <span className="whitespace-nowrap text-[13px] text-muted">
              {segments.length} {segments.length === 1 ? "segment" : "segments"}
            </span>
            {cerca ? (
              <Link href="/crm?v=segments" className="whitespace-nowrap rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px] text-muted transition hover:border-ink hover:text-ink">
                ↺ Restaura els filtres
              </Link>
            ) : null}
          </div>
        }
      />

      {segments.length === 0 ? (
        <div className="px-4 pb-6 sm:px-5">
          <EstatBuit
            titol={cerca ? "Cap resultat" : "Encara no hi ha segments"}
            text={
              cerca
                ? "Prova amb un altre terme de cerca."
                : "Un segment agrupa clients per criteris. Comença amb el botó «Nou segment»."
            }
          />
        </div>
      ) : (
        <div className="space-y-2 px-4 pb-4 sm:px-5">
          {segments.map((segment) => (
            <Targeta key={segment.id} segment={segment} cerca={cerca} opcionsTipus={opcionsTipus} />
          ))}
        </div>
      )}

      {/* El segment automàtic va al final: és el que queda dels altres. */}
      {!cerca && clientsSenseSegment.length > 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <TargetaSenseSegment comptes={clientsSenseSegment} totalComptes={totalComptes} opcionsTipus={opcionsTipus} />
        </div>
      ) : null}
    </div>
  );
}
