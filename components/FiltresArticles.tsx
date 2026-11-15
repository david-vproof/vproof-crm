"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ICONES } from "@/components/Icones";
import { CARACTERISTIQUES, clauDeValor, quantsFiltres, type FiltresArticles as Filtres, type Opcio } from "@/domini/cataleg-articles";

/**
 * Els filtres de la pantalla d'articles: la cerca, un desplegable per
 * característica i «només amb foto». Cada canvi s'aplica de seguida i va a
 * l'adreça, així que un filtre es pot enviar o guardar com qualsevol enllaç.
 * Cada opció diu quants productes hi quedarien.
 *
 * Al telèfon els desplegables es pleguen darrere d'un botó: vuit desplegables
 * apilats empenyerien la llista fora de la pantalla.
 */
export function FiltresArticles({ filtres, opcions }: { filtres: Filtres; opcions: Record<string, Opcio[]> }) {
  const router = useRouter();
  const [carregant, startTransition] = useTransition();
  const [oberts, setOberts] = useState(false);
  const posats = quantsFiltres(filtres);
  const Cerca = ICONES.cerca;

  /** Porta a l'adreça amb els filtres d'ara i els canvis. Un filtre nou torna a la primera pàgina i tanca l'article. */
  function navega(canvis: Record<string, string>) {
    const parametres = new URLSearchParams();
    const tots: Record<string, string> = {
      q: filtres.cerca,
      ...filtres.tria,
      foto: filtres.ambFoto ? "1" : "",
      historics: filtres.ambHistorics ? "1" : "",
      ordre: filtres.ordre,
      ...canvis,
    };
    for (const [clau, valor] of Object.entries(tots)) if (valor) parametres.set(clau, valor);
    const consulta = parametres.toString();
    startTransition(() => router.push(consulta ? `/productes?${consulta}` : "/productes", { scroll: false }));
  }

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-0 flex-1 sm:max-w-[360px]"
          onSubmit={(e) => {
            e.preventDefault();
            navega({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() });
          }}
        >
          <Cerca className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-muted" />
          {/* La clau el refà quan la cerca canvia per un altre camí (treure els filtres). */}
          <input
            key={filtres.cerca}
            type="search"
            name="q"
            defaultValue={filtres.cerca}
            placeholder="Cerca per nom, principi actiu, espècie…"
            aria-label="Cerca articles"
            className="field w-full !py-2 pl-9"
          />
        </form>

        <button
          type="button"
          onClick={() => setOberts((ara) => !ara)}
          aria-expanded={oberts}
          aria-controls="filtres-articles"
          className="btn-compacte md:hidden"
        >
          Filtres{posats ? ` · ${posats}` : ""}
        </button>

        {posats || filtres.cerca ? (
          <button type="button" onClick={() => navega(Object.fromEntries([["q", ""], ["foto", ""], ["historics", ""], ...CARACTERISTIQUES.map((c) => [c.clau, ""])]))} className="text-[13px] text-muted transition hover:text-ink">
            Treu els filtres
          </button>
        ) : null}

        {carregant ? <span className="text-[12.5px] text-muted" role="status">Filtrant…</span> : null}
      </div>

      <div id="filtres-articles" className={`${oberts ? "grid" : "hidden"} grid-cols-2 gap-x-3 gap-y-2.5 md:grid md:grid-cols-4`}>
        {CARACTERISTIQUES.map((caracteristica) => {
          const llista = opcions[caracteristica.clau] ?? [];
          const buscat = filtres.tria[caracteristica.clau] ?? "";
          // L'adreça pot portar el valor escrit d'una altra manera («garnatxa»): es mostra el de la llista.
          const triat = buscat ? (llista.find((opcio) => clauDeValor(opcio.valor) === clauDeValor(buscat))?.valor ?? buscat) : "";
          return (
            <label key={caracteristica.clau} className="min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.1em] text-muted">{caracteristica.etiqueta}</span>
              <select
                value={triat}
                onChange={(e) => navega({ [caracteristica.clau]: e.target.value })}
                className={`field w-full !py-1.5 text-[13.5px] ${triat ? "!border-marca/50 bg-marca-clar/40" : ""}`}
              >
                <option value="">Qualsevol</option>
                {llista.map((opcio) => (
                  <option key={opcio.valor} value={opcio.valor}>
                    {opcio.valor} ({opcio.quants})
                  </option>
                ))}
              </select>
            </label>
          );
        })}

        <label className="col-span-2 flex items-center gap-2 text-[13.5px] md:col-span-4">
          <input
            type="checkbox"
            checked={filtres.ambFoto}
            onChange={(e) => navega({ foto: e.target.checked ? "1" : "" })}
            className="size-4 accent-marca"
          />
          Només els que tenen foto
        </label>
        <label className="col-span-2 flex items-center gap-2 text-[13.5px] md:col-span-4">
          <input
            type="checkbox"
            checked={filtres.ambHistorics}
            onChange={(e) => navega({ historics: e.target.checked ? "1" : "" })}
            className="size-4 accent-marca"
          />
          Històrics
          <span className="text-[12.5px] text-muted">(descatalogats o no disponibles a l&apos;ERP)</span>
        </label>
      </div>
    </div>
  );
}
