"use client";

import { useEffect, useState } from "react";

import { SENYAL_OBERTA, SENYAL_TANCADA, senyalActivitat } from "@/components/crm/EstatActivitat";
import { ICONES } from "@/components/Icones";
import { DIES_SETMANA, DIES_SETMANA_LLARG, dillunsDe, type DiaPlanner, type GrupSegment, type MesPlanner, type SetmanaPlanner } from "@/domini/crm-planner";

type Segment = { id: string; nom: string; color: string };
type Vista = { mode: "mes"; clau: string } | { mode: "setmana"; clau: string };
type Dades = { mode: "mes"; mes: MesPlanner; segments: Segment[] } | { mode: "setmana"; setmana: SetmanaPlanner; segments: Segment[] };

/** Quantes visites caben en una casella del mes abans de resumir la resta. */
const MAXIM_PER_DIA = 4;

const posicioSetmana = (clau: string) => (new Date(`${clau}T00:00:00Z`).getUTCDay() + 6) % 7;

/** «2026-11-04» → «4 de novembre del 2026», per al nom del botó de cada dia. */
const etiquetaDia = (clau: string) =>
  new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${clau}T00:00:00Z`));

/** Una visita d'un dia: l'hora i qui es visita, del color del segment. Només es mira: el que es tria és el dia. */
function Visita({ acte, gran = false }: { acte: GrupSegment["esdeveniments"][number]; gran?: boolean }) {
  return (
    <span
      style={{ backgroundColor: `${acte.color}14`, borderLeftColor: acte.color }}
      className={`flex items-baseline gap-1 rounded-r-md border-l-[3px] py-0.5 pl-1.5 pr-0.5 ${gran ? "text-[13px]" : "text-[11.5px]"} ${
        acte.tancada ? "text-muted" : "text-ink-soft"
      }`}
    >
      <span aria-hidden className={`shrink-0 ${gran ? "text-[11px]" : "text-[9.5px]"} ${acte.tancada ? "opacity-90" : "opacity-45"}`} style={{ color: acte.color }}>
        {senyalActivitat(acte.tancada)}
      </span>
      <span className={`shrink-0 tabular-nums ${gran ? "text-[12px]" : "text-[10.5px]"} ${acte.tancada ? "opacity-70" : "font-semibold"}`} style={{ color: acte.color }}>
        {acte.hora}
      </span>
      <span className="min-w-0 truncate">{acte.compte || acte.titol}</span>
    </span>
  );
}

/** Els segments d'un dia, tallats per visites si hi ha màxim. */
function SegmentsDelDia({ dia, maxim, gran = false }: { dia: DiaPlanner; maxim?: number; gran?: boolean }) {
  const visibles: GrupSegment[] = [];
  let mostrades = 0;
  for (const grup of dia.grups) {
    if (maxim !== undefined && mostrades >= maxim) break;
    const cabuda = maxim === undefined ? grup.esdeveniments : grup.esdeveniments.slice(0, maxim - mostrades);
    visibles.push({ ...grup, esdeveniments: cabuda });
    mostrades += cabuda.length;
  }
  const resta = dia.total - mostrades;
  return (
    <span className={`flex flex-col ${gran ? "gap-1.5" : "gap-[3px]"}`}>
      {visibles.map((grup) => (
        <span key={grup.segmentId || "cap"} className="flex flex-col gap-[2px]">
          <span className={`flex items-center gap-1.5 pt-0.5 font-semibold uppercase tracking-[0.08em] ${gran ? "text-[11px]" : "text-[9.5px]"}`} style={{ color: grup.color }}>
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: grup.color }} />
            <span className="truncate">{grup.segment}</span>
          </span>
          {grup.esdeveniments.map((acte) => (
            <Visita key={acte.id} acte={acte} gran={gran} />
          ))}
        </span>
      ))}
      {resta > 0 ? <span className="pl-1.5 pt-0.5 text-[11px] text-muted">+{resta} més</span> : null}
    </span>
  );
}

function NumeroDia({ dia }: { dia: DiaPlanner }) {
  return (
    <span
      className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] tabular-nums ${
        dia.avui ? "bg-wine font-semibold text-cream" : dia.delMes ? "font-medium text-ink" : "text-muted/50"
      }`}
    >
      {dia.numero}
    </span>
  );
}

