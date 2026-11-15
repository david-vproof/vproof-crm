"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { ClauFitxa } from "@/domini/crm-fitxes";

export type Opcio = { id: string; text: string };

export type Filtre = { camp: string; valor: string } | null;

/**
 * Desplegable de relació amb cerca al servidor.
 *
 * Es porten només les primeres opcions i, a partir de la segona lletra, es
 * consulta la base de dades. Així el camp aguanta igual amb quatre laboratoris que amb
 * quatre mil. La cerca passa per una ruta del portal: el navegador no parla
 * mai amb la base de dades.
 *
 * Amb `filtre`, el desplegable només ofereix el que pengi d'una altra fitxa
 * —els contactes d'aquest compte— i se n'assabenta quan aquella canvia: llavors
 * torna a demanar la llista i deixa anar el que hi havia triat, que ja no hi
 * pertany. Si el camp es filtra i encara no se sap per qui, no ofereix res:
 * ensenyar-ho tot seria pitjor que dir que falta triar el compte.
 */
export function TriaRelacio({
  nom,
  fitxa,
  opcions,
  valorInicial,
  marcador = "Cerca…",
  filtre = null,
  filtrada = false,
  senseFiltre = "Tria abans de qui és.",
  alCanviar,
}: {
  nom: string;
  fitxa: ClauFitxa;
  opcions: Opcio[];
  valorInicial: string | null;
  marcador?: string;
  filtre?: Filtre;
  /** Si el camp es filtra per un altre: sense filtre no ofereix res. */
  filtrada?: boolean;
  /** Què dir mentre no se sap de qui són. */
  senseFiltre?: string;
  /** Per als camps que en governen d'altres: el contacte depèn del compte. El text és el nom del que s'ha triat. */
  alCanviar?: (id: string, text: string) => void;
}) {
  const idLlista = useId();
  const triadaInicial = useMemo(
    () => opcions.find((opcio) => opcio.id === valorInicial) ?? null,
    [opcions, valorInicial],
  );

  const [triada, setTriada] = useState<Opcio | null>(triadaInicial);
  const [consulta, setConsulta] = useState("");
  // Les que s'ofereixen amb la caixa buida. De sortida, les que ha portat el
  // servidor, que ja les ha filtrades si calia.
  const [base, setBase] = useState<Opcio[]>(opcions);
  const [resultats, setResultats] = useState<Opcio[]>(opcions);
  const [obert, setObert] = useState(false);
  const [carregant, setCarregant] = useState(false);
  const [ressaltada, setRessaltada] = useState(0);
  const contenidor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  /** Amb què s'ha tocat la llista: amb el dit, en triar s'amaga el teclat. */
  const punter = useRef("");

  const clauFiltre = filtre ? `${filtre.camp}:${filtre.valor}` : "";
  const clauServida = useRef(clauFiltre);
  const bloquejada = filtrada && !filtre;

  /** El filtre, tal com viatja a la ruta de cerca. */
  const cua = filtre ? `&camp=${encodeURIComponent(filtre.camp)}&valor=${encodeURIComponent(filtre.valor)}` : "";

  // Canvi de qui mana: es torna a demanar la llista i es deixa anar el que hi
  // havia, que era d'un altre compte.
  useEffect(() => {
    if (clauFiltre === clauServida.current) return;
    clauServida.current = clauFiltre;
    setTriada(null);
    setConsulta("");
    setRessaltada(0);

    if (!filtre) {
      setBase([]);
      setResultats([]);
      return;
    }

    const aturador = new AbortController();
    setCarregant(true);
    fetch(`/api/crm/relacions?fitxa=${fitxa}&q=${cua}`, { signal: aturador.signal })
      .then((resposta) => resposta.json() as Promise<{ opcions?: Opcio[] }>)
      .then((cos) => {
        setBase(cos.opcions ?? []);
        setResultats(cos.opcions ?? []);
      })
      .catch(() => {
        // Xarxa caiguda: val més cap opció que les d'un altre compte.
        setBase([]);
        setResultats([]);
      })
      .finally(() => setCarregant(false));

    return () => aturador.abort();
  }, [clauFiltre, filtre, fitxa, cua]);

  // Es tanca quan es toca fora, no quan el camp perd el focus. Safari no dona
  // el focus a un botó en tocar-lo: el camp perdia el focus sense saber cap on,
  // la llista es tancava i desapareixia abans que hi arribés el toc, i al
  // telèfon no es podia triar cap lead. Com a `SelectorLaboratori`.
  useEffect(() => {
    if (!obert) return;
    const aFora = (e: PointerEvent) => {
      if (!contenidor.current?.contains(e.target as Node)) setObert(false);
    };
    document.addEventListener("pointerdown", aFora);
    return () => document.removeEventListener("pointerdown", aFora);
  }, [obert]);

  useEffect(() => {
    if (!obert || bloquejada) return;
    const terme = consulta.trim();
    if (terme === "") {
      setResultats(base);
      return;
    }

    const aturador = new AbortController();
    const temporitzador = setTimeout(async () => {
      setCarregant(true);
      try {
        const resposta = await fetch(
          `/api/crm/relacions?fitxa=${fitxa}&q=${encodeURIComponent(terme)}${cua}`,
          { signal: aturador.signal },
        );
        const cos = (await resposta.json()) as { opcions?: Opcio[] };
        setResultats(cos.opcions ?? []);
        setRessaltada(0);
      } catch {
        // Consulta cancel·lada o xarxa caiguda: es manté el que hi havia.
      } finally {
        setCarregant(false);
      }
    }, 220);

    return () => {
      clearTimeout(temporitzador);
      aturador.abort();
    };
  }, [consulta, obert, fitxa, base, cua, bloquejada]);

  function tria(opcio: Opcio | null) {
    setTriada(opcio);
    setConsulta("");
    setObert(false);
    alCanviar?.(opcio?.id ?? "", opcio?.text ?? "");
  }

  function alTeclat(esdeveniment: React.KeyboardEvent) {
    if (esdeveniment.key === "ArrowDown" || esdeveniment.key === "ArrowUp") {
      esdeveniment.preventDefault();
      setObert(true);
      setRessaltada((previ) => {
        const seguent = esdeveniment.key === "ArrowDown" ? previ + 1 : previ - 1;
        return Math.max(0, Math.min(resultats.length - 1, seguent));
      });
    } else if (esdeveniment.key === "Enter" && obert) {
      esdeveniment.preventDefault();
      if (resultats[ressaltada]) tria(resultats[ressaltada]);
    } else if (esdeveniment.key === "Escape") {
      setObert(false);
    }
  }

  return (
    <div
      ref={contenidor}
      className="relative"
      onBlur={(esdeveniment) => {
        // Amb el tabulador el focus sap on va: si és fora, es tanca. Si no se
        // sap on va (s'ha amagat el teclat, s'ha tocat la llista), es deixa
        // obert: qui la tanca és el toc de fora.
        const cap = esdeveniment.relatedTarget as Node | null;
        if (cap && !contenidor.current?.contains(cap)) setObert(false);
      }}
    >
      <input type="hidden" name={nom} value={triada?.id ?? ""} />

      <div className="flex items-center gap-1">
        <input
          ref={entrada}
          type="text"
          role="combobox"
          aria-expanded={obert}
          aria-controls={idLlista}
          aria-autocomplete="list"
          disabled={bloquejada}
          className="field-compacte disabled:bg-parchment/50 disabled:text-muted"
          placeholder={bloquejada ? "" : triada ? triada.text : marcador}
          value={obert ? consulta : (triada?.text ?? "")}
          onFocus={() => setObert(true)}
          // Un camp que ja té el focus no torna a rebre'l: el toc també l'obre.
          onClick={() => setObert(true)}
          onChange={(esdeveniment) => {
            setConsulta(esdeveniment.target.value);
            setObert(true);
          }}
          onKeyDown={alTeclat}
        />
        {triada ? (
          <button
            type="button"
            aria-label={`Treu ${triada.text}`}
            onClick={() => tria(null)}
            className="shrink-0 rounded px-2 py-1 text-[15px] leading-none text-muted transition-colors hover:bg-parchment hover:text-ink"
          >
            ×
          </button>
        ) : null}
      </div>

      {/* Només mentre falta: amb el compte posat, dir-ho seria soroll. */}
      {bloquejada ? <p className="mt-1 text-[12px] text-muted">{senseFiltre}</p> : null}

      {obert && !bloquejada ? (
        <ul
          id={idLlista}
          role="listbox"
          // Chrome deixa enfocar una caixa que es desplaça: aquesta no, el focus és del camp.
          tabIndex={-1}
          // El focus es queda al camp: així el clic arriba sempre a l'opció.
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            punter.current = e.pointerType;
          }}
          className="scroll-slim absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {carregant && resultats.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">Cercant…</li>
          ) : resultats.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-muted">
              {filtre ? "Aquest client no té cap contacte." : "Cap coincidència"}
            </li>
          ) : (
            resultats.map((opcio, i) => (
              <li key={opcio.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opcio.id === triada?.id}
                  // Es trien amb les fletxes: el tabulador surt del camp i no recorre la llista.
                  tabIndex={-1}
                  onMouseEnter={() => setRessaltada(i)}
                  onClick={() => {
                    tria(opcio);
                    // Triat amb el dit, el teclat ja no hi fa res i tapa el formulari.
                    if (punter.current === "touch") entrada.current?.blur();
                  }}
                  className={`block w-full truncate px-3 py-2 text-left text-[13.5px] transition-colors sm:py-1.5 ${
                    i === ressaltada ? "bg-parchment text-ink" : "text-ink-soft"
                  }`}
                >
                  {opcio.text}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
