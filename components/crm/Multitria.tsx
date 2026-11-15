"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Una opció: el valor que va a l'URL i el text que es llegeix. */
export type OpcioTria = [valor: string, text: string];

/** Per cercar sense majúscules ni accents: «vilafranca» troba «Vilafranca». */
function pla(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const CLASSE_CAMP = "field-compacte !py-1 !text-[12.5px] w-full min-w-0";

/**
 * Un filtre de columna amb més d'un valor possible: un botó que diu què hi ha
 * triat i, en obrir-lo, un cercador amb la llista d'opcions per marcar-ne les
 * que calgui. El que es tria va a un camp ocult del formulari de filtres, amb
 * els valors junts (`separador`), i el formulari s'envia en tancar-se el
 * desplegable si hi ha hagut canvis: no a cada marca, que faria recarregar la
 * llista a cada clic.
 *
 * A l'escriptori el desplegable surt fixat a la pantalla, a sota del botó,
 * perquè la fila de filtres és dins d'una capçalera enganxosa i una taula amb
 * poques files el tallaria. Al telèfon (`enLinia`) s'obre a lloc, dins del bloc
 * de filtres, i el cercador no agafa el focus tot sol: pujaria el teclat.
 */
export function Multitria({
  nom,
  etiqueta,
  opcions,
  valors,
  separador,
  buit = "Tots",
  enLinia = false,
  desactivat = false,
  compacte = false,
  titol,
}: {
  /** El nom del camp al formulari (`filtre.estat`). */
  nom: string;
  /** Per als lectors de pantalla i el cercador. */
  etiqueta: string;
  opcions: OpcioTria[];
  /** Els valors triats ara, tal com venen de l'URL. */
  valors: string[];
  separador: string;
  /** Què diu el botó quan no hi ha res triat. */
  buit?: string;
  enLinia?: boolean;
  /** Un altre filtre el deixa sense sentit: es veu, però no es pot obrir. */
  desactivat?: boolean;
  /** En una columna estreta (la categoria, el potencial): «2 ✓» en lloc de «2 triats». */
  compacte?: boolean;
  titol?: string;
}) {
  const id = useId();
  const [triats, setTriats] = useState<string[]>(valors);
  const [obert, setObert] = useState(false);
  const [cerca, setCerca] = useState("");
  const [lloc, setLloc] = useState<{ top: number; left: number; width: number } | null>(null);
  const contenidor = useRef<HTMLDivElement>(null);
  const boto = useRef<HTMLButtonElement>(null);
  const ocult = useRef<HTMLInputElement>(null);
  const cercador = useRef<HTMLInputElement>(null);

  const text = new Map(opcions);
  const resum =
    triats.length === 0
      ? buit
      : triats.length === 1
        ? (text.get(triats[0]) ?? triats[0])
        : compacte
          ? `${triats.length} ✓`
          : `${triats.length} triats`;
  const visibles = cerca ? opcions.filter(([valor, nomOpcio]) => pla(nomOpcio).includes(pla(cerca)) || pla(valor) === pla(cerca)) : opcions;

  function commuta(valor: string) {
    setTriats(triats.includes(valor) ? triats.filter((v) => v !== valor) : [...triats, valor]);
  }

  /**
   * Tanca i, si el que hi ha marcat no és el que hi havia, filtra. El valor es
   * posa al camp ocult a mà abans d'enviar: quan es treu tot, l'estat encara
   * no ha arribat al DOM.
   */
  function tanca(nous = triats) {
    setObert(false);
    setCerca("");
    if (nous.join(separador) === valors.join(separador) || !ocult.current) return;
    ocult.current.value = nous.join(separador);
    ocult.current.form?.requestSubmit();
  }

  function obre() {
    if (desactivat) return;
    if (!enLinia && boto.current) {
      // Sota el botó, tan ample com ell com a mínim, i sense sortir de la pantalla per la dreta.
      const caixa = boto.current.getBoundingClientRect();
      const width = Math.max(caixa.width, 240);
      setLloc({ top: caixa.bottom + 4, left: Math.max(8, Math.min(caixa.left, window.innerWidth - width - 8)), width });
    }
    setObert(true);
  }

  // Un toc a fora el tanca. Amb `pointerdown` i no amb el focus: Safari no
  // dona el focus als botons en tocar-los i el desplegable fugiria abans d'hora.
  useEffect(() => {
    if (!obert) return;
    const aFora = (e: PointerEvent) => {
      if (!contenidor.current?.contains(e.target as Node)) tanca();
    };
    const enRedimensionar = () => tanca();
    document.addEventListener("pointerdown", aFora);
    window.addEventListener("resize", enRedimensionar);
    return () => {
      document.removeEventListener("pointerdown", aFora);
      window.removeEventListener("resize", enRedimensionar);
    };
    // `tanca` canvia a cada render; només cal reenganxar-ho quan s'obre o es tanca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obert]);

  useEffect(() => {
    if (obert && !enLinia) cercador.current?.focus();
  }, [obert, enLinia]);

  const ambValor = triats.length > 0;

  const panell = (
    <div
      role="group"
      aria-label={etiqueta}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          tanca();
          boto.current?.focus();
        }
      }}
      style={!enLinia && lloc ? { position: "fixed", top: lloc.top, left: lloc.left, width: lloc.width } : undefined}
      className={`${enLinia ? "mt-1.5 w-full" : "z-30 shadow-lg"} rounded-lg border border-line bg-white p-2 text-left text-[12.5px] normal-case tracking-normal`}
    >
      <input
        ref={cercador}
        type="search"
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
        onKeyDown={(e) => {
          // Retorn tanca i filtra: no ha d'enviar el formulari amb el cercador com a camp.
          if (e.key === "Enter") {
            e.preventDefault();
            tanca();
          }
        }}
        placeholder="Cerca…"
        aria-label={`Cerca a ${etiqueta.toLowerCase()}`}
        autoComplete="off"
        className={CLASSE_CAMP}
      />
      <ul className="mt-1.5 max-h-56 overflow-y-auto" role="listbox" aria-multiselectable="true">
        {visibles.length === 0 ? <li className="px-1.5 py-1 text-muted">Cap opció coincideix.</li> : null}
        {visibles.map(([valor, nomOpcio]) => {
          const marcat = triats.includes(valor);
          return (
            <li key={valor} role="option" aria-selected={marcat}>
              <label className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-parchment ${marcat ? "text-ink" : "text-ink-soft"}`}>
                <input type="checkbox" checked={marcat} onChange={() => commuta(valor)} className="size-3.5 shrink-0 accent-marca" />
                <span className="min-w-0 flex-1 truncate">{nomOpcio}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line pt-1.5">
        <button
          type="button"
          onClick={() => {
            setTriats([]);
            tanca([]);
          }}
          disabled={!ambValor}
          className="text-muted underline-offset-2 hover:text-ink hover:underline disabled:cursor-default disabled:opacity-40 disabled:hover:no-underline"
        >
          Treu-ho tot
        </button>
        <button type="button" onClick={() => tanca()} className="btn-compacte !px-2.5 !py-1 !text-[12px]">
          {ambValor ? `Aplica (${triats.length})` : "Tanca"}
        </button>
      </div>
    </div>
  );

  return (
    <div ref={contenidor} className="min-w-0">
      {/* Controlat: un camp ocult no recorda el que se li escriu, React li tornaria a posar el valor inicial. */}
      <input ref={ocult} type="hidden" name={nom} value={triats.join(separador)} disabled={desactivat} />
      <button
        ref={boto}
        type="button"
        onClick={() => (obert ? tanca() : obre())}
        disabled={desactivat}
        title={titol}
        aria-label={etiqueta}
        aria-haspopup="listbox"
        aria-expanded={obert}
        aria-controls={obert ? id : undefined}
        className={`${CLASSE_CAMP} flex items-center justify-between gap-1 text-left normal-case tracking-normal disabled:cursor-not-allowed disabled:opacity-50 ${
          ambValor ? "!border-marca/50 bg-marca-clar/40 text-ink" : "text-ink-soft"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{resum}</span>
        <span className="shrink-0 text-[9px] text-muted" aria-hidden>
          ▼
        </span>
      </button>
      {obert ? <div id={id}>{panell}</div> : null}
    </div>
  );
}
