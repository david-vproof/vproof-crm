import Link from "next/link";

import { FotoArticle } from "@/components/FotoArticle";
import { ANYS_ENRERE_ALBARANS, liniesDAlbara, numero, numeroAlbara, type LiniaDeFitxa } from "@/domini/albarans";
import { dataCurta, eurosAmbCentims, percentatge, quantitat } from "@/lib/format";
import type { AlbaransDelClient } from "@/serveis/albarans";
import { urlImatge } from "@/serveis/articles";

/**
 * Els albarans d'un client, amb les seves línies, a sota de les xifres de
 * facturació. Una llista i no una taula: al telèfon cada línia s'apila sense
 * haver de rascar de costat.
 */
export function AlbaransClient({
  dades,
  enllacPagina,
}: {
  /** Null si no s'han pogut llegir: la resta de la pestanya surt igual. */
  dades: AlbaransDelClient | null;
  /** Va dins la fitxa del client: l'enllaç substitueix l'entrada de l'historial, com les pestanyes. */
  enllacPagina: (pagina: number) => string;
}) {
  const pagines = dades ? Math.max(1, Math.ceil(dades.total / dades.perPagina)) : 1;

  return (
    // Les pàgines porten a l'àncora: el que es vol veure és el principi de la pàgina nova, no el peu.
    <section id="albarans" className="scroll-mt-16">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        Albarans{dades ? ` · ${dades.total}` : ""}
      </h3>

      {!dades ? (
        <p className="mt-2 text-[13px] text-muted">No s&apos;han pogut llegir els albarans.</p>
      ) : dades.files.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">
          FactuSol no té cap albarà d&apos;aquest client {ANYS_ENRERE_ALBARANS === 1 ? "d'aquest any ni del passat" : "dels darrers exercicis"}.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-3">
            {dades.files.map((albara) => {
              const { linies, total } = liniesDAlbara(albara);
              return (
                <li key={albara.id} className="overflow-hidden rounded-lg border border-line bg-white/60">
                  <div className="flex items-baseline justify-between gap-3 border-b border-line/70 bg-cream/60 px-3 py-2">
                    <span className="min-w-0 truncate text-[13px]">
                      <span className="font-mono text-muted">{numeroAlbara(albara.serie, albara.numero)}</span>
                      <span className="text-muted"> · </span>
                      {dataCurta(albara.data ?? undefined) || "Sense data"}
                    </span>
                    {/* Sense línies no hi ha import: un zero faria creure que l'albarà no valia res. */}
                    <span className="shrink-0 text-[13.5px] font-medium tabular-nums">
                      {linies.length > 0 ? eurosAmbCentims(total) : "—"}
                    </span>
                  </div>
                  {linies.length === 0 ? (
                    <p className="px-3 py-2 text-[13px] text-muted">Les línies encara no són a la còpia del portal.</p>
                  ) : (
                    <ul className="divide-y divide-line/60">
                      {linies.map((linia) => (
                        <Linia key={linia.id} linia={linia} />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {pagines > 1 ? (
            <nav className="mt-3 flex items-center justify-between text-[13px]" aria-label="Paginació d'albarans">
              <span className="text-muted">
                Pàgina {dades.pagina} de {pagines}
              </span>
              <span className="flex gap-2">
                <PasPagina href={enllacPagina(dades.pagina - 1)} actiu={dades.pagina > 1}>Més nous</PasPagina>
                <PasPagina href={enllacPagina(dades.pagina + 1)} actiu={dades.pagina < pagines}>Més antics</PasPagina>
              </span>
            </nav>
          ) : null}
        </>
      )}

      <p className="mt-3 text-[12px] text-muted">
        Albarans de FactuSol d&apos;aquest any i {ANYS_ENRERE_ALBARANS === 1 ? "del passat" : `dels ${ANYS_ENRERE_ALBARANS} anteriors`},
        amb els imports sense IVA. Es posen al dia amb la sincronització d&apos;albarans.
      </p>
    </section>
  );
}

/** Una línia: el que diu l'albarà, quant, a quin preu i quant puja. */
function Linia({ linia }: { linia: LiniaDeFitxa }) {
  const quantes = numero(linia.quantitat);
  const preu = numero(linia.preu);
  const descompte = numero(linia.descompte);
  const importLinia = numero(linia.import);
  const nom = linia.descripcio ?? linia.article?.nom ?? "Sense descripció";
  const detall = [
    linia.erp_article,
    quantes !== null && preu !== null ? `${quantitat(quantes)} × ${eurosAmbCentims(preu)}` : quantes !== null ? quantitat(quantes) : null,
    descompte ? `−${percentatge(descompte)}` : null,
  ].filter(Boolean);

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <FotoArticle petita={linia.article ? urlImatge(linia.article, "petita") : null} nom={nom} className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px]">{nom}</span>
        {detall.length > 0 ? <span className="block truncate text-[12px] tabular-nums text-muted">{detall.join(" · ")}</span> : null}
      </span>
      <span className="shrink-0 text-[13px] tabular-nums">{importLinia !== null ? eurosAmbCentims(importLinia) : "—"}</span>
    </li>
  );
}

function PasPagina({ href, actiu, children }: { href: string; actiu: boolean; children: React.ReactNode }) {
  if (!actiu) {
    return <span className="rounded-lg border border-line px-2.5 py-1 text-muted/40">{children}</span>;
  }
  return (
    <Link href={href} replace className="rounded-lg border border-line bg-white px-2.5 py-1 transition hover:border-ink">
      {children}
    </Link>
  );
}
