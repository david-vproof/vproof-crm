import { codiAlbara, numeroAlbara, type AlbaraErp } from "@/domini/albarans";
import type { SituacioErp } from "@/domini/sincronitzacio";
import { dataCurta } from "@/lib/format";
import type { PanellAlbarans } from "@/serveis/sincronitzacio";

import { PaginacioErp, Situacio, Td, Th } from "./TaulaErp";

/**
 * F_ALB en cru, tal com la retorna l'API: les capçaleres dels albarans que
 * portarà la passada, els més nous primer. Les línies no hi surten: van amb
 * cada albarà. Doble forma, com la resta: fitxes al telèfon i taula a l'escriptori.
 */
export function TaulaAlbaransFactusol({
  dades,
  situacio,
  enllacPagina,
}: {
  dades: NonNullable<PanellAlbarans["llista"]>;
  /** Com està cada albarà respecte de Directus: nou, igual o canviat. */
  situacio: Record<string, SituacioErp>;
  enllacPagina: (p: number) => string;
}) {
  const pagines = Math.max(1, Math.ceil(dades.total / dades.perPagina));

  return (
    <>
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line/70 md:hidden">
          {dades.files.map((albara) => (
            <li key={clau(albara)} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">
                  <span className="font-mono">{numero(albara)}</span> · {dataCurta(albara.FECALB) || "—"}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  Exercici {albara.exercici} · client {client(albara)}
                </span>
              </span>
              <span className="shrink-0">
                <Situacio valor={situacio[clau(albara)]} />
              </span>
            </li>
          ))}
        </ul>

        <table className="hidden w-full border-collapse text-[13px] md:table">
          <thead>
            <tr className="border-b border-line bg-cream/70">
              <Th>Exercici</Th>
              <Th>Albarà</Th>
              <Th>Data</Th>
              <Th>Client</Th>
              <Th>Estat</Th>
              <Th dreta>Directus</Th>
            </tr>
          </thead>
          <tbody>
            {dades.files.map((albara) => (
              <tr key={clau(albara)} className="border-b border-line/60 transition-colors last:border-0 hover:bg-parchment/40">
                <Td className="tabular-nums text-muted">{albara.exercici}</Td>
                <Td className="whitespace-nowrap font-mono">{numero(albara)}</Td>
                <Td className="whitespace-nowrap text-muted">{dataCurta(albara.FECALB) || "—"}</Td>
                <Td className="font-mono text-muted">{client(albara)}</Td>
                {/* ESTALB en cru: 0 és sense facturar i 1, facturat. */}
                <Td className="tabular-nums text-muted">{Number(albara.ESTALB) || 0}</Td>
                <Td dreta><Situacio valor={situacio[clau(albara)]} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginacioErp pagina={dades.pagina} pagines={pagines} enllacPagina={enllacPagina} />
    </>
  );
}

/** La mateixa clau amb què la passada el compara amb Directus. */
function clau(albara: AlbaraErp) {
  return codiAlbara(albara.exercici, albara.TIPALB, albara.CODALB);
}

function numero(albara: AlbaraErp) {
  return numeroAlbara(String(albara.TIPALB ?? "").trim() || null, Number(albara.CODALB));
}

/** CLIALB: el codi de F_CLI, a quatre xifres com a la taula de clients. */
function client(albara: AlbaraErp) {
  const codi = Number(albara.CLIALB) || 0;
  return codi ? String(codi).padStart(4, "0") : "—";
}
