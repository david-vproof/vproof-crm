"use client";

import { useEffect, useState } from "react";

import { BotoFullaProductes } from "@/components/crm/BotoFullaProductes";
import { ModalConfiguradorProductes } from "@/components/crm/ModalConfiguradorProductes";
import { FotoArticle } from "@/components/FotoArticle";
import { ICONES } from "@/components/Icones";
import type { ClientOLead } from "@/domini/cistella-productes";
import type { Preus } from "@/domini/preus-productes";
import { eurosAmbCentims } from "@/lib/format";

/** Un producte del catàleg, tal com el porta la cerca i tal com es desa la tria. */
export type ProducteTriable = { id: string; text: string; detall?: string; foto?: string | null };

type Trobat = { id: string; nom: string; detall: string; foto: string | null };

const aTriable = (producte: Trobat): ProducteTriable => ({ id: producte.id, text: producte.nom, detall: producte.detall, foto: producte.foto });

/**
 * El modal de cerca de productes: els articles actius del catàleg. S'hi en marquen
 * tants com calgui i es tanca amb «Fet». Es queda muntat encara que estigui
 * tancat, però la cerca es buida en tancar-lo: en tornar-lo a obrir surt el
 * catàleg sencer, no el filtre de l'última tria.
 */
function ModalProductes({
  obert,
  triats,
  preus,
  alCanviar,
  alTancar,
}: {
  obert: boolean;
  triats: ProducteTriable[];
  /** El preu de cada producte, si ja ha arribat de l'ERP. */
  preus: Preus | null;
  alCanviar: (triats: ProducteTriable[]) => void;
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
          const resposta = await fetch(`/api/crm/productes?q=${encodeURIComponent(cerca.trim())}`, { signal: aturador.signal });
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

  const idsTriats = new Set(triats.map((producte) => producte.id));
  const commuta = (producte: Trobat) =>
    alCanviar(idsTriats.has(producte.id) ? triats.filter((triat) => triat.id !== producte.id) : [...triats, aTriable(producte)]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tria els productes"
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
          <h2 className="font-display text-[20px] leading-tight">Tria els productes</h2>
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
            placeholder="Producte, laboratori, família o codi"
            aria-label="Cerca productes"
            className="field-compacte text-[16px] sm:text-[13px]"
          />
        </div>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <p role="status" className="py-1 text-[12.5px] text-muted">
            {carregant
              ? "Cercant…"
              : resultat
                ? `${resultat.total} ${resultat.total === 1 ? "producte" : "productes"}` +
                  (resultat.total > resultat.files.length ? ` · se n'ensenyen ${resultat.files.length}, afina la cerca` : "")
                : ""}
          </p>

          {error ? (
            <p role="alert" className="py-3 text-[13px] text-marca-fosc">
              {error}
            </p>
          ) : resultat && resultat.files.length === 0 && !carregant ? (
            <p className="py-3 text-[13px] text-muted">
              {cerca.trim() ? "Cap producte amb aquesta cerca." : "El catàleg d'articles encara és buit: arriba amb la sincronització de l'ERP."}
            </p>
          ) : (
            <ul className="divide-y divide-line/70">
              {(resultat?.files ?? []).map((producte) => {
                const triat = idsTriats.has(producte.id);
                return (
                  <li key={producte.id}>
                    <button
                      type="button"
                      onClick={() => commuta(producte)}
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
                      <FotoArticle petita={producte.foto} gran={null} nom={producte.nom} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-ink [overflow-wrap:anywhere]">{producte.nom}</span>
                        {producte.detall ? (
                          <span className="mt-0.5 block text-[12px] text-muted [overflow-wrap:anywhere]">{producte.detall}</span>
                        ) : null}
                      </span>
                      <Preu preus={preus} id={producte.id} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="text-[13px] text-muted">
            {triats.length} {triats.length === 1 ? "producte triat" : "productes triats"}
          </span>
          <button type="button" onClick={tanca} className="btn-compacte">
            Fet
          </button>
        </footer>
      </div>
    </div>
  );
}

/** El preu d'un producte a la tarifa de venda al major, sense IVA. Res mentre els preus no han arribat o el producte no és a la tarifa. */
function Preu({ preus, id }: { preus: Preus | null; id: string }) {
  const preu = preus?.[id];
  if (preu === undefined) return null;
  return <span className="shrink-0 text-[12.5px] tabular-nums text-ink">{eurosAmbCentims(preu)}</span>;
}

/**
 * El camp de productes d'una activitat: els que s'hi han presentat, triats
 * del catàleg d'articles. Els triats viatgen com a camps ocults amb el mateix
 * nom, un per producte, i el servidor els desa a part.
 */
export function SelectorProductes({
  nom,
  triatsInicials,
  activitat = null,
  clients = [],
}: {
  nom: string;
  triatsInicials: ProducteTriable[];
  /** L'activitat ja desada, si n'és una: amb productes triats, se'n pot treure la fulla en PDF. */
  activitat?: string | null;
  /** El client (o clients) o el lead de l'activitat: el configurador s'obre amb ells posats. */
  clients?: ClientOLead[];
}) {
  const [triats, setTriats] = useState<ProducteTriable[]>(triatsInicials);
  const [obert, setObert] = useState(false);
  // El preu de venda al major de cada producte, en viu de l'ERP: si no arriba, el selector va igual, sense preus.
  const [preus, setPreus] = useState<Preus | null>(null);
  const Cerca = ICONES.cerca;

  useEffect(() => {
    let viu = true;
    fetch("/api/crm/preus-productes", { cache: "no-store" })
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
        triats.map((producte) => <input key={producte.id} type="hidden" name={nom} value={producte.id} />)
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setObert(true)} className="field-compacte flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className={`min-w-0 flex-1 truncate ${triats.length === 0 ? "text-muted" : "text-ink"}`}>
            {triats.length === 0
              ? "Tria els productes…"
              : `${triats.length} ${triats.length === 1 ? "producte triat" : "productes triats"} · afegeix-ne o treu-ne`}
          </span>
          <Cerca className="size-4 shrink-0 text-muted" />
        </button>
        {/* El configurador: la mateixa cistella per criteris de la pàgina «Selector de productes», que torna els productes aquí. */}
        <ModalConfiguradorProductes
          inicials={triats.map((producte) => producte.id)}
          clients={clients}
          alAplicar={(productes) => setTriats(productes.map((producte) => ({ id: producte.id, text: producte.nom, detall: producte.detall, foto: producte.foto })))}
        />
      </div>

      {triats.length > 0 ? (
        <ul className="mt-1.5 divide-y divide-line/60 rounded-lg border border-line bg-white">
          {triats.map((producte) => (
            <li key={producte.id} className="flex items-center gap-2.5 px-2.5 py-1.5">
              <FotoArticle petita={producte.foto ?? null} gran={null} nom={producte.text} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-ink [overflow-wrap:anywhere]">{producte.text}</span>
                {producte.detall ? <span className="block text-[11.5px] text-muted [overflow-wrap:anywhere]">{producte.detall}</span> : null}
              </span>
              <Preu preus={preus} id={producte.id} />
              <button
                type="button"
                aria-label={`Treu ${producte.text}`}
                onClick={() => setTriats(triats.filter((altre) => altre.id !== producte.id))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-[16px] leading-none text-muted transition hover:bg-parchment hover:text-marca"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <BotoFullaProductes activitat={activitat} productes={triats.map((producte) => producte.id)} />

      <ModalProductes obert={obert} triats={triats} preus={preus} alCanviar={setTriats} alTancar={() => setObert(false)} />
    </div>
  );
}
