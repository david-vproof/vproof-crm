"use client";

import { useEffect, useState } from "react";

import { BotoFullaVins } from "@/components/crm/BotoFullaVins";
import { ModalConfiguradorVins } from "@/components/crm/ModalConfiguradorVins";
import { FotoArticle } from "@/components/FotoArticle";
import { ICONES } from "@/components/Icones";
import type { ClientOLead } from "@/domini/cistella-vins";
import type { Preus } from "@/domini/preus-vins";
import { eurosAmbCentims } from "@/lib/format";

/** Un vi del catàleg, tal com el porta la cerca i tal com es desa la tria. */
export type ViTriable = { id: string; text: string; detall?: string; foto?: string | null };

type Trobat = { id: string; nom: string; detall: string; foto: string | null };

const aTriable = (vi: Trobat): ViTriable => ({ id: vi.id, text: vi.nom, detall: vi.detall, foto: vi.foto });

/**
 * El modal de cerca de vins: els articles actius del catàleg. S'hi en marquen
 * tants com calgui i es tanca amb «Fet». Es queda muntat encara que estigui
 * tancat, però la cerca es buida en tancar-lo: en tornar-lo a obrir surt el
 * catàleg sencer, no el filtre de l'última tria.
 */
function ModalVins({
  obert,
  triats,
  preus,
  alCanviar,
  alTancar,
}: {
  obert: boolean;
  triats: ViTriable[];
  /** El preu de cada vi, si ja ha arribat de FactuSol. */
  preus: Preus | null;
  alCanviar: (triats: ViTriable[]) => void;
  alTancar: () => void;
}) {
  const [cerca, setCerca] = useState("");
  const [resultat, setResultat] = useState<{ files: Trobat[]; total: number } | null>(null);
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
          const resposta = await fetch(`/api/crm/vins?q=${encodeURIComponent(cerca.trim())}`, { signal: aturador.signal });
          const cos = (await resposta.json()) as { files?: Trobat[]; total?: number; error?: string };
          if (!resposta.ok) throw new Error(cos.error ?? "No s'ha pogut cercar.");
          setResultat({ files: cos.files ?? [], total: cos.total ?? 0 });
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

  const idsTriats = new Set(triats.map((vi) => vi.id));
  const commuta = (vi: Trobat) =>
    alCanviar(idsTriats.has(vi.id) ? triats.filter((triat) => triat.id !== vi.id) : [...triats, aTriable(vi)]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tria els vins"
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/35 sm:items-center sm:p-6"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          tanca();
        }
      }}
    >
      <div className="flex max-h-full w-full max-w-[640px] flex-col overflow-hidden bg-cream shadow-2xl sm:rounded-xl sm:border sm:border-line">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-[20px] leading-tight">Tria els vins</h2>
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
            placeholder="Vi, celler, família o codi"
            aria-label="Cerca vins"
            className="field-compacte text-[16px] sm:text-[13px]"
          />
        </div>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <p role="status" className="py-1 text-[12.5px] text-muted">
            {carregant
              ? "Cercant…"
              : resultat
                ? `${resultat.total} ${resultat.total === 1 ? "vi" : "vins"}` +
                  (resultat.total > resultat.files.length ? ` · se n'ensenyen ${resultat.files.length}, afina la cerca` : "")
                : ""}
          </p>

          {error ? (
            <p role="alert" className="py-3 text-[13px] text-wine-deep">
              {error}
            </p>
          ) : resultat && resultat.files.length === 0 && !carregant ? (
            <p className="py-3 text-[13px] text-muted">
              {cerca.trim() ? "Cap vi amb aquesta cerca." : "El catàleg d'articles encara és buit: arriba amb la sincronització de FactuSol."}
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {(resultat?.files ?? []).map((vi) => {
                const triat = idsTriats.has(vi.id);
                return (
                  <li key={vi.id}>
                    <button
                      type="button"
                      onClick={() => commuta(vi)}
                      aria-pressed={triat}
                      className={`flex w-full items-center gap-2.5 px-1.5 py-2 text-left transition-colors hover:bg-parchment/60 ${
                        triat ? "shadow-[inset_3px_0_0_0_#8c2f45]" : ""
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid size-4 shrink-0 place-items-center rounded border text-[10px] leading-none ${
                          triat ? "border-wine bg-wine text-cream" : "border-line bg-white"
                        }`}
                      >
                        {triat ? "✓" : ""}
                      </span>
                      <FotoArticle petita={vi.foto} gran={null} nom={vi.nom} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-ink [overflow-wrap:anywhere]">{vi.nom}</span>
                        {vi.detall ? (
                          <span className="mt-0.5 block text-[12px] text-muted [overflow-wrap:anywhere]">{vi.detall}</span>
                        ) : null}
                      </span>
                      <Preu preus={preus} id={vi.id} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="text-[13px] text-muted">
            {triats.length} {triats.length === 1 ? "vi triat" : "vins triats"}
          </span>
          <button type="button" onClick={tanca} className="btn-compacte">
            Fet
          </button>
        </footer>
      </div>
    </div>
  );
}

/** El preu d'un vi a la tarifa de venda al major, sense IVA. Res mentre els preus no han arribat o el vi no és a la tarifa. */
function Preu({ preus, id }: { preus: Preus | null; id: string }) {
  const preu = preus?.[id];
  if (preu === undefined) return null;
  return <span className="shrink-0 text-[12.5px] tabular-nums text-ink">{eurosAmbCentims(preu)}</span>;
}

/**
 * El camp de vins d'una activitat: els que s'hi han presentat o tastat, triats
 * del catàleg d'articles. Els triats viatgen com a camps ocults amb el mateix
 * nom, un per vi, i el servidor els desa a part.
 */
export function SelectorVins({
  nom,
  triatsInicials,
  activitat = null,
  clients = [],
}: {
  nom: string;
  triatsInicials: ViTriable[];
  /** L'activitat ja desada, si n'és una: amb vins triats, se'n pot treure la fulla en PDF. */
  activitat?: string | null;
  /** El client (o clients) o el lead de l'activitat: el configurador s'obre amb ells posats. */
  clients?: ClientOLead[];
}) {
  const [triats, setTriats] = useState<ViTriable[]>(triatsInicials);
  const [obert, setObert] = useState(false);
  // El preu de venda al major de cada vi, en viu de FactuSol: si no arriba, el selector va igual, sense preus.
  const [preus, setPreus] = useState<Preus | null>(null);
  const Cerca = ICONES.cerca;

  useEffect(() => {
    let viu = true;
    fetch("/api/crm/preus-vins", { cache: "no-store" })
      .then(async (resposta) => (resposta.ok ? ((await resposta.json()) as { preus: Preus }).preus : null))
      .then((llegits) => viu && llegits && setPreus(llegits))
      .catch(() => undefined);
    return () => {
      viu = false;
    };
  }, []);

  return (
    <div>
      {triats.length === 0 ? (
        <input type="hidden" name={nom} value="" />
      ) : (
        triats.map((vi) => <input key={vi.id} type="hidden" name={nom} value={vi.id} />)
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setObert(true)} className="field-compacte flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`min-w-0 flex-1 truncate ${triats.length === 0 ? "text-muted" : "text-ink"}`}>
            {triats.length === 0
              ? "Tria els vins…"
              : `${triats.length} ${triats.length === 1 ? "vi triat" : "vins triats"} · afegeix-ne o treu-ne`}
          </span>
          <Cerca className="size-4 shrink-0 text-muted" />
        </button>
        {/* El configurador: la mateixa cistella per criteris de la pàgina «Selector de vins», que torna els vins aquí. */}
        <ModalConfiguradorVins
          inicials={triats.map((vi) => vi.id)}
          clients={clients}
          alAplicar={(vins) => setTriats(vins.map((vi) => ({ id: vi.id, text: vi.nom, detall: vi.detall, foto: vi.foto })))}
        />
      </div>

      {triats.length > 0 ? (
        <ul className="mt-1.5 divide-y divide-line/60 rounded-lg border border-line bg-white">
          {triats.map((vi) => (
            <li key={vi.id} className="flex items-center gap-2.5 px-2.5 py-1.5">
              <FotoArticle petita={vi.foto ?? null} gran={null} nom={vi.text} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-ink [overflow-wrap:anywhere]">{vi.text}</span>
                {vi.detall ? <span className="block text-[11.5px] text-muted [overflow-wrap:anywhere]">{vi.detall}</span> : null}
              </span>
              <Preu preus={preus} id={vi.id} />
              <button
                type="button"
                aria-label={`Treu ${vi.text}`}
                onClick={() => setTriats(triats.filter((altre) => altre.id !== vi.id))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-[16px] leading-none text-muted transition hover:bg-parchment hover:text-wine"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <BotoFullaVins activitat={activitat} vins={triats.map((vi) => vi.id)} />

      <ModalVins obert={obert} triats={triats} preus={preus} alCanviar={setTriats} alTancar={() => setObert(false)} />
    </div>
  );
}
