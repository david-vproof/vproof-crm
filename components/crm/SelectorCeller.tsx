"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ICONES } from "@/components/Icones";

export type CellerTrobat = {
  id: string;
  nom_comercial: string | null;
  rao_social: string | null;
  nif: string | null;
  tipus: string | null;
  poblacio: string | null;
  provincia: string | null;
  pais: string | null;
  codi_erp: number | null;
};

type Provincia = { valor: string; quants: number };

function nomDe(celler: CellerTrobat) {
  return celler.nom_comercial || celler.rao_social || `Celler ${celler.codi_erp ?? ""}`.trim();
}

/** La segona línia de cada fila: el que distingeix dos cellers que es diuen igual. */
function detallDe(celler: CellerTrobat) {
  return [
    [celler.poblacio, celler.provincia].filter(Boolean).join(", "),
    celler.pais && celler.pais !== "Espanya" ? celler.pais : null,
    celler.nif,
    celler.codi_erp ? `#${celler.codi_erp}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Selector de celler amb cerca per diverses variables.
 *
 * Els cellers són els proveïdors de l'ERP i n'hi ha centenars, així que el
 * camp no ofereix cap llista: es cerca. D'un celler te'n pot venir al cap el
 * nom, el poble, la província o el número que té a FactuSol, i per això la
 * caixa els prova tots alhora, amb dos filtres per escurçar.
 *
 * Va en un desplegable ancorat al camp i no en una finestra que tapi la
 * pantalla: s'obre dins del panell de la fitxa, que ja és una capa, i una
 * segona capa a sobre feia que tot semblés que s'obria de nou.
 */
export function SelectorCeller({
  nom,
  valorInicial,
  textInicial,
  marcador = "Tria un celler…",
  multiple = false,
}: {
  nom: string;
  valorInicial: string | null;
  /** El nom del que ja hi ha triat, perquè es vegi sense haver de cercar-lo. */
  textInicial?: string;
  marcador?: string;
  /**
   * Se'n poden triar diversos: a una visita de cellers a client, el servidor en
   * fa una activitat per celler. Els triats viatgen com a camps ocults amb el
   * mateix nom, un per celler.
   */
  multiple?: boolean;
}) {
  const idLlista = useId();
  const [triats, setTriats] = useState<{ id: string; text: string }[]>(
    valorInicial ? [{ id: valorInicial, text: textInicial || "Celler triat" }] : [],
  );
  const triat = triats[0] ?? null;
  const [obert, setObert] = useState(false);
  // Cap amunt quan el camp queda tan avall que el desplegable sortiria de la pantalla.
  const [amunt, setAmunt] = useState(false);

  const [consulta, setConsulta] = useState("");
  const [provincia, setProvincia] = useState("");
  const [provincies, setProvincies] = useState<Provincia[]>([]);
  const [files, setFiles] = useState<CellerTrobat[]>([]);
  const [total, setTotal] = useState(0);
  const [carregant, setCarregant] = useState(false);
  const [error, setError] = useState("");
  const [ressaltada, setRessaltada] = useState(0);

  const contenidor = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLInputElement>(null);
  const desplegable = useRef<HTMLDivElement>(null);
  // Les províncies es demanen un sol cop, amb la primera cerca.
  const teProvincies = useRef(false);

  const cerca = useCallback(
    async (senyal: AbortSignal) => {
      const params = new URLSearchParams();
      if (consulta.trim()) params.set("q", consulta.trim());
      // Només cellers: els creditors de serveis (transport, telefonia, gestories)
      // no tenen res a veure amb una visita.
      params.set("tipus", "proveidor");
      if (provincia) params.set("provincia", provincia);
      if (!teProvincies.current) params.set("provincies", "1");

      setCarregant(true);
      try {
        const resposta = await fetch(`/api/crm/cellers?${params}`, { signal: senyal });
        const cos = (await resposta.json()) as {
          files?: CellerTrobat[];
          total?: number;
          provincies?: Provincia[];
          error?: string;
        };
        // Si mentrestant s'ha escrit una altra lletra, aquesta resposta ja no
        // val: la que mana és la de la consulta nova.
        if (senyal.aborted) return;
        if (cos.error) {
          setError(cos.error);
          return;
        }
        setError("");
        setFiles(cos.files ?? []);
        setTotal(cos.total ?? 0);
        setRessaltada(0);
        if (cos.provincies) {
          setProvincies(cos.provincies);
          teProvincies.current = true;
        }
      } catch (fallada) {
        // Anul·lar una petició a mig llegir no sempre arriba com a AbortError
        // —el Chrome hi respon amb un TypeError—, i això feia sortir «no s'ha
        // pogut cercar» només per haver escrit de pressa.
        if (senyal.aborted || (fallada as Error).name === "AbortError") return;
        setError("No s'ha pogut cercar.");
      } finally {
        if (!senyal.aborted) setCarregant(false);
      }
    },
    [consulta, provincia],
  );

  // Es tanca quan es toca fora. Abans es feia amb onBlur, però en alguns
  // navegadors un botó no rep el focus en clicar-lo: el desplegable es tancava
  // amb el blur i desapareixia abans que hi arribés el clic, i per això no es
  // podia triar res.
  useEffect(() => {
    if (!obert) return;
    const aFora = (e: PointerEvent) => {
      if (!contenidor.current?.contains(e.target as Node)) setObert(false);
    };
    document.addEventListener("pointerdown", aFora);
    return () => document.removeEventListener("pointerdown", aFora);
  }, [obert]);

  // Si el camp deixa de ser múltiple (s'ha canviat el tipus d'activitat), es queda el primer.
  useEffect(() => {
    if (multiple) return;
    setTriats((previs) => (previs.length > 1 ? previs.slice(0, 1) : previs));
  }, [multiple]);

  useEffect(() => {
    if (!obert) return;
    const aturador = new AbortController();
    const temporitzador = setTimeout(() => cerca(aturador.signal), consulta ? 220 : 0);
    return () => {
      clearTimeout(temporitzador);
      aturador.abort();
    };
  }, [obert, cerca, consulta]);

  /** L'alçada que ocupa desplegat: caixa de cerca, filtres, llista i peu. */
  const ALCADA = 300;

  function obre() {
    const lloc = contenidor.current?.getBoundingClientRect();
    // Si a sota no hi cap i a dalt sí, s'obre cap amunt. Així no cal que el
    // panell es desplaci sol sota els dits de qui hi escriu.
    const sota = lloc ? window.innerHeight - lloc.bottom : ALCADA;
    setAmunt(Boolean(lloc && sota < ALCADA && lloc.top > sota));
    setObert(true);
    setTimeout(() => caixa.current?.focus(), 0);
  }

  /** D'un en un es tanca en triar; de diversos, el desplegable es queda obert i el clic commuta. */
  function tria(celler: CellerTrobat) {
    if (!multiple) {
      setTriats([{ id: celler.id, text: nomDe(celler) }]);
      setObert(false);
      setConsulta("");
      return;
    }
    setTriats((previs) =>
      previs.some((altre) => altre.id === celler.id)
        ? previs.filter((altre) => altre.id !== celler.id)
        : [...previs, { id: celler.id, text: nomDe(celler) }],
    );
  }

  function alTeclat(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setRessaltada((previ) => {
        const seguent = e.key === "ArrowDown" ? previ + 1 : previ - 1;
        return Math.max(0, Math.min(files.length - 1, seguent));
      });
    } else if (e.key === "Enter") {
      // Dins d'un formulari, Enter enviaria la fitxa: aquí tria la fila.
      e.preventDefault();
      if (files[ressaltada]) tria(files[ressaltada]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setObert(false);
    }
  }

  const Cerca = ICONES.cerca;

  return (
    <div ref={contenidor} className="relative">
      {triats.length === 0 ? (
        <input type="hidden" name={nom} value="" />
      ) : (
        triats.map((cadascun) => <input key={cadascun.id} type="hidden" name={nom} value={cadascun.id} />)
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => (obert ? setObert(false) : obre())}
          aria-expanded={obert}
          aria-controls={idLlista}
          className="field-compacte flex min-w-0 items-center gap-2 text-left"
        >
          {triats.length === 0 ? (
            <span className="min-w-0 flex-1 truncate text-muted">{marcador}</span>
          ) : triats.length === 1 ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-muted/50" />
              <span className="min-w-0 flex-1 truncate text-ink">{triat!.text}</span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-ink">{triats.length} cellers triats</span>
          )}
          <Cerca className="size-4 shrink-0 text-muted" />
        </button>

        {triats.length > 0 ? (
          <button
            type="button"
            aria-label={triats.length === 1 ? `Treu ${triat!.text}` : "Treu els cellers triats"}
            onClick={() => setTriats([])}
            className="shrink-0 rounded px-2 py-1 text-[15px] leading-none text-muted transition-colors hover:bg-parchment hover:text-ink"
          >
            ×
          </button>
        ) : null}
      </div>

      {multiple && triats.length > 1 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {triats.map((cadascun) => (
            <li key={cadascun.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-parchment px-2 py-0.5 text-[12px] text-ink-soft">
              <span className="truncate">{cadascun.text}</span>
              <button
                type="button"
                aria-label={`Treu ${cadascun.text}`}
                onClick={() => setTriats((previs) => previs.filter((altre) => altre.id !== cadascun.id))}
                className="shrink-0 leading-none text-muted hover:text-wine"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {obert ? (
        <div
          ref={desplegable}
          id={idLlista}
          // Ample del camp, i mai més ample que la pantalla: al telèfon el
          // formulari va a una columna i el desplegable hi cap just.
          className={`absolute left-0 right-0 z-30 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-white shadow-xl ${
            amunt ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="border-b border-line p-1.5">
            <input
              ref={caixa}
              type="text"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onKeyDown={alTeclat}
              placeholder="Nom, NIF, població o codi"
              aria-label="Cerca cellers"
              // 16px al telèfon: amb menys, iOS fa zoom en enfocar el camp.
              className="field-compacte py-1 text-[16px] sm:text-[13px]"
            />

            {provincies.length > 0 ? (
              <select
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                aria-label="Província"
                className="field-compacte mt-1.5 px-2 py-1 text-[12px]"
              >
                <option value="">Totes les províncies</option>
                {provincies.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.valor} ({p.quants})
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <ul role="listbox" aria-label="Cellers trobats" className="scroll-slim max-h-[184px] overflow-y-auto py-0.5">
            {error ? (
              <li className="px-3 py-3 text-[12.5px] text-wine-deep">{error}</li>
            ) : carregant && files.length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-muted">Cercant…</li>
            ) : files.length === 0 ? (
              <li className="px-3 py-3 text-[12.5px] text-muted">Cap celler amb aquests criteris.</li>
            ) : (
              files.map((celler, i) => (
                <li key={celler.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={triats.some((altre) => altre.id === celler.id)}
                    onMouseEnter={() => setRessaltada(i)}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => tria(celler)}
                    className={`block w-full px-3 py-1.5 text-left transition-colors ${
                      i === ressaltada ? "bg-parchment" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {multiple ? (
                        <span className={`shrink-0 text-[11px] ${triats.some((altre) => altre.id === celler.id) ? "text-wine" : "text-line"}`} aria-hidden>
                          ✓
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{nomDe(celler)}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-muted">{detallDe(celler) || "Sense més dades"}</span>
                  </button>
                </li>
              ))
            )}
          </ul>

          {total > files.length ? (
            <p className="border-t border-line px-3 py-1 text-[11px] text-muted">
              {files.length} de {total} · afina la cerca
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
