"use client";

import { useEffect, useState } from "react";

import type { ClientOLead } from "@/domini/cistella-productes";

type Opcio = { id: string; text: string };

/** Quants en porta la cerca de relacions: si n'arriben tants, potser n'hi ha més. */
const OPCIONS_PER_CERCA = 25;

/**
 * El modal de tria de leads del selector de productes: una cerca i prou, que els
 * leads no tenen els filtres ni els segments dels clients. Va dins del
 * configurador, que pot ser dins d'un formulari: cap botó l'envia i cap camp
 * porta `name`.
 */
export function ModalLeads({
  obert,
  triats,
  alCanviarTriats,
  alTancar,
}: {
  obert: boolean;
  triats: ClientOLead[];
  alCanviarTriats: (triats: ClientOLead[]) => void;
  alTancar: () => void;
}) {
  const [cerca, setCerca] = useState("");
  const [trobats, setTrobats] = useState<Opcio[] | null>(null);
  const [carregant, setCarregant] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!obert) return;
    const aturador = new AbortController();
    const espera = setTimeout(
      async () => {
        setCarregant(true);
        setError("");
        try {
          const resposta = await fetch(`/api/crm/relacions?fitxa=leads&q=${encodeURIComponent(cerca.trim())}`, { signal: aturador.signal });
          const cos = (await resposta.json()) as { opcions?: Opcio[]; error?: string };
          if (!resposta.ok) throw new Error(cos.error ?? "No s'ha pogut cercar.");
          setTrobats(cos.opcions ?? []);
        } catch (fallada) {
          if (aturador.signal.aborted || (fallada as Error).name === "AbortError") return;
          setError("No s'ha pogut cercar. Torna-ho a provar.");
        } finally {
          if (!aturador.signal.aborted) setCarregant(false);
        }
      },
      cerca ? 220 : 0,
    );
    return () => {
      clearTimeout(espera);
      aturador.abort();
    };
  }, [obert, cerca]);

  if (!obert) return null;

  const tanca = () => {
    setCerca("");
    alTancar();
  };

  const idsTriats = new Set(triats.map((lead) => lead.id));
  const commuta = (lead: Opcio) =>
    alCanviarTriats(idsTriats.has(lead.id) ? triats.filter((triat) => triat.id !== lead.id) : [...triats, { ...lead, lead: true }]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leads de qui mirar els presentacions"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/35 sm:items-center sm:p-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          tanca();
        }
      }}
    >
      <div className="flex max-h-full w-full max-w-[520px] flex-col overflow-hidden bg-cream shadow-2xl sm:rounded-xl sm:border sm:border-line">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-[20px] leading-tight">Leads de qui mirar els presentacions</h2>
          <button
            type="button"
            aria-label="Tanca"
            onClick={tanca}
            className="grid size-8 place-items-center rounded-md text-[18px] leading-none text-muted transition hover:bg-parchment hover:text-ink"
          >
            ×
          </button>
        </header>

        <div className="border-b border-line px-4 py-3">
          <input
            type="search"
            autoFocus
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            // Dins del formulari de l'activitat, Enter l'enviaria.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Negoci, contacte, correu o població"
            aria-label="Cerca leads"
            className="field-compacte text-[16px] sm:text-[13px]"
          />
        </div>

        <div className="scroll-slim min-h-[200px] flex-1 overflow-y-auto px-4 py-2">
          <p role="status" className="py-1 text-[12.5px] text-muted">
            {carregant ? "Cercant…" : trobats && trobats.length >= OPCIONS_PER_CERCA ? `Se n'ensenyen els ${trobats.length} primers: afina la cerca.` : ""}
          </p>

          {error ? (
            <p role="alert" className="py-3 text-[13px] text-marca-fosc">
              {error}
            </p>
          ) : trobats && trobats.length === 0 && !carregant ? (
            <p className="py-3 text-[13px] text-muted">{cerca.trim() ? "Cap lead amb aquesta cerca." : "Encara no hi ha cap lead."}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {(trobats ?? []).map((lead) => {
                const triat = idsTriats.has(lead.id);
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => commuta(lead)}
                      aria-pressed={triat}
                      className={`flex w-full items-center gap-2.5 px-1.5 py-2 text-left transition-colors hover:bg-parchment/60 ${
                        triat ? "shadow-[inset_3px_0_0_0_#0f766e]" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid size-4 shrink-0 place-items-center rounded border text-[10px] leading-none ${
                          triat ? "border-marca bg-marca text-cream" : "border-line bg-white"
                        }`}
                      >
                        {triat ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1 text-[13.5px] text-ink [overflow-wrap:anywhere]">{lead.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="text-[13px] text-muted">
            {triats.length} {triats.length === 1 ? "lead triat" : "leads triats"}
          </span>
          <button type="button" onClick={tanca} className="btn-compacte">
            Fet
          </button>
        </footer>
      </div>
    </div>
  );
}
