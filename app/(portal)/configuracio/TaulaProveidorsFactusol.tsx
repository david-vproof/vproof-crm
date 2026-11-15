import type { SituacioErp } from "@/domini/sincronitzacio";
import type { LlistaProveidorsResum, ProveidorResum } from "@/domini/tipus";
import { dataCurta } from "@/lib/format";

import { EstatFactusol, PaginacioErp, Situacio, Td, Th } from "./TaulaErp";

/**
 * F_PRO en cru, tal com la retorna l'API. Doble forma, com la resta del
 * portal: fitxes al telèfon i taula a l'escriptori, sense rascar de costat.
 */
export function TaulaProveidorsFactusol({
  dades,
  situacio,
  enllacPagina,
}: {
  dades: LlistaProveidorsResum;
  /** Com està cada codi respecte de Directus: nou, igual o canviat. */
  situacio: Record<number, SituacioErp>;
  enllacPagina: (p: number) => string;
}) {
  const pagines = Math.max(1, Math.ceil(dades.total / dades.perPagina));

  return (
    <>
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line/70 md:hidden">
          {dades.files.map((proveidor) => (
            <li key={proveidor.CODPRO} className="px-4 py-3">
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="mr-2 font-mono text-[12px] text-muted">{codi(proveidor)}</span>
                  <span className="text-[14px] font-medium text-ink">{proveidor.NOFPRO}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <Situacio valor={situacio[proveidor.CODPRO]} />
                  <EstatFactusol codi={proveidor.ESTPRO} />
                </span>
              </span>
              {proveidor.NOCPRO && proveidor.NOCPRO !== proveidor.NOFPRO ? (
                <span className="mt-0.5 block truncate text-[12.5px] text-muted">{proveidor.NOCPRO}</span>
              ) : null}
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
                <span className="font-mono">{proveidor.NIFPRO || "—"}</span>
                <span>{tipus(proveidor)}</span>
                <span>{[proveidor.POBPRO, proveidor.PROPRO].filter(Boolean).join(" · ") || "—"}</span>
                {proveidor.TELPRO ? <span>{proveidor.TELPRO}</span> : null}
                {proveidor.EMAPRO ? <span className="truncate">{proveidor.EMAPRO}</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <table className="hidden w-full border-collapse text-[13px] md:table">
          <thead>
            <tr className="border-b border-line bg-cream/70">
              <Th>Codi</Th>
              <Th>Proveïdor</Th>
              <Th>NIF</Th>
              <Th>Població</Th>
              <Th>Contacte</Th>
              <Th>Tipus</Th>
              <Th ampla>F. pag.</Th>
              <Th ampla>Alta</Th>
              <Th>Estat</Th>
              <Th dreta>Directus</Th>
            </tr>
          </thead>
          <tbody>
            {dades.files.map((proveidor) => (
              <tr key={proveidor.CODPRO} className="border-b border-line/60 transition-colors last:border-0 hover:bg-parchment/40">
                <Td className="font-mono text-muted">{codi(proveidor)}</Td>
                <Td className="max-w-[260px]">
                  <span className="block truncate font-medium text-ink">{proveidor.NOFPRO}</span>
                  {proveidor.NOCPRO && proveidor.NOCPRO !== proveidor.NOFPRO ? (
                    <span className="block truncate text-[12px] text-muted">{proveidor.NOCPRO}</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap font-mono text-muted">{proveidor.NIFPRO || "—"}</Td>
                <Td className="max-w-[180px]">
                  <span className="block truncate">{proveidor.POBPRO || "—"}</span>
                  <span className="block truncate text-[12px] text-muted">{proveidor.PROPRO}</span>
                </Td>
                <Td className="max-w-[220px]">
                  <span className="block truncate">{proveidor.TELPRO || proveidor.PCOPRO || "—"}</span>
                  <span className="block truncate text-[12px] text-muted">{proveidor.EMAPRO}</span>
                </Td>
                <Td className="whitespace-nowrap text-muted">{tipus(proveidor)}</Td>
                <Td ampla className="font-mono text-muted">{String(proveidor.FPAPRO ?? "").trim() || "—"}</Td>
                <Td ampla className="whitespace-nowrap text-muted">{dataCurta(proveidor.FALPRO) || "—"}</Td>
                <Td><EstatFactusol codi={proveidor.ESTPRO} /></Td>
                <Td dreta><Situacio valor={situacio[proveidor.CODPRO]} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginacioErp pagina={dades.pagina} pagines={pagines} enllacPagina={enllacPagina} />
    </>
  );
}

function codi(proveidor: ProveidorResum) {
  return String(proveidor.CODPRO).padStart(4, "0");
}

/** TIPPRO: qui ven mercaderia i qui ven serveis. */
function tipus(proveidor: ProveidorResum) {
  return proveidor.TIPPRO === 1 ? "Creditor" : "Proveïdor";
}