/** Un dia que es pot triar. El que té visites és el que interessa; els altres es poden triar igual, però ho diuen. */
function BotoDia({ dia, triat, alTriar, className, children }: { dia: DiaPlanner; triat: boolean; alTriar: (dia: string) => void; className: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => alTriar(dia.clau)}
      aria-pressed={triat}
      aria-label={`${etiquetaDia(dia.clau)}: ${dia.total} ${dia.total === 1 ? "visita" : "visites"}`}
      title={dia.total === 0 ? "Cap visita aquest dia" : undefined}
      className={`${className} text-left transition-colors hover:bg-wine-tint/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 ${
        triat ? "!bg-wine-tint/60 shadow-[inset_0_0_0_2px_#8c2f45]" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * El calendari del Planner en un modal, per triar-hi un dia: per mes o per
 * setmana, amb les visites de cada dia repartides per segment, igual que al
 * Planner. Tocar un dia el tria i tanca el modal. És l'agenda de qui té la
 * sessió oberta (o la de tothom, si és administrador). Només es munta obert,
 * i cada canvi de mes o de setmana es demana al servidor.
 */
export function ModalAgendaDies({ obert, triat, alTriar, alTancar }: { obert: boolean; triat: string; alTriar: (dia: string) => void; alTancar: () => void }) {
  const [vista, setVista] = useState<Vista>({ mode: "mes", clau: triat ? triat.slice(0, 7) : "" });
  const [dades, setDades] = useState<Dades | null>(null);
  const [error, setError] = useState("");
  const [carregant, setCarregant] = useState(false);

  // En obrir-lo, on hi ha el dia triat (o avui), amb la vista que es mirava l'últim cop.
  useEffect(() => {
    if (!obert) return;
    setVista((ara) =>
      ara.mode === "setmana" ? { mode: "setmana", clau: triat ? dillunsDe(triat) : "" } : { mode: "mes", clau: triat ? triat.slice(0, 7) : "" },
    );
  }, [obert, triat]);

  useEffect(() => {
    if (!obert) return;
    const aturador = new AbortController();
    const consulta = vista.mode === "setmana" ? `pv=setmana&s=${vista.clau}` : vista.clau ? `m=${vista.clau}` : "";
    setCarregant(true);
    setError("");
    fetch(`/api/crm/agenda?${consulta}`, { cache: "no-store", signal: aturador.signal })
      .then(async (resposta) => {
        const cos = (await resposta.json()) as { error?: string; mes?: MesPlanner; setmana?: SetmanaPlanner; segments?: Segment[] };
        if (!resposta.ok || cos.error) throw new Error(cos.error ?? `El servidor ha respost ${resposta.status}.`);
        if (cos.setmana) setDades({ mode: "setmana", setmana: cos.setmana, segments: cos.segments ?? [] });
        else if (cos.mes) setDades({ mode: "mes", mes: cos.mes, segments: cos.segments ?? [] });
      })
      .catch((fallada: Error) => {
        if (!aturador.signal.aborted) setError(`No s'ha pogut llegir l'agenda: ${fallada.message}`);
      })
      .finally(() => !aturador.signal.aborted && setCarregant(false));
    return () => aturador.abort();
  }, [obert, vista]);

  if (!obert) return null;

  const Tancar = ICONES.tancar;
  const pas = "grid size-8 place-items-center rounded-lg border border-line bg-white text-muted transition hover:border-ink hover:text-ink";
  const tria = (activa: boolean) => `rounded-md px-2.5 py-1 text-[12.5px] transition ${activa ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`;

  const titol = dades?.mode === "setmana" ? dades.setmana.etiqueta : dades?.mode === "mes" ? dades.mes.etiqueta : "Agenda";
  const total = dades?.mode === "setmana" ? dades.setmana.total : dades?.mode === "mes" ? dades.mes.total : null;
  const anterior = dades?.mode === "setmana" ? dades.setmana.anterior : dades?.mode === "mes" ? dades.mes.anterior : "";
  const seguent = dades?.mode === "setmana" ? dades.setmana.seguent : dades?.mode === "mes" ? dades.mes.seguent : "";
  const dies: DiaPlanner[] = dades?.mode === "setmana" ? dades.setmana.dies : dades?.mode === "mes" ? dades.mes.setmanes.flat() : [];
  const ambVisites = dies.filter((dia) => dia.delMes && dia.total > 0);

  const vesA = (mode: Vista["mode"]) => {
    if (!dades || mode === vista.mode) return;
    // De mes a setmana: la del dia triat si és del mes, i si no la del dia 1. De setmana a mes: el del dilluns.
    if (mode === "setmana") {
      const dins = triat && dades.mode === "mes" && triat.startsWith(dades.mes.actual) ? triat : `${dades.mode === "mes" ? dades.mes.actual : vista.clau.slice(0, 7)}-01`;
      setVista({ mode: "setmana", clau: dillunsDe(dins) });
    } else {
      setVista({ mode: "mes", clau: dades.mode === "setmana" ? dades.setmana.actual.slice(0, 7) : vista.clau });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tria el dia de visita"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/35 sm:items-center sm:p-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          alTancar();
        }
      }}
    >
      <div className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden bg-cream shadow-2xl sm:rounded-xl sm:border sm:border-line">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Dia de visita</p>
            <h2 className="font-display text-[20px] leading-tight">Tria un dia de l&apos;agenda</h2>
          </div>
          <button type="button" aria-label="Tanca" onClick={alTancar} className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink">
            <Tancar className="size-[18px]" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-3">
            <h3 className="truncate font-display text-[20px] leading-none">{titol}</h3>
            {total !== null ? (
              <span className="shrink-0 text-[12.5px] text-muted">
                {total} {total === 1 ? "activitat" : "activitats"}
              </span>
            ) : null}
            {carregant ? <span className="text-[12.5px] text-muted" role="status">Llegint…</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-line bg-parchment/60 p-0.5">
              <button type="button" onClick={() => vesA("mes")} className={tria(vista.mode === "mes")}>
                Mes
              </button>
              <button type="button" onClick={() => vesA("setmana")} className={tria(vista.mode === "setmana")}>
                Setmana
              </button>
            </div>
            <nav className="flex items-center gap-1" aria-label={vista.mode === "setmana" ? "Canvi de setmana" : "Canvi de mes"}>
              <button type="button" disabled={!anterior} onClick={() => setVista({ mode: vista.mode, clau: anterior })} aria-label={vista.mode === "setmana" ? "Setmana anterior" : "Mes anterior"} className={pas}>
                ‹
              </button>
              <button type="button" onClick={() => setVista({ mode: vista.mode, clau: "" })} className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink">
                Avui
              </button>
              <button type="button" disabled={!seguent} onClick={() => setVista({ mode: vista.mode, clau: seguent })} aria-label={vista.mode === "setmana" ? "Setmana següent" : "Mes següent"} className={pas}>
                ›
              </button>
            </nav>
          </div>
        </div>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <p role="alert" className="py-6 text-center text-[13px] text-wine-deep">
              {error}
            </p>
          ) : !dades ? (
            <p className="py-10 text-center text-[13px] text-muted">Llegint l&apos;agenda…</p>
          ) : (
            <>
              {/* A partir de tauleta, la graella; al telèfon, només els dies amb visites. */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-white shadow-sm md:block">
                {dades.mode === "mes" ? (
                  <>
                    <div className="grid grid-cols-7 border-b border-line bg-cream/60">
                      {DIES_SETMANA.map((nom) => (
                        <span key={nom} className="px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                          {nom}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
                      {dies.map((dia) => (
                        <BotoDia
                          key={dia.clau}
                          dia={dia}
                          triat={dia.clau === triat}
                          alTriar={alTriar}
                          className={`flex min-h-[112px] flex-col gap-1 border-b border-r border-line/70 p-1.5 ${
                            dia.delMes ? (dia.capDeSetmana ? "bg-parchment/25" : "bg-white") : "bg-parchment/40"
                          }`}
                        >
                          <NumeroDia dia={dia} />
                          <SegmentsDelDia dia={dia} maxim={MAXIM_PER_DIA} />
                        </BotoDia>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-7">
                    {dies.map((dia) => (
                      <BotoDia
                        key={dia.clau}
                        dia={dia}
                        triat={dia.clau === triat}
                        alTriar={alTriar}
                        className={`flex min-h-[320px] flex-col border-r border-line/70 last:border-r-0 ${dia.capDeSetmana ? "bg-parchment/25" : "bg-white"}`}
                      >
                        <span className="flex items-center gap-1.5 border-b border-line/70 px-2 py-1.5">
                          <NumeroDia dia={dia} />
                          <span className="text-[11.5px] text-muted">{DIES_SETMANA_LLARG[posicioSetmana(dia.clau)]}</span>
                        </span>
                        <span className="block p-1.5">
                          {dia.total === 0 ? <span className="block px-1 pt-1 text-[11.5px] text-muted/60">Lliure</span> : <SegmentsDelDia dia={dia} />}
                        </span>
                      </BotoDia>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 md:hidden">
                {ambVisites.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted">Cap visita en aquest tram. Canvia de mes o de setmana.</p>
                ) : (
                  ambVisites.map((dia) => (
                    <BotoDia key={dia.clau} dia={dia} triat={dia.clau === triat} alTriar={alTriar} className="block w-full overflow-hidden rounded-xl border border-line bg-white">
                      <span className="flex items-center gap-2 border-b border-line bg-cream/60 px-3 py-2 text-[13px]">
                        <NumeroDia dia={dia} />
                        <span className="text-muted">{DIES_SETMANA_LLARG[posicioSetmana(dia.clau)]}</span>
                        <span className="ml-auto text-[12px] text-muted">
                          {dia.total} {dia.total === 1 ? "visita" : "visites"}
                        </span>
                      </span>
                      <span className="block p-2.5">
                        <SegmentsDelDia dia={dia} gran />
                      </span>
                    </BotoDia>
                  ))
                )}
              </div>

              <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
                {dades.segments.map((segment) => (
                  <li key={segment.id} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.nom}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <span aria-hidden>{SENYAL_OBERTA}</span> oberta
                </li>
                <li className="flex items-center gap-1.5">
                  <span aria-hidden>{SENYAL_TANCADA}</span> tancada
                </li>
              </ul>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-[13px] text-muted">
          <span>Toca un dia per agafar-ne els clients.</span>
          <button type="button" onClick={alTancar} className="btn-compacte">
            Tanca
          </button>
        </footer>
      </div>
    </div>
  );
}
