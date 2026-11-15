import type { SituacioErp } from "@/domini/sincronitzacio";
import type { ClientResum, LlistaClientsResum } from "@/domini/tipus";
import { dataCurta } from "@/lib/format";

import { EstatClientFactusol, PaginacioErp, Situacio, Td, Th } from "./TaulaErp";

/**
 * F_CLI en cru, tal com la retorna l'API. Doble forma, com la resta del
 * portal: fitxes al telèfon i taula a l'escriptori, sense rascar de costat.
 */
export function TaulaClientsFactusol({
  dades,
  situacio,
  enllacPagina,
}: {
  dades: LlistaClientsResum;
  /** Com està cada codi respecte de Directus: nou, igual o canviat. */
  situacio: Record<number, SituacioErp>;
  enllacPagina: (p: number) => string;
}) {
  const pagines = Math.max(1, Math.ceil(dades.total / dades.perPagina));

  return (
    <>
      <div className="card overflow-hidden">
        <ul className="divide-y divide-line/70 md:hidden">
          {dades.files.map((client) => (
            <li key={client.CODCLI} className="px-4 py-3">
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="mr-2 font-mono text-[12px] text-muted">{codi(client)}</span>
                  <span className="text-[14px] font-medium text-ink">{client.NOFCLI}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <Situacio valor={situacio[client.CODCLI]} />
                  <EstatClientFactusol codi={client.ESTCLI} />
                </span>
              </span>
              {client.NOCCLI && client.NOCCLI !== client.NOFCLI ? (
                <span className="mt-0.5 block truncate text-[12.5px] text-muted">{client.NOCCLI}</span>
              ) : null}
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
                <span className="font-mono">{client.NIFCLI || "—"}</span>
                <span>{[client.POBCLI, client.PROCLI].filter(Boolean).join(" · ") || "—"}</span>
                {telefon(client) ? <span>{telefon(client)}</span> : null}
                {client.EMACLI ? <span className="truncate">{client.EMACLI}</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <table className="hidden w-full border-collapse text-[13px] md:table">
          <thead>
            <tr className="border-b border-line bg-cream/70">
              <Th>Codi</Th>
              <Th>Client</Th>
              <Th>NIF</Th>
              <Th>Població</Th>
              <Th>Contacte</Th>
              <Th ampla>Agent</Th>
              <Th ampla>F. pag.</Th>
              <Th ampla>Tarifa</Th>
              <Th ampla>Alta</Th>
              <Th>Estat</Th>
              <Th dreta>Directus</Th>
            </tr>
          </thead>
          <tbody>
            {dades.files.map((client) => (
              <tr key={client.CODCLI} className="border-b border-line/60 transition-colors last:border-0 hover:bg-parchment/40">
                <Td className="font-mono text-muted">{codi(client)}</Td>
                <Td className="max-w-[260px]">
                  <span className="block truncate font-medium text-ink">{client.NOFCLI}</span>
                  {client.NOCCLI && client.NOCCLI !== client.NOFCLI ? (
                    <span className="block truncate text-[12px] text-muted">{client.NOCCLI}</span>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap font-mono text-muted">{client.NIFCLI || "—"}</Td>
                <Td className="max-w-[180px]">
                  <span className="block truncate">{client.POBCLI || "—"}</span>
                  <span className="block truncate text-[12px] text-muted">{client.PROCLI}</span>
                </Td>
                <Td className="max-w-[220px]">
                  <span className="block truncate">{telefon(client) || "—"}</span>
                  <span className="block truncate text-[12px] text-muted">{client.EMACLI}</span>
                </Td>
                <Td ampla className="tabular-nums text-muted">{client.AGECLI || "—"}</Td>
                <Td ampla className="font-mono text-muted">{String(client.FPACLI ?? "").trim() || "—"}</Td>
                <Td ampla className="tabular-nums text-muted">{client.TARCLI || "—"}</Td>
                <Td ampla className="whitespace-nowrap text-muted">{dataCurta(client.FALCLI) || "—"}</Td>
                <Td><EstatClientFactusol codi={client.ESTCLI} /></Td>
                <Td dreta><Situacio valor={situacio[client.CODCLI]} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginacioErp pagina={dades.pagina} pagines={pagines} enllacPagina={enllacPagina} />
    </>
  );
}

function codi(client: ClientResum) {
  return String(client.CODCLI).padStart(4, "0");
}

function telefon(client: ClientResum) {
  return (client.TELCLI || client.MOVCLI || "").trim();
}
