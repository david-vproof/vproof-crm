"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { desaSegmentPlanificatAccio } from "@/app/(portal)/crm/accions-planificacio";
import { AccionsSegment } from "@/components/crm/AccionsSegment";
import { ModalClients, SENSE_SEGMENT, type ConsultaClients, type Opcio } from "@/components/crm/SelectorClients";
import { descriuSegment, type Criteri, type DefinicioSegment } from "@/domini/crm-segments";
import type { CompteDelSegment } from "@/serveis/crm-segments";

/**
 * La cerca del modal, en criteris de segment, per si es vol desar. Els filtres
 * s'afegeixen als criteris del segment triat, i la cerca de text es desa com a
 * «Nom comercial conté». Si no es pot dir amb criteris —els clients sense
 * segment, o «algun criteri» barrejat amb filtres—, no es pot desar.
 */
function definicioDeConsulta(consulta: ConsultaClients | null): DefinicioSegment | null {
  if (!consulta || consulta.segment === SENSE_SEGMENT) return null;

  const filtres: Criteri[] = [];
  const cerca = consulta.cerca.trim();
  if (cerca) filtres.push({ camp: "nom_comercial", operador: "conte", valors: [cerca] });
  const tipus = consulta.filtres.tipus_client;
  if (tipus) {
    const text = consulta.opcionsRelacio.tipus_client?.find((opcio) => opcio.id === tipus)?.text ?? tipus;
    filtres.push({ camp: "tipus_client", operador: "es", valors: [tipus], textos: [text] });
  }
  const agent = consulta.filtres.agent;
  if (agent) {
    const text = consulta.opcionsRelacio.agents?.find((opcio) => opcio.id === agent)?.text ?? agent;
    filtres.push({ camp: "agent", operador: "es", valors: [agent], textos: [text] });
  }
  if (consulta.filtres.estat) filtres.push({ camp: "estat", operador: "es", valors: [consulta.filtres.estat] });
  if (consulta.filtres.categoria) filtres.push({ camp: "categoria", operador: "es", valors: [consulta.filtres.categoria] });
  if (consulta.filtres.potencial) filtres.push({ camp: "potencial", operador: "es", valors: [consulta.filtres.potencial] });
  if (consulta.filtres.poblacio?.trim()) filtres.push({ camp: "poblacio", operador: "conte", valors: [consulta.filtres.poblacio.trim()] });

  // Els criteris del modal: els del segment triat, retocats, o els afegits sense cap segment.
  const delSegment = consulta.criteris;
  if (consulta.mode === "algun" && delSegment.length > 0 && filtres.length > 0) return null;

  const criteris = [...delSegment, ...filtres];
  return criteris.length === 0 ? null : { mode: delSegment.length > 0 ? consulta.mode : "tots", criteris };
}

/**
 * Planificar sense haver de crear cap segment: es trien clients amb el mateix
 * modal que a les activitats i se'ls fa la ronda de seguida. Si es vol, la
 * cerca es pot desar com a segment, amb nom i codi; si no, no queda res desat
 * més que les activitats.
 */
