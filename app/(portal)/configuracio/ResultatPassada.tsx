import Link from "next/link";

import { Dada } from "@/components/UI";
import { FITXA_TAULA, NOM_FASE, resumComptadors } from "@/domini/sincronitzacio";
import { dataHoraCurta, durada, quantitat } from "@/lib/format";
import type { Execucio } from "@/serveis/sincronitzacio";

import { EtiquetaEstatExecucio } from "./EstatExecucio";
import { LlistaErrors } from "./SeguimentEnViu";

/**
 * Una passada acabada, amb tot el detall: quan, quant ha durat, els
 * comptadors, els avisos i, si n'hi ha, les fitxes que no s'han pogut copiar.
 */
export function ResultatPassada({ execucio }: { execucio: Execucio }) {
  const fi = execucio.fi ? Date.parse(execucio.fi) : null;
  const inici = Date.parse(execucio.inici);
  const errors = execucio.errors ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <EtiquetaEstatExecucio estat={execucio.estat} />
        <span className="text-ink">{dataHoraCurta(execucio.inici)}</span>
        {fi ? <span className="text-muted">· {durada(fi - inici)}</span> : null}
        <span className="text-muted">· {execucio.desencadenant === "manual" ? "manual" : "programada"}</span>
      </div>

      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <Dada etiqueta="Llegides" valor={numero(execucio.llegits)} />
        <Dada etiqueta="Creades" valor={numero(execucio.creats)} />
        <Dada etiqueta="Actualitzades" valor={numero(execucio.actualitzats)} />
        <Dada etiqueta="Marcades absents" valor={numero(execucio.absents)} />
        <Dada etiqueta="Sense canvis" valor={numero(execucio.iguals)} />
        {execucio.fallits ? <Dada etiqueta="Sense copiar" valor={<span className="text-amber-800">{quantitat(execucio.fallits)}</span>} /> : null}
        {execucio.pendents ? <Dada etiqueta="Per a la propera" valor={quantitat(execucio.pendents)} /> : null}
        {execucio.estat === "error" && execucio.fase ? (
          <Dada
            etiqueta="S'ha quedat a"
            valor={`${NOM_FASE[execucio.fase]}${execucio.progres?.detall ? ` · ${execucio.progres.detall}` : ""}${
              execucio.progres?.fets !== null && execucio.progres?.fets !== undefined && execucio.progres.total
                ? ` (${quantitat(execucio.progres.fets)} de ${quantitat(execucio.progres.total)})`
                : ""
            }`}
          />
        ) : null}
      </dl>

      {execucio.missatge ? (
        <p
          className={`rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
            execucio.estat === "error" ? "bg-wine-tint text-wine-deep" : "bg-parchment text-ink"
          }`}
        >
          {execucio.missatge}
        </p>
      ) : null}

      {errors.length > 0 ? <LlistaErrors errors={errors} total={execucio.fallits ?? errors.length} /> : null}
    </div>
  );
}

function numero(valor: number | null) {
  return valor === null ? null : quantitat(valor);
}

/**
 * Les passades, una per línia: quan, com ha anat i els comptadors. Amb
 * `ambTaula`, també de quina taula és, per a la llista global. Les que han
 * deixat files sense copiar es poden desplegar per veure quines.
 */
export function HistorialPassades({ execucions, ambTaula = false }: { execucions: Execucio[]; ambTaula?: boolean }) {
  if (execucions.length === 0) return <p className="text-[13.5px] text-muted">Encara no s&apos;ha fet cap passada.</p>;
  return (
    <ul className="divide-y divide-line/70 text-[13px]">
      {execucions.map((execucio) => {
        const errors = execucio.errors ?? [];
        const fi = execucio.fi ? Date.parse(execucio.fi) : null;
        return (
          <li key={execucio.id} className="py-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="w-[150px] shrink-0 tabular-nums text-ink">{dataHoraCurta(execucio.inici)}</span>
              {ambTaula ? (
                <Link href={`/configuracio?t=${execucio.taula}`} className="w-[86px] shrink-0 font-medium text-ink underline-offset-2 hover:underline">
                  {FITXA_TAULA[execucio.taula]?.etiqueta ?? execucio.taula}
                </Link>
              ) : null}
              <EtiquetaEstatExecucio estat={execucio.estat} />
              <span className="text-muted">{execucio.desencadenant === "manual" ? "manual" : "programada"}</span>
              {fi ? <span className="tabular-nums text-muted">{durada(fi - Date.parse(execucio.inici))}</span> : null}
              <span className="min-w-0 flex-1 truncate text-muted" title={execucio.missatge ?? undefined}>
                {execucio.estat === "error"
                  ? execucio.missatge
                  : execucio.estat === "en_curs"
                    ? `en curs${execucio.fase ? ` · ${NOM_FASE[execucio.fase]}` : ""}${execucio.progres?.detall ? ` · ${execucio.progres.detall}` : ""}`
                    : resumComptadors({
                        llegits: execucio.llegits ?? 0,
                        creats: execucio.creats ?? 0,
                        actualitzats: execucio.actualitzats ?? 0,
                        absents: execucio.absents ?? 0,
                        iguals: execucio.iguals ?? 0,
                        fallits: execucio.fallits ?? 0,
                        pendents: execucio.pendents ?? 0,
                      })}
              </span>
            </div>
            {errors.length > 0 ? (
              <div className="mt-2 pl-0 sm:pl-[162px]">
                <LlistaErrors errors={errors} total={execucio.fallits ?? errors.length} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
