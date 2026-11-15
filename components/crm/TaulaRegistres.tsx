import Link from "next/link";

import { FiltreColumna, FormulariFiltres, SelectorOrdre } from "@/components/crm/FiltreColumna";
import { FilaTargeta, FilaTaula, MARCA_ID, ampleDelTitol, columnaDeFila, repartimentDeColumnes, visibilitat } from "@/components/crm/FilesRegistres";
import { FilesAfegides, PeuScroll, ScrollRegistres, TargetesAfegides } from "@/components/crm/ScrollRegistres";
import { type ColumnaLlistat, type Filtres, type OrdreLlistat, filtresTancats, menaDeFiltre, paramsDeLlistat } from "@/domini/crm-llistat";
import type { FilaLlistat } from "@/serveis/crm-manteniment";

/** Camps ocults que el formulari de filtres ha de conservar (vista, cerca…). */
function Ocults({ valors }: { valors: Record<string, string> }) {
  return Object.entries(valors).map(([nom, valor]) =>
    valor ? <input key={nom} type="hidden" name={nom} value={valor} /> : null,
  );
}

/**
 * El llistat d'una fitxa, amb control per columna: la capçalera ordena (asc,
 * desc, res) i la fila de sota filtra. Tot va per l'URL, així una vista
 * filtrada es pot compartir i es conserva en obrir una fitxa.
 *
 * Les columnes marcades `alTitol` no ocupen columna: el seu valor va dins de
 * la cel·la del títol, en una segona línia, i l'ordre i el filtre, a sota dels del títol.
 */
