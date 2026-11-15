"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ICONES } from "@/components/Icones";
import { cercaPunts, type PuntCompte, type PuntDestacat } from "@/domini/crm-mapa";

type Lloc = { nom: string; latitud: number; longitud: number };

/** Com es diu un punt a la llista: l'establiment amb el client a sota, o el client sol. */
function titolDePunt(punt: PuntCompte) {
  return punt.establiment && punt.establiment !== punt.nom ? punt.establiment : punt.nom;
}

/**
 * La caixa de cerca del mapa: una de sola per a clients i adreces.
 *
 * Els clients es busquen al navegador mentre s'escriu, entre els punts que ja
 * hi ha al mapa (els que no estan situats no hi poden sortir), i respon a
 * l'instant. L'adreça va a OpenStreetMap pel servidor, i només quan es demana
 * (Enter o l'última fila), perquè Nominatim no admet una consulta per tecla.
 * Triar un resultat porta el mapa al punt i el marca; la creu treu la marca.
 */
export function CercaAlMapa({ punts, alDestacar }: { punts: PuntCompte[]; alDestacar: (destacat: PuntDestacat | null) => void }) {
  const [text, setText] = useState("");
  const [obert, setObert] = useState(false);
  const [llocs, setLlocs] = useState<Lloc[] | null>(null);
  const [cercant, setCercant] = useState(false);
  const [avis, setAvis] = useState("");
  const [triat, setTriat] = useState("");
  const tanda = useRef(0);
  const arrel = useRef<HTMLDivElement>(null);

  const coincidencies = useMemo(() => (llocs ? [] : cercaPunts(punts, text)), [punts, text, llocs]);
  const netejat = text.trim();

  // Tocar fora plega la llista.
  useEffect(() => {
    if (!obert) return;
    const fora = (e: PointerEvent) => {
      if (arrel.current && !arrel.current.contains(e.target as Node)) setObert(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [obert]);

  function destaca(destacat: Omit<PuntDestacat, "tanda">, etiqueta: string) {
    tanda.current += 1;
    alDestacar({ ...destacat, tanda: tanda.current });
    setTriat(etiqueta);
    setText(etiqueta);
    setObert(false);
    setLlocs(null);
    setAvis("");
  }

  function vesAlPunt(punt: PuntCompte) {
    destaca({ latitud: punt.latitud, longitud: punt.longitud, nom: titolDePunt(punt), mena: "client" }, titolDePunt(punt));
  }

  function vesAlLloc(lloc: Lloc) {
    destaca({ latitud: lloc.latitud, longitud: lloc.longitud, nom: lloc.nom, mena: "lloc" }, lloc.nom);
  }

  async function cercaAdreca() {
    if (!netejat || cercant) return;
    setCercant(true);
    setAvis("");
    try {
      const resposta = await fetch(`/api/geocodificacio?q=${encodeURIComponent(netejat)}`);
      const cos = (await resposta.json().catch(() => ({}))) as { llocs?: Lloc[]; error?: string };
      if (!resposta.ok) throw new Error(cos.error ?? "No s'ha pogut cercar.");
      const trobats = cos.llocs ?? [];
      if (trobats.length === 1) {
        vesAlLloc(trobats[0]);
      } else {
        setLlocs(trobats);
        setObert(true);
        if (trobats.length === 0) setAvis("OpenStreetMap no troba aquesta adreça. Prova amb el carrer i la població, o amb el codi postal.");
      }
    } catch (error) {
      setAvis((error as Error).message);
      setObert(true);
    } finally {
      setCercant(false);
    }
  }

  function neteja() {
    setText("");
    setTriat("");
    setLlocs(null);
    setAvis("");
    setObert(false);
    alDestacar(null);
  }

  const Cerca = ICONES.cerca;
  const llista = obert && netejat.length > 0 && text !== triat;
  const fila = "block w-full px-3 py-1.5 text-left text-[12.5px] transition hover:bg-parchment/60";

  return (
    <div ref={arrel} className="relative w-full sm:w-[280px]">
      <label className="relative block">
        <Cerca className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLlocs(null);
            setAvis("");
            setObert(true);
            if (!e.target.value.trim() && triat) neteja();
          }}
          onFocus={() => setObert(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setObert(false);
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Enter: al primer client que coincideix; si no n'hi ha cap, a l'adreça.
            if (coincidencies.length > 0) vesAlPunt(coincidencies[0]);
            else void cercaAdreca();
          }}
          placeholder="Client, adreça o població"
          aria-label="Cerca un client o una adreça al mapa"
          aria-expanded={llista}
          role="combobox"
          aria-controls="cerca-mapa-llista"
          autoComplete="off"
          // 16px al telèfon: amb menys, iOS Safari fa zoom en entrar-hi.
          className="field-compacte !rounded-full !py-1 !pl-8 !pr-8 !text-[16px] sm:!text-[12.5px]"
        />
        {text ? (
          <button
            type="button"
            onClick={neteja}
            aria-label="Treu la cerca"
            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-[15px] leading-none text-muted transition hover:bg-parchment hover:text-ink"
          >
            ×
          </button>
        ) : null}
      </label>

      {llista ? (
        <div
          id="cerca-mapa-llista"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[min(50vh,360px)] overflow-y-auto rounded-lg border border-line bg-white shadow-lg"
        >
          {coincidencies.length > 0 ? (
            <ul className="divide-y divide-line/60">
              {coincidencies.map((punt) => (
                <li key={punt.id} role="option" aria-selected={false}>
                  <button type="button" onClick={() => vesAlPunt(punt)} className={fila}>
                    <span className="block truncate text-ink">{titolDePunt(punt)}</span>
                    <span className="block truncate text-[11.5px] text-muted">
                      {[punt.establiment && punt.establiment !== punt.nom ? punt.nom : "", punt.adreca || punt.poblacio].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {llocs && llocs.length > 0 ? (
            <ul className="divide-y divide-line/60">
              {llocs.map((lloc) => (
                <li key={`${lloc.latitud},${lloc.longitud}`} role="option" aria-selected={false}>
                  <button type="button" onClick={() => vesAlLloc(lloc)} className={`${fila} text-ink-soft`}>
                    {lloc.nom}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {avis ? <p className="px-3 py-2 text-[12px] text-wine-deep">{avis}</p> : null}

          {/* L'adreça sempre es pot buscar, també quan hi ha clients que coincideixen: potser no es busca cap client. */}
          {!llocs ? (
            <button
              type="button"
              onClick={() => void cercaAdreca()}
              disabled={cercant}
              className={`${fila} border-t border-line text-wine disabled:opacity-60 ${coincidencies.length === 0 ? "" : "text-[12px]"}`}
            >
              {cercant ? "Cercant a OpenStreetMap…" : `Cerca «${netejat}» com a adreça`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
