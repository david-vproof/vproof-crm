import Link from "next/link";

import { AvisConnexio } from "@/components/AvisConnexio";
import { ICONES } from "@/components/Icones";
import { EnllacOrdre } from "@/components/OrdreLlistat";
import { SelectorOrdre } from "@/components/SelectorOrdre";
import { Capcalera, EstatBuit } from "@/components/UI";
import { EstatClientFactusol } from "@/app/(portal)/configuracio/TaulaErp";
import { COLUMNES_CLIENTS_ERP } from "@/domini/llistats-erp";
import { escriuOrdre, llegeixOrdre, seguentOrdre } from "@/domini/ordre-llistat";
import { clientsDelPortal } from "@/serveis/clients";
import type { LlistaClients } from "@/domini/tipus";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export const metadata = { title: "Clients · Wine Backend" };

const COLUMNES =
  "grid grid-cols-[62px_minmax(0,1fr)_88px] gap-4 md:grid-cols-[76px_minmax(0,1.6fr)_minmax(0,1fr)_88px] xl:grid-cols-[76px_minmax(0,1.8fr)_120px_minmax(0,1fr)_minmax(0,1.2fr)_88px]";

export default async function PaginaClients({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string; ordre?: string }>;
}) {
  await exigeixVeuTot();
  const { q = "", p = "1", ordre: ordreBrut } = await searchParams;
  // L'ordre per columna va a l'adreça (vegeu `domini/ordre-llistat.ts`): es conserva en paginar i en cercar.
  const ordre = llegeixOrdre(ordreBrut, COLUMNES_CLIENTS_ERP);
  const textOrdre = escriuOrdre(ordre);

  let dades: LlistaClients | null = null;
  let fallada: unknown = null;
  try {
    dades = await clientsDelPortal({ cerca: q, pagina: Number(p) || 1, ordre });
  } catch (error) {
    fallada = error;
  }

  const Cerca = ICONES.cerca;
  const conservats = { ...(q ? { q } : {}), ...(textOrdre ? { ordre: textOrdre } : {}) };
  const enllacPagina = (numero: number) => `/clients?${new URLSearchParams({ ...conservats, p: String(numero) })}`;
  // Canviar l'ordre torna a la primera pàgina.
  const enllacOrdre = (camp: string) => {
    const nou = escriuOrdre(seguentOrdre(ordre, camp));
    return `/clients?${new URLSearchParams({ ...(q ? { q } : {}), ...(nou ? { ordre: nou } : {}) })}`;
  };
  const capcalera = (camp: string, etiqueta: string) => (
    <EnllacOrdre camp={camp} etiqueta={etiqueta} ordre={ordre} enllac={enllacOrdre(camp)} />
  );
  const pagines = dades ? Math.max(1, Math.ceil(dades.total / dades.perPagina)) : 1;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      <Capcalera
        titol="Clients"
        descripcio={
          dades ? (
            <>
              {dades.total} {dades.total === 1 ? "fitxa" : "fitxes"} al fitxer de clients · exercici{" "}
              {dades.exercici}
            </>
          ) : (
            "Dades llegides de l'ERP"
          )
        }
        accions={
          dades ? (
            <form action="/clients" className="relative w-full sm:w-auto">
              {/* Cercar no desfà l'ordre triat. */}
              {textOrdre ? <input type="hidden" name="ordre" value={textOrdre} /> : null}
              <Cerca className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Cerca per nom o NIF"
                aria-label="Cerca clients"
                className="field !py-2 pl-9 sm:w-[320px]"
              />
            </form>
          ) : null
        }
      />

      {fallada ? (
        <div className="mt-8">
          <AvisConnexio error={fallada} />
        </div>
      ) : dades!.files.length === 0 ? (
        <div className="mt-8">
          <EstatBuit
            titol="Sense resultats"
            text={
              q
                ? `Cap client coincideix amb «${q}». Prova amb el codi, el NIF o la població.`
                : "El fitxer de clients d'aquest exercici no retorna cap fitxa."
            }
          />
        </div>
      ) : (
        <>
          {/* Al telèfon la meitat de columnes no hi són: l'ordre es tria d'un desplegable. */}
          <SelectorOrdre accio="/clients" ocults={q ? { q } : {}} columnes={COLUMNES_CLIENTS_ERP} valor={textOrdre} className="mt-6 md:hidden" />

          {/* Les capçaleres ordenen: ascendent, descendent i després res. */}
          <div className={`${COLUMNES} px-4 pb-2 pt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-muted md:pt-8`}>
            {capcalera("codi", "Codi")}
            {capcalera("client", "Client")}
            <span className="hidden xl:block">{capcalera("nif", "NIF")}</span>
            <span className="hidden md:block">{capcalera("poblacio", "Població")}</span>
            <span className="hidden xl:block">Contacte</span>
            <span className="text-right">{capcalera("estat", "Estat")}</span>
          </div>

          <ul className="card divide-y divide-line overflow-hidden">
            {dades!.files.map((client) => (
              <li key={client.CODCLI}>
                <Link
                  href={`/clients/${client.CODCLI}`}
                  className={`${COLUMNES} items-center px-4 py-3.5 transition hover:bg-parchment/60`}
                >
                  <span className="font-mono text-[13px] text-muted">{String(client.CODCLI).padStart(4, "0")}</span>

                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{client.NOFCLI}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {client.NOCCLI && client.NOCCLI !== client.NOFCLI ? client.NOCCLI : client.NIFCLI}
                    </span>
                  </span>

                  <span className="hidden truncate font-mono text-[13px] text-muted xl:block">{client.NIFCLI}</span>

                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-[14px]">{client.POBCLI || "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted">{client.PROCLI}</span>
                  </span>

                  <span className="hidden min-w-0 xl:block">
                    <span className="block truncate text-[13.5px]">{client.TELCLI || "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted">{client.EMACLI}</span>
                  </span>

                  <span className="text-right">
                    <EstatClientFactusol codi={client.ESTCLI} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {pagines > 1 ? (
            <nav className="mt-5 flex items-center justify-between text-[13.5px]" aria-label="Paginació">
              <span className="text-muted">
                Pàgina {dades!.pagina} de {pagines}
              </span>
              <span className="flex gap-2">
                <PasPagina href={enllacPagina(dades!.pagina - 1)} actiu={dades!.pagina > 1}>
                  Anterior
                </PasPagina>
                <PasPagina href={enllacPagina(dades!.pagina + 1)} actiu={dades!.pagina < pagines}>
                  Següent
                </PasPagina>
              </span>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function PasPagina({ href, actiu, children }: { href: string; actiu: boolean; children: React.ReactNode }) {
  if (!actiu) {
    return <span className="rounded-lg border border-line px-3 py-1.5 text-muted/40">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-lg border border-line bg-white px-3 py-1.5 transition hover:border-ink">
      {children}
    </Link>
  );
}