export function PlanificacioLliure({
  esquerra,
  hrefNouSegment,
  opcionsTipus,
}: {
  esquerra: ReactNode;
  hrefNouSegment: string;
  opcionsTipus: [string, string][];
}) {
  const [obert, setObert] = useState(false);
  const [triats, setTriats] = useState<Opcio[]>([]);
  const [consulta, setConsulta] = useState<ConsultaClients | null>(null);

  const [comptes, setComptes] = useState<CompteDelSegment[] | null>(null);
  const [carregant, setCarregant] = useState(false);
  const [error, setError] = useState("");

  const [nom, setNom] = useState("");
  const [codi, setCodi] = useState("");
  const [desant, setDesant] = useState(false);
  const [missatge, setMissatge] = useState<{ to: "ok" | "error"; text: string } | null>(null);

  const ids = useMemo(() => triats.map((triat) => triat.id), [triats]);
  const definicio = useMemo(() => definicioDeConsulta(consulta), [consulta]);

  // En tancar el modal, els triats es porten sencers, amb el que se'n veu en un segment.
  useEffect(() => {
    if (obert) return;
    if (ids.length === 0) {
      setComptes(null);
      return;
    }
    const aturador = new AbortController();
    setCarregant(true);
    setError("");
    fetch("/api/crm/planificacio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      signal: aturador.signal,
    })
      .then((resposta) => resposta.json())
      .then((cos: { comptes?: CompteDelSegment[]; error?: string }) => {
        if (aturador.signal.aborted) return;
        if (cos.error) setError(cos.error);
        else setComptes(cos.comptes ?? []);
      })
      .catch(() => {
        if (!aturador.signal.aborted) setError("No s'han pogut llegir els clients triats.");
      })
      .finally(() => {
        if (!aturador.signal.aborted) setCarregant(false);
      });
    return () => aturador.abort();
  }, [obert, ids]);

  function descarta() {
    setTriats([]);
    setNom("");
    setCodi("");
    setMissatge(null);
  }

  async function desaSegment() {
    if (!definicio) return;
    setDesant(true);
    setMissatge(null);
    const resultat = await desaSegmentPlanificatAccio({ nom, codi, mode: definicio.mode, criteris: definicio.criteris });
    setDesant(false);
    setMissatge(resultat.error ? { to: "error", text: resultat.error } : { to: "ok", text: resultat.fet ?? "Segment desat." });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        {esquerra}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={hrefNouSegment}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] transition hover:border-ink"
          >
            + Segment amb criteris
          </Link>
          <button type="button" onClick={() => setObert(true)} className="btn-compacte">
            + Nova planificació
          </button>
        </div>
      </div>

      <ModalClients
        obert={obert}
        multiple
        triats={triats}
        alCanviarTriats={setTriats}
        alTancar={() => setObert(false)}
        alCanviarConsulta={setConsulta}
        titol="Clients per planificar"
        ambFiltres={false}
      />

      {triats.length > 0 && !obert ? (
        <div className="px-4 pb-3 sm:px-5">
          <section className="card overflow-hidden border-wine/30">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <div className="min-w-0">
                <h2 className="text-[14.5px] font-medium text-ink">{nom.trim() || "Planificació"}</h2>
                <p className="text-[12.5px] text-muted">
                  {triats.length} {triats.length === 1 ? "client triat" : "clients triats"} · sense segment desat
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                <button type="button" onClick={() => setObert(true)} className="text-muted underline underline-offset-2 hover:text-ink">
                  Canvia la tria
                </button>
                <button type="button" onClick={descarta} className="text-muted underline underline-offset-2 hover:text-wine">
                  Descarta
                </button>
              </div>
            </header>

            {/* Desar-ho com a segment és opcional: la ronda es pot fer igual sense. */}
            <details className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2 text-[13px] text-muted transition hover:text-ink">
                <span className="text-[10px] leading-none transition-transform group-open:rotate-90">▶</span>
                Desa-ho també com a segment (opcional)
              </summary>
              <div className="space-y-2.5 px-3.5 pb-3">
                {definicio ? (
                  <>
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
                      Es desarà amb aquests criteris: <span className="text-ink-soft">{descriuSegment(definicio)}</span>.
                      {consulta && consulta.total !== triats.length
                        ? ` El segment agafarà tots els clients que els compleixin (${consulta.total}), no només els ${triats.length} triats.`
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-[12.5px] text-muted">
                    Aquesta tria no es pot desar com a segment: ve dels clients sense segment o no té cap criteri. La ronda es
                    pot fer igual.
                  </p>
                )}
                {missatge ? (
                  <p
                    role="status"
                    className={`rounded-lg px-3 py-2 text-[13px] ${missatge.to === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-wine-tint text-wine-deep"}`}
                  >
                    {missatge.text}
                  </p>
                ) : null}
              </div>
            </details>

            {carregant ? (
              <p className="px-3.5 py-3 text-[13px] text-muted">Carregant els clients triats…</p>
            ) : error ? (
              <p role="alert" className="px-3.5 py-3 text-[13px] text-wine-deep">
                {error}
              </p>
            ) : comptes ? (
              <AccionsSegment
                key={ids.join(",")}
                comptes={comptes}
                nomSegment={nom.trim() || "Planificació"}
                opcionsTipus={opcionsTipus}
                triatsInicials
              />
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
