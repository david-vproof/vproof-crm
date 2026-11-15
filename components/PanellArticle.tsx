import Link from "next/link";

import { FotoGranArticle } from "@/components/FotoGranArticle";
import { ICONES } from "@/components/Icones";
import { TancaAmbEscape } from "@/components/TancaAmbEscape";
import { Dada } from "@/components/UI";
import { nomDeFormat, nomDeTipus } from "@/domini/cataleg-articles";
import { dataCurta } from "@/lib/format";
import { type FitxaArticle, urlImatge } from "@/serveis/articles";

/**
 * La columna de detall d'un article: s'obre a la dreta, damunt de la llista,
 * com la fitxa d'un registre del CRM. Al telèfon ocupa la pantalla sencera. Es
 * tanca tocant fora, amb la creu o amb Escape, i torna a la llista tal com era.
 */
export function PanellArticle({ article, tancar }: { article: FitxaArticle; tancar: string }) {
  const nom = article.nom ?? "Sense nom";
  const Tancar = ICONES.tancar;
  const gran = urlImatge(article, "gran");

  return (
    <div className="fixed inset-0 z-40">
      <Link href={tancar} scroll={false} aria-label="Tanca l'article" className="absolute inset-0 bg-ink/25" />
      <TancaAmbEscape href={tancar} />

      <aside aria-label={nom} className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-line bg-cream shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted">
              Producte · <span className="font-mono normal-case tracking-normal">{article.codi_erp}</span>
            </p>
            <h2 className="mt-0.5 font-display text-[22px] leading-tight">{nom}</h2>
          </div>
          <Link href={`/crm?v=productes&r=${encodeURIComponent(article.id)}`} className="btn-compacte shrink-0">
            Edita
          </Link>
          <Link
            href={tancar}
            scroll={false}
            aria-label="Tanca"
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink"
          >
            <Tancar className="size-[18px]" />
          </Link>
        </header>

        <div className="scroll-slim flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          <FotoGranArticle key={gran ?? article.id} petita={urlImatge(article, "petita")} gran={gran} nom={nom} />

          <dl className="space-y-2.5">
            <Dada etiqueta="Categoria" valor={nomDeTipus(article.familia)} />
            <Dada etiqueta="Principi actiu" valor={article.garantia} />
            <Dada etiqueta="Espècie" valor={article.camp_programable_1} />
            <Dada etiqueta="Forma farmacèutica" valor={article.camp_programable_2} />
            <Dada etiqueta="Via d'administració" valor={article.camp_programable_3} />
            <Dada etiqueta="Prescripció" valor={article.camp_programable_4} />
            <Dada etiqueta="Format" valor={nomDeFormat(article.camp_programable_5)} />
            <Dada
              etiqueta="Laboratori"
              valor={
                article.laboratori ? (
                  <Link href={`/laboratoris/${article.laboratori.id}`} className="transition hover:text-marca">
                    {article.laboratori.nom_comercial ?? "Sense nom"}
                  </Link>
                ) : (
                  ""
                )
              }
            />
            <Dada etiqueta="Codi de barres" valor={article.codi_barres ? <span className="font-mono">{article.codi_barres}</span> : ""} />
            <Dada etiqueta="Ref. del laboratori" valor={article.referencia_proveidor} />
            <Dada etiqueta="Data d'alta" valor={dataCurta(article.data_alta ?? undefined)} />
          </dl>
        </div>
      </aside>
    </div>
  );
}
