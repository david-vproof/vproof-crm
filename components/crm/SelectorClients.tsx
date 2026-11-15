"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { EditorCriteris } from "@/components/crm/ConstructorCriteris";
import { MiniFacturacio, fonsDeTendencia } from "@/components/crm/MiniFacturacio";
import { Notes } from "@/components/crm/Notes";
import { Pastilla } from "@/components/crm/Pastilla";
import { Lletres } from "@/components/crm/Lletres";
import { ICONES } from "@/components/Icones";
import { FITXES } from "@/domini/crm-fitxes";
import { MODES, type Criteri, type Mode } from "@/domini/crm-segments";
import { TENDENCIES } from "@/domini/facturacio-tendencia";

export type Opcio = { id: string; text: string };
type SegmentDesat = { id: string; nom: string; color: string; mode: Mode; criteris: Criteri[] };
type Trobat = {
  id: string;
  nom: string;
  detall: string;
  categoria: string;
  potencial: string;
  tipusClient: string;
  notes: string;
  facturacio: Record<string, unknown>;
};
type Dades = { segments: SegmentDesat[]; opcionsRelacio: Record<string, Opcio[]> };

/** El valor del desplegable de segmentació per als clients que no encaixen en cap. */
export const SENSE_SEGMENT = "__sense_segment";

/** La cerca que hi ha feta al modal, per a qui la vulgui desar com a segment. */
export type ConsultaClients = {
  cerca: string;
  filtres: Record<string, string>;
  /** L'id del segment desat, `SENSE_SEGMENT` o buit. */
  segment: string;
  mode: Mode;
  criteris: Criteri[];
  /** Quants clients hi encaixen, no només els que s'ensenyen. */
  total: number;
  opcionsRelacio: Record<string, Opcio[]>;
};

const opcionsDe = (nom: string) => FITXES.clients.camps.find((camp) => camp.nom === nom)?.opcions ?? [];

/**
 * El modal de tria de clients de tot el CRM.
 *
 * Filtra amb els filtres de la pantalla de clients, una segmentació desada o la
 * dels clients sense segment, i els criteris d'aquella segmentació per
 * retocar-los; els retocs només valen per a la cerca, el segment desat no es
 * toca. Qui l'obre en guarda la tria: el camp de client d'una fitxa, o la
 * planificació del Planificador.
 *
 * Es queda muntat encara que estigui tancat, perquè en tornar-lo a obrir hi
 * hagi la mateixa cerca.
 */