export function TaulaRegistres({
  columnes,
  files,
  enllacFitxa,
  ordre = null,
  filtres = {},
  enllacOrdre,
  enllacNeteja,
  ocults = {},
  senseFiltre = [],
  scroll,
}: {
  columnes: ColumnaLlistat[];
  files: FilaLlistat[];
  enllacFitxa: (id: string) => string;
  ordre?: OrdreLlistat | null;
  filtres?: Filtres;
  /** On porta clicar la capçalera d'aquesta columna. Sense això, no s'ordena. */
  enllacOrdre?: (camp: string) => string;
  /** On porta treure tots els filtres. */
  enllacNeteja?: string;
  /** Paràmetres que el formulari de filtres conserva (vista i cerca). */
  ocults?: Record<string, string>;
  /** Columnes per les quals no s'ofereix filtre: l'agent, a qui només veu el seu. */
  senseFiltre?: string[];
  /** Si el llistat es va allargant en baixar: què llista i quantes n'hi ha en total. Vegeu `ScrollRegistres`. */
  scroll?: { consulta: string; total: number };
}) {
  const ambControls = Boolean(enllacOrdre);
  const filtresActius = Object.keys(filtres).length;
  const valorOrdre = paramsDeLlistat(ordre, {}).ordre ?? "";
  const tancats = filtresTancats(filtres);
  /** El filtre d'una columna a la capçalera; cap, si la columna no es filtra (la casella queda buida). */
  const filtreDe = (columna: ColumnaLlistat) =>
    senseFiltre.includes(columna.camp) ? null : <FiltreColumna columna={columna} valors={filtres[columna.camp] ?? []} tancat={tancats.has(columna.camp)} />;

  const { visibles, delTitol } = repartimentDeColumnes(columnes);

  function capcalera(columna: ColumnaLlistat) {
    const activa = ordre?.camp === columna.camp;
    if (!enllacOrdre) return columna.etiqueta;
    return (
      <Link
        key={columna.camp}
        href={enllacOrdre(columna.camp)}
        className={`inline-flex items-center gap-1 underline-offset-2 hover:text-ink hover:underline ${activa ? "text-ink" : ""}`}
        title={`${columna.etiqueta}: ${activa ? (ordre?.descendent ? "treu l'ordre" : "ordena descendent") : "ordena ascendent"}`}
      >
        {columna.curta ?? columna.etiqueta}
        <span className={`text-[9px] ${activa ? "text-marca" : "text-line"}`} aria-hidden>
          {activa ? (ordre?.descendent ? "▼" : "▲") : "▲"}
        </span>
      </Link>
    );
  }

  const llistat = (
    <>
      {/* Al telèfon no hi ha capçaleres a clicar: l'ordre i els filtres van en
          un bloc plegable a sobre de les fitxes. */}
      {ambControls ? (
        // Queda enganxat a dalt en baixar per la llista, per seguir filtrant sense tornar amunt.
        <div className="sticky top-0 z-10 bg-cream px-4 pb-2 md:hidden">
        <details className="rounded-lg border border-line bg-white" open={filtresActius > 0 || ordre !== null}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12.5px] text-muted">
            <span>
              Ordre i filtres
              {filtresActius ? <span className="ml-1.5 rounded bg-marca-clar px-1.5 py-px text-[11px] text-marca-fosc">{filtresActius}</span> : null}
            </span>
            <span className="text-[10px]">▼</span>
          </summary>
          <FormulariFiltres className="grid max-h-[70dvh] gap-2.5 overflow-y-auto border-t border-line px-3 py-3">
            <Ocults valors={ocults} />
            <SelectorOrdre columnes={columnes} valor={valorOrdre} />
            {columnes.map((columna) =>
              menaDeFiltre(columna.definicio) && !senseFiltre.includes(columna.camp) ? (
                <FiltreColumna key={columna.camp} columna={columna} valors={filtres[columna.camp] ?? []} tancat={tancats.has(columna.camp)} etiquetat />
              ) : null,
            )}
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" className="btn-compacte">Aplica</button>
              {filtresActius && enllacNeteja ? (
                <Link href={enllacNeteja} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink">
                  Neteja els filtres
                </Link>
              ) : null}
            </div>
          </FormulariFiltres>
        </details>
        </div>
      ) : null}

      {/* Fins a tauleta ampla, una taula de sis columnes no es llegeix ni hi cap:
          es plega en fitxes. El llindar és el que fa que, quan surti, la taula
          càpiga sencera sense rascar de costat. */}
      <ul className={`divide-y divide-line/70 border-y border-line md:hidden ${files.length === 0 ? "hidden" : ""}`}>
        {/* Cridades com a funció, no com a components: vegeu FilesRegistres. */}
        {files.map((fila) => FilaTargeta({ fila, visibles, delTitol, href: enllacFitxa(fila.id) }))}
      </ul>
      {scroll ? <TargetesAfegides /> : null}

      {/* L'amplada mínima ha de cabre a la tauleta i a l'escriptori amb la
          barra lateral oberta (a 1024px queden uns 720px): més ampla i la
          taula tornaria a rascar de costat. */}
      <div className="hidden md:block">
        {/* El formulari embolcalla la taula perquè la fila de filtres, que és
            dins del thead, en formi part; els enllaços de les files no hi interfereixen. */}
        <FormulariFiltres>
        <Ocults valors={{ ...ocults, ...(valorOrdre ? { ordre: valorOrdre } : {}) }} />
        <table className="w-full min-w-[700px] border-collapse text-[13px]">
          {/* La capçalera, amb la fila de filtres, queda enganxada a dalt en baixar per la llista. */}
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-line)]">
          <tr className="border-y border-line bg-cream/70">
            {visibles.map(({ columna }, posicio) => (
              <th
                key={columna.camp}
                aria-sort={ordre?.camp === columna.camp ? (ordre?.descendent ? "descending" : "ascending") : undefined}
                className={`whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted ${visibilitat(columna)}`}
              >
                {posicio === 0 && delTitol.length > 0 ? (
                  <span className="flex flex-col gap-1">
                    {capcalera(columna)}
                    <span className="flex items-center gap-2 text-[10px]">
                      {delTitol.map((c) => (
                        <span key={c.columna.camp} className={`shrink-0 ${ampleDelTitol(c.columna)}`}>
                          {capcalera(c.columna)}
                        </span>
                      ))}
                    </span>
                  </span>
                ) : (
                  capcalera(columna)
                )}
              </th>
            ))}
          </tr>
          {ambControls ? (
            <tr className="border-b border-line bg-white">
              {visibles.map(({ columna }, posicio) => (
                // La primera porta el mateix marge que la capçalera i les files, perquè les caselles del títol hi quadrin.
                <td key={columna.camp} className={`${posicio === 0 && delTitol.length > 0 ? "px-3" : "px-2"} py-1.5 align-middle ${visibilitat(columna)}`}>
                  <div className={`flex items-center ${posicio === 0 && delTitol.length > 0 ? "gap-2" : "gap-1.5"}`}>
                    {posicio === 0 && delTitol.length > 0 ? (
                      // Com a les files: a dalt el filtre del nom, a sota els del que va amb ell.
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        {filtreDe(columna)}
                        <div className="flex items-center gap-2">
                          {delTitol.map((c) => (
                            <div key={c.columna.camp} className={`shrink-0 ${ampleDelTitol(c.columna)}`}>
                              {filtreDe(c.columna)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      filtreDe(columna)
                    )}
                    {posicio === visibles.length - 1 ? (
                      <>
                        <button type="submit" className="sr-only">Filtra</button>
                        {filtresActius && enllacNeteja ? (
                          <Link href={enllacNeteja} title="Neteja els filtres" aria-label="Neteja els filtres" className="shrink-0 text-[12px] text-muted hover:text-ink">
                            ✕
                          </Link>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </td>
              ))}
            </tr>
          ) : null}
          </thead>
          <tbody>
          {files.map((fila) => FilaTaula({ fila, visibles, delTitol, href: enllacFitxa(fila.id) }))}
          </tbody>
          {scroll ? <FilesAfegides /> : null}
        </table>
        </FormulariFiltres>
      </div>
    </>
  );

  if (!scroll) return llistat;
  return (
    <ScrollRegistres
      key={scroll.consulta}
      consulta={scroll.consulta}
      inicials={files.map((fila) => fila.id)}
      total={scroll.total}
      // Només el que necessiten les files: les opcions dels filtres ja van a la capçalera.
      columnes={columnes.map(columnaDeFila)}
      plantillaEnllac={enllacFitxa(MARCA_ID)}
    >
      {llistat}
      <PeuScroll />
    </ScrollRegistres>
  );
}
