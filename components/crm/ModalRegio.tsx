"use client";

import { useEffect, useMemo, useState } from "react";

import { desaSegmentPlanificatAccio } from "@/app/(portal)/crm/accions-planificacio";
import { AccionsSegment } from "@/components/crm/AccionsSegment";
import { textDeRegio, type Regio } from "@/domini/crm-mapa";
import { VARIABLE_UBICACIO } from "@/domini/crm-segments";
import type { CompteDelSegment } from "@/serveis/crm-segments";

/**
 * Els clients que cauen dins de les regions dibuixades al mapa.
 *
 * Es veuen amb les dades de sempre i ja marcats, a punt per fer-los la ronda
 * d'activitats. Si es vol, les regions es desen com a segment per ubicació: un
 * segment que agafa tots els clients que hi caiguin, també els de més endavant.
 */
export function ModalRegio({
  obert,
  alTancar,
  ids,
  regions,
  opcionsTipus,
}: {
  obert: boolean;
  alTancar: () => void;
  /** Els clients de dins, tal com els ha comptat el mapa. */
  ids: string[];
  regions: Regio[];
  opcionsTipus: [string, string][];
}) {
  const [comptes, setComptes] = useState<CompteDelSegment[] | null>(null);
  const [carregant, setCarregant] = useState(false);
  const [error, setError] = useState("");

  const [nom, setNom] = useState("");
  const [codi, setCodi] = useState("");
  const [desant, setDesant] = useState(false);
  const [missatge, setMissatge] = useState<{ to: "ok" | "error"; text: string } | null>(null);

  const clau = useMemo(() => ids.join(","), [ids]);

  // En obrir-lo, els clients de dins es porten sencers: activitats, horaris, facturació.
  useEffect(() => {
    if (!obert) return;
    const aturador = new AbortController();
    setCarregant(true);
    setError("");
    fetch("/api/crm/planificacio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: clau ? clau.split(",") : [] }),
      signal: aturador.signal,
    })
      .then((resposta) => resposta.json())
      .then((cos: { comptes?: CompteDelSegment[]; error?: string }) => {
        if (aturador.signal.aborted) return;
        if (cos.error) setError(cos.error);
        else setComptes(cos.comptes ?? []);
      })
      .catch(() => {
        if (!aturador.signal.aborted) setError("No s'han pogut llegir els clients de la regió.");
      })
      .finally(() => {
        if (!aturador.signal.aborted) setCarregant(false);
      });
    return () => aturador.abort();
  }, [obert, clau]);

  if (!obert) return null;

  const titol = regions.length === 1 ? "Clients dins de la regió" : `Clients dins de les ${regions.length} regions`;

  async function desaSegment() {
    setDesant(true);
    setMissatge(null);
    const resultat = await desaSegmentPlanificatAccio({
      nom,
      codi,
      mode: "tots",
      criteris: [{ camp: VARIABLE_UBICACIO.nom, operador: "dins", valors: regions.map(textDeRegio) }],
    });
    setDesant(false);
    setMissatge(resultat.error ? { to: "error", text: resultat.error } : { to: "ok", text: resultat.fet ?? "Segment desat." });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titol}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/35 sm:items-center sm:p-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          alTancar();
        }
      }}
    >
      <div className="flex max-h-full w-full max-w-[980px] flex-col overflow-hidden bg-cream shadow-2xl sm:rounded-xl sm:border sm:border-line">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-display text-[20px] leading-tight">{titol}</h2>
            <p className="text-[12.5px] text-muted">
              {ids.length} {ids.length === 1 ? "client situat" : "clients situats"} a dins · ja marcats per planificar
            </p>
          </div>
          <button
            type="button"
            aria-label="Tanca"
            onClick={alTancar}
            className="grid size-8 place-items-center rounded-md text-[18px] leading-none text-muted transition hover:bg-parchment hover:text-ink"
          >
            ×
          </button>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
          {/* Desar-ho com a segment per ubicació és opcional: la ronda es pot fer igual. */}
          <details className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] text-muted transition hover:text-ink">
              <span className="text-[10px] leading-none transition-transform group-open:rotate-90">▶</span>
              Desa-ho com a segment per ubicació (opcional)
            </summary>
            <div className="space-y-2.5 px-4 pb-3">
              <div className="flex flex-wrap items-end gap-2.5">
                <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                  Nom
                  <input value={nom} onChange={(e) => setNom(e.target.value)} className="field-compacte normal-case tracking-normal" />
                </label>
                <label className="flex w-[120px] flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                  Codi
                  <input value={codi} onChange={(e) => setCodi(e.target.value)} className="field-compacte normal-case tracking-normal" />
                </label>
                <button type="button" onClick={desaSegment} disabled={desant || !nom.trim()} className="btn-compacte">
                  {desant ? "Desant…" : "Desa el segment"}
                </button>
              </div>
              <p className="text-[12.5px] text-muted">
                El segment agafarà sempre els clients situats dins {regions.length === 1 ? "d'aquesta regió" : `d'aquestes ${regions.length} regions`},
                també els que s&apos;hi situïn més endavant. Al Planificador s&apos;hi poden afegir més criteris.
              </p>
              {missatge ? (
                <p
                  role="status"
                  className={`rounded-lg px-3 py-2 text-[13px] ${missatge.to === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-marca-clar text-marca-fosc"}`}
                >
                  {missatge.text}
                </p>
              ) : null}
            </div>
          </details>

          {carregant ? (
            <p className="px-4 py-3 text-[13px] text-muted">Carregant els clients de la regió…</p>
          ) : error ? (
            <p role="alert" className="px-4 py-3 text-[13px] text-marca-fosc">
              {error}
            </p>
          ) : comptes ? (
            <AccionsSegment key={clau} comptes={comptes} nomSegment={nom.trim() || "Regió del mapa"} opcionsTipus={opcionsTipus} triatsInicials />
          ) : null}
        </div>
      </div>
    </div>
  );
}