export function ModalClients({
  obert,
  multiple,
  triats,
  alCanviarTriats,
  alTancar,
  alCanviarConsulta,
  titol,
  ambFiltres = true,
}: {
  obert: boolean;
  multiple: boolean;
  triats: Opcio[];
  alCanviarTriats: (triats: Opcio[]) => void;
  alTancar: () => void;
  alCanviarConsulta?: (consulta: ConsultaClients) => void;
  titol?: string;
  /**
   * Els filtres fixos (nom, tipus, estat, categoria, potencial, població). Per triar un
   * client en una fitxa calen; per planificar no: tot es tria amb la
   * segmentació i els seus criteris, que llavors surten sempre.
   */
  ambFiltres?: boolean;
}) {
  const [dades, setDades] = useState<Dades | null>(null);

  const [cerca, setCerca] = useState("");
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [segment, setSegment] = useState("");
  const [criteris, setCriteris] = useState<Criteri[]>([]);
  const [mode, setMode] = useState<Mode>("tots");

  const [resultat, setResultat] = useState<{ files: Trobat[]; total: number } | null>(null);
  const [carregant, setCarregant] = useState(false);
  const [error, setError] = useState("");

  const avisaConsulta = useRef(alCanviarConsulta);
  avisaConsulta.current = alCanviarConsulta;

  // Els segments i les opcions dels filtres es demanen un sol cop, en obrir-lo.
  useEffect(() => {
    if (!obert || dades) return;
    let viu = true;
    fetch("/api/crm/clients")
      .then((resposta) => resposta.json())
      .then((cos: Dades & { error?: string }) => {
        if (!viu) return;
        if (cos.error) setError(cos.error);
        else setDades(cos);
      })
      .catch(() => viu && setError("No s'han pogut llegir els segments."));
    return () => {
      viu = false;
    };
  }, [obert, dades]);

  const peticio = useMemo(
    () =>
      JSON.stringify({
        cerca,
        filtres,
        // Els criteris compten sempre que n'hi hagi, també sense segment o damunt dels clients sense segment.
        segmentat: criteris.length > 0 || Boolean(segment && segment !== SENSE_SEGMENT),
        senseSegment: segment === SENSE_SEGMENT,
        mode,
        criteris,
      }),
    [cerca, filtres, segment, mode, criteris],
  );

  // Es deixa respirar una estona: així no es pregunta a cada tecla.
  useEffect(() => {
    if (!obert) return;
    const aturador = new AbortController();
    const temporitzador = setTimeout(async () => {
      setCarregant(true);
      try {
        const resposta = await fetch("/api/crm/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: peticio,
          signal: aturador.signal,
        });
        const cos = (await resposta.json()) as { files?: Trobat[]; total?: number; error?: string };
        if (aturador.signal.aborted) return;
        if (cos.error) {
          setError(cos.error);
          return;
        }
        setError("");
        setResultat({ files: cos.files ?? [], total: cos.total ?? 0 });
      } catch (fallada) {
        if (aturador.signal.aborted || (fallada as Error).name === "AbortError") return;
        setError("No s'ha pogut cercar.");
      } finally {
        if (!aturador.signal.aborted) setCarregant(false);
      }
    }, 250);
    return () => {
      clearTimeout(temporitzador);
      aturador.abort();
    };
  }, [obert, peticio]);

  // Qui ho necessita sap sempre quina cerca hi ha feta.
  useEffect(() => {
    avisaConsulta.current?.({
      cerca,
      filtres,
      segment,
      mode,
      criteris,
      total: resultat?.total ?? 0,
      opcionsRelacio: dades?.opcionsRelacio ?? {},
    });
  }, [cerca, filtres, segment, mode, criteris, resultat, dades]);

  if (!obert) return null;

  function triaSegment(valor: string) {
    setSegment(valor);
    // Els criteris es copien: retocar-los aquí no ha de tocar el segment desat.
    const desat = dades?.segments.find((s) => s.id === valor);
    setCriteris(desat ? desat.criteris.map((criteri) => ({ ...criteri, valors: [...criteri.valors] })) : []);
    setMode(desat?.mode ?? "tots");
  }

  const idsTriats = new Set(triats.map((triat) => triat.id));

  function commuta(client: Trobat) {
    if (!multiple) {
      alCanviarTriats([{ id: client.id, text: client.nom }]);
      alTancar();
      return;
    }
    alCanviarTriats(
      idsTriats.has(client.id)
        ? triats.filter((triat) => triat.id !== client.id)
        : [...triats, { id: client.id, text: client.nom }],
    );
  }

  function triaTots() {
    const tots = new Map(triats.map((triat) => [triat.id, triat]));
    for (const client of resultat?.files ?? []) tots.set(client.id, { id: client.id, text: client.nom });
    alCanviarTriats([...tots.values()]);
  }

  const posaFiltre = (camp: string, valor: string) => setFiltres((previs) => ({ ...previs, [camp]: valor }));
  const nomModal = titol ?? (multiple ? "Tria clients" : "Tria un client");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={nomModal}
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/35 sm:items-center sm:p-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          alTancar();
        }
      }}
    >
      <div className="flex max-h-full w-full max-w-[860px] flex-col overflow-hidden bg-cream shadow-2xl sm:rounded-xl sm:border sm:border-line">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-[20px] leading-tight">{nomModal}</h2>
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
          {/* Els filtres de la pantalla de clients. A la planificació no n'hi ha: tot es tria amb criteris. */}
          {ambFiltres ? (
          <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-2 lg:grid-cols-6">
            <input
              type="search"
              autoFocus
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              // Dins del formulari d'una fitxa, Enter l'enviaria.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Nom, raó social, NIF o població"
              aria-label="Cerca clients"
              className="field-compacte text-[16px] sm:col-span-2 sm:text-[13px] lg:col-span-6"
            />
            <select
              value={filtres.tipus_client ?? ""}
              onChange={(e) => posaFiltre("tipus_client", e.target.value)}
              aria-label="Tipus de client"
              className="field-compacte"
            >
              <option value="">Tots els tipus</option>
              {(dades?.opcionsRelacio.tipus_client ?? []).map((opcio) => (
                <option key={opcio.id} value={opcio.id}>
                  {opcio.text}
                </option>
              ))}
            </select>
            <select
              value={filtres.agent ?? ""}
              onChange={(e) => posaFiltre("agent", e.target.value)}
              aria-label="Agent comercial"
              className="field-compacte"
            >
              <option value="">Tots els agents</option>
              {(dades?.opcionsRelacio.agents ?? []).map((opcio) => (
                <option key={opcio.id} value={opcio.id}>
                  {opcio.text}
                </option>
              ))}
            </select>
            <select value={filtres.estat ?? ""} onChange={(e) => posaFiltre("estat", e.target.value)} aria-label="Estat" className="field-compacte">
              <option value="">Tots els estats</option>
              {opcionsDe("estat").map(([valor, text]) => (
                <option key={valor} value={valor}>
                  {text}
                </option>
              ))}
            </select>
            <select
              value={filtres.categoria ?? ""}
              onChange={(e) => posaFiltre("categoria", e.target.value)}
              aria-label="Categoria"
              className="field-compacte"
            >
              <option value="">Totes les categories</option>
              {opcionsDe("categoria").map(([valor, text]) => (
                <option key={valor} value={valor}>
                  {text}
                </option>
              ))}
            </select>
            <select
              value={filtres.potencial ?? ""}
              onChange={(e) => posaFiltre("potencial", e.target.value)}
              aria-label="Potencial"
              className="field-compacte"
            >
              <option value="">Tots els potencials</option>
              {opcionsDe("potencial").map(([valor, text]) => (
                <option key={valor} value={valor}>
                  {text}
                </option>
              ))}
            </select>
            <select
              value={filtres.facturacio_tendencia ?? ""}
              onChange={(e) => posaFiltre("facturacio_tendencia", e.target.value)}
              aria-label="Tendència de facturació"
              className="field-compacte"
            >
              <option value="">Tota la facturació</option>
              {TENDENCIES.map(([valor, text]) => (
                <option key={valor} value={valor}>
                  {text}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={filtres.poblacio ?? ""}
              onChange={(e) => posaFiltre("poblacio", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Població"
              aria-label="Població"
              className="field-compacte"
            />
          </div>
          ) : null}

          {/* La segmentació, i els seus criteris per retocar. */}
          <div className="space-y-2 border-b border-line px-4 py-3">
            <label className="flex flex-wrap items-center gap-2 text-[12px] font-medium uppercase tracking-[0.04em] text-muted">
              Segmentació
              <select
                value={segment}
                onChange={(e) => triaSegment(e.target.value)}
                className="field-compacte min-w-0 flex-1 normal-case tracking-normal"
              >
                <option value="">Cap: tots els clients</option>
                {(dades?.segments ?? []).map((desat) => (
                  <option key={desat.id} value={desat.id}>
                    {desat.nom}
                  </option>
                ))}
                <option value={SENSE_SEGMENT}>Clients sense segment (automàtica)</option>
              </select>
            </label>

            {segment === SENSE_SEGMENT && ambFiltres ? (
              <p className="text-[12.5px] text-muted">Els clients que no encaixen en cap segment. No es pot retocar.</p>
            ) : segment || !ambFiltres ? (
              <div className="space-y-2 rounded-lg border border-line bg-white/60 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-muted">
                    {segment === SENSE_SEGMENT
                      ? "Els clients que no encaixen en cap segment. Pots afegir-hi criteris per acotar-los."
                      : segment
                        ? "Els canvis només valen per a aquesta cerca: el segment desat no es toca."
                        : "Afegeix criteris per acotar els clients. Sense cap criteri, hi són tots."}
                  </p>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as Mode)}
                    aria-label="Combinació dels criteris"
                    className="field-compacte !w-auto"
                  >
                    {MODES.map(([valor, text]) => (
                      <option key={valor} value={valor}>
                        {text}
                      </option>
                    ))}
                  </select>
                </div>
                <EditorCriteris criteris={criteris} alCanviar={setCriteris} opcionsRelacio={dades?.opcionsRelacio ?? {}} />
              </div>
            ) : null}
          </div>

          <div className="px-4 py-2">
            <div className="flex items-center justify-between gap-2 py-1 text-[12.5px] text-muted">
              <span role="status">
                {carregant
                  ? "Cercant…"
                  : resultat
                    ? `${resultat.total} ${resultat.total === 1 ? "client" : "clients"}` +
                      (resultat.total > resultat.files.length ? ` · se n'ensenyen ${resultat.files.length}, afina la cerca` : "")
                    : ""}
              </span>
              {multiple && resultat && resultat.files.length > 0 ? (
                <button type="button" onClick={triaTots} className="underline underline-offset-2 hover:text-ink">
                  Tria&apos;ls tots
                </button>
              ) : null}
            </div>

            {error ? (
              <p role="alert" className="py-3 text-[13px] text-wine-deep">
                {error}
              </p>
            ) : resultat && resultat.files.length === 0 && !carregant ? (
              <p className="py-3 text-[13px] text-muted">Cap client amb aquests filtres.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {(resultat?.files ?? []).map((client) => {
                  const triat = idsTriats.has(client.id);
                  return (
                    <li key={client.id}>
                      <button
                        type="button"
                        onClick={() => commuta(client)}
                        aria-pressed={multiple ? triat : undefined}
                        className={`flex w-full items-center gap-2.5 px-1.5 py-2 text-left transition-colors hover:bg-parchment/60 ${fonsDeTendencia(client.facturacio)} ${
                          triat ? "shadow-[inset_3px_0_0_0_#8c2f45]" : ""
                        }`}
                      >
                        {multiple ? (
                          <span
                            aria-hidden
                            className={`grid size-4 shrink-0 place-items-center rounded border text-[10px] leading-none ${
                              triat ? "border-wine bg-wine text-cream" : "border-line bg-white"
                            }`}
                          >
                            {triat ? "✓" : ""}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          {/* A dalt el nom i la població; a sota, com a la llista de clients, les lletres (categoria
                              i potencial), el tipus i la facturació. A partir de tauleta, a caselles fixes perquè
                              quedi en columna; al telèfon, seguit i sense barres. */}
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="min-w-0 truncate text-[13.5px] text-ink">{client.nom}</span>
                            {client.detall ? <span className="shrink-0 text-[12px] text-muted">{client.detall}</span> : null}
                          </span>
                          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
                            <span className="flex shrink-0 sm:w-14">
                              <Lletres categoria={client.categoria} potencial={client.potencial} />
                            </span>
                            <span className="flex min-w-0 shrink-0 sm:w-28">
                              <Pastilla text={client.tipusClient} etiqueta="Tipus de client" />
                            </span>
                            <span className="shrink-0 text-[12px] sm:hidden">
                              <MiniFacturacio dades={client.facturacio} compacte />
                            </span>
                            <span className="hidden w-44 shrink-0 text-[12.5px] sm:flex">
                              <MiniFacturacio dades={client.facturacio} />
                            </span>
                          </span>
                        </span>
                      </button>
                      {/* Fora del botó: llegir les notes no ha de triar el client. */}
                      {client.notes ? (
                        <Notes text={client.notes} className={`px-1.5 pb-2 ${multiple ? "pl-8" : ""} ${fonsDeTendencia(client.facturacio)}`} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {multiple ? (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
            <span className="text-[13px] text-muted">
              {triats.length} {triats.length === 1 ? "client triat" : "clients triats"}
            </span>
            <button type="button" onClick={alTancar} className="btn-compacte">
              Fet
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

/**
 * El camp de client de les fitxes: el que hi ha triat i el modal per triar-lo.
 *
 * Els triats viatgen com a camps ocults amb el mateix nom, un per client, i el
 * servidor en crea una fitxa per cadascun.
 */
export function SelectorClients({
  nom,
  multiple = false,
  triatsInicials,
  marcador = "Tria un client…",
  alCanviar,
  alCanviarQuants,
  alCanviarTriats,
}: {
  nom: string;
  multiple?: boolean;
  triatsInicials: Opcio[];
  marcador?: string;
  /** Per als camps que en governen d'altres: el contacte depèn del client, si n'hi ha un de sol. */
  alCanviar?: (id: string) => void;
  /** Quants n'hi ha de triats: amb algun, el lead d'una activitat queda desactivat. */
  alCanviarQuants?: (quants: number) => void;
  /** Els triats sencers, amb el nom: el configurador de vins de l'activitat els vol per dir què han tastat. */
  alCanviarTriats?: (triats: Opcio[]) => void;
}) {
  const [triats, setTriats] = useState<Opcio[]>(triatsInicials);
  const [obert, setObert] = useState(false);

  const avisa = useRef(alCanviar);
  avisa.current = alCanviar;
  const avisaQuants = useRef(alCanviarQuants);
  avisaQuants.current = alCanviarQuants;
  const avisaTriats = useRef(alCanviarTriats);
  avisaTriats.current = alCanviarTriats;

  function canvia(nous: Opcio[]) {
    setTriats(nous);
    avisa.current?.(nous.length === 1 ? nous[0].id : "");
    avisaQuants.current?.(nous.length);
    avisaTriats.current?.(nous);
  }

  // Si el camp deixa de ser múltiple (s'ha canviat el tipus d'activitat), es queda el primer.
  useEffect(() => {
    if (multiple || triats.length <= 1) return;
    setTriats(triats.slice(0, 1));
    avisa.current?.(triats[0].id);
    avisaQuants.current?.(1);
    avisaTriats.current?.(triats.slice(0, 1));
  }, [multiple, triats]);

  const Cerca = ICONES.cerca;

  return (
    <div>
      {triats.length === 0 ? (
        <input type="hidden" name={nom} value="" />
      ) : (
        triats.map((triat) => <input key={triat.id} type="hidden" name={nom} value={triat.id} />)
      )}

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setObert(true)} className="field-compacte flex min-w-0 items-center gap-2 text-left">
          {triats.length === 0 ? (
            <span className="min-w-0 flex-1 truncate text-muted">{marcador}</span>
          ) : triats.length === 1 ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-muted/50" />
              <span className="min-w-0 flex-1 truncate text-ink">{triats[0].text}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-ink">{triats.length} clients triats</span>
          )}
          <Cerca className="size-4 shrink-0 text-muted" />
        </button>
        {triats.length > 0 ? (
          <button
            type="button"
            aria-label={triats.length === 1 ? `Treu ${triats[0].text}` : "Treu els clients triats"}
            onClick={() => canvia([])}
            className="shrink-0 rounded px-2 py-1 text-[15px] leading-none text-muted transition-colors hover:bg-parchment hover:text-ink"
          >
            ×
          </button>
        ) : null}
      </div>

      {multiple && triats.length > 1 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {triats.map((triat) => (
            <li key={triat.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-parchment px-2 py-0.5 text-[12px] text-ink-soft">
              <span className="truncate">{triat.text}</span>
              <button
                type="button"
                aria-label={`Treu ${triat.text}`}
                onClick={() => canvia(triats.filter((x) => x.id !== triat.id))}
                className="shrink-0 leading-none text-muted hover:text-wine"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <ModalClients
        obert={obert}
        multiple={multiple}
        triats={triats}
        alCanviarTriats={canvia}
        alTancar={() => setObert(false)}
      />
    </div>
  );
}
