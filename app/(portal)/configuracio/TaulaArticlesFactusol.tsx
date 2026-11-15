import type { SituacioErp } from "@/domini/sincronitzacio";
import type { Article } from "@/domini/tipus";
import { dataCurta } from "@/lib/format";
import type { PanellArticles } from "@/serveis/sincronitzacio";

import { PaginacioErp, Situacio, Td, Th } from "./TaulaErp";

/**
 * F_ART en cru, tal com la retorna l'API, i només els articles actius: la
 * mateixa foto que farà servir la passada. Doble forma, com la resta del
 * portal: fitxes al telèfon i taula a l'escriptori, sense rascar de costat.
 */
export function TaulaArticlesFactusol({
  dades,
  situacio,
  enllacPagina,
}: {
  dades: NonNullable<PanellArticles["llista"]>;
  /** Com està cada codi respecte de Directus: nou, igual o canviat. */
  situacio: Record<string, SituacioErp>;
  enllacPagina: (p: number) => string;
}) {
  const pagines = Math.max(1, Math.ceil(dades.total / dades.perPagina));

  return (
    <>
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line/70 md:hidden">
          {dades.files.map((article) => (
            <li key={article.CODART} className="px-4 py-3">
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="mr-2 font-mono text-[12px] text-muted">{codi(article)}</span>
                  <span className="text-[14px] font-medium text-ink">{article.DESART}</span>
                </span>
                <span className="shrink-0">
                  <Situacio valor={situacio[codi(article)]} />
                </span>
              </span>
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
                <span>Família {text(article.FAMART) || "—"}</span>
                <span>Proveïdor {proveidor(article)}</span>
                {text(article.EANART) ? <span className="font-mono">{text(article.EANART)}</span> : null}
                {text(article.IMGART) ? <span>Amb foto</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <table className="hidden w-full border-collapse text-[13px] md:table">
          <thead>
            <tr className="border-b border-line bg-cream/70">
              <Th>Codi</Th>
              <Th>Article</Th>
              <Th>Família</Th>
              <Th>Proveïdor</Th>
              <Th ampla>Ref. proveïdor</Th>
              <Th ampla>Codi de barres</Th>
              <Th ampla>Alta</Th>
              <Th>Foto</Th>
              <Th dreta>Directus</Th>
            </tr>
          </thead>
          <tbody>
            {dades.files.map((article) => (
              <tr key={article.CODART} className="border-b border-line/60 transition-colors last:border-0 hover:bg-parchment/40">
                <Td className="whitespace-nowrap font-mono text-muted">{codi(article)}</Td>
                <Td className="max-w-[320px]">
                  <span className="block truncate font-medium text-ink">{article.DESART}</span>
                </Td>
                <Td className="font-mono text-muted">{text(article.FAMART) || "—"}</Td>
                <Td className="font-mono text-muted">{proveidor(article)}</Td>
                <Td ampla className="max-w-[160px] truncate text-muted">{text(article.REFART) || "—"}</Td>
                <Td ampla className="whitespace-nowrap font-mono text-muted">{text(article.EANART) || "—"}</Td>
                <Td ampla className="whitespace-nowrap text-muted">{dataCurta(article.FALART) || "—"}</Td>
                {/* IMGART: el nom del fitxer. La foto la copia la passada, a part. */}
                <Td className="text-muted">{text(article.IMGART) ? <span title={text(article.IMGART)}>Sí</span> : "—"}</Td>
                <Td dreta><Situacio valor={situacio[codi(article)]} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginacioErp pagina={dades.pagina} pagines={pagines} enllacPagina={enllacPagina} />
    </>
  );
}

function text(valor: unknown) {
  return String(valor ?? "").trim();
}

/** CODART és de text: es mostra tal qual, i és també la clau de la situació. */
function codi(article: Article) {
  return text(article.CODART);
}

/** PHAART: el codi de F_PRO del proveïdor habitual, a quatre xifres com a la taula de proveïdors. */
function proveidor(article: Article) {
  const codiProveidor = Number(article.PHAART) || 0;
  return codiProveidor ? String(codiProveidor).padStart(4, "0") : "—";
}
