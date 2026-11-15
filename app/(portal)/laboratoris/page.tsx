import Link from "next/link";

import { ICONES } from "@/components/Icones";
import { EnllacOrdre } from "@/components/OrdreLlistat";
import { SelectorOrdre } from "@/components/SelectorOrdre";
import { Capcalera, EstatBuit } from "@/components/UI";
import { COLUMNES_LABORATORIS } from "@/domini/llistats-erp";
import { escriuOrdre, llegeixOrdre, seguentOrdre } from "@/domini/ordre-llistat";
import { llistaLaboratoris, type LlistaLaboratoris } from "@/serveis/laboratoris";

import { EstatLaboratori, codiLaboratori } from "./Laboratori";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export const metadata = { title: "Laboratoris · vproof CRM" };

/** Les mateixes columnes que el llistat de clients, perquè les dues pantalles de l'ERP es llegeixin igual. */
const COLUMNES =
  "grid grid-cols-[62px_minmax(0,1fr)_88px] gap-4 md:grid-cols-[76px_minmax(0,1.6fr)_minmax(0,1fr)_88px] xl:grid-cols-[76px_minmax(0,1.8fr)_120px_minmax(0,1fr)_minmax(0,1.2fr)_88px]";

/**
 * Els laboratoris: els proveïdors homologats de l'ERP. A diferència dels
 * clients, no es llegeixen de l'ERP en directe sinó de la còpia que en manté
 * la sincronització a la base de dades, que és on hi pengen les activitats.
 */
export default async function PaginaLaboratoris({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string; ordre?: string }>;
}) {
  await exigeixVeuTot();
  const { q = "", p = "1", ordre: ordreBrut } = await searchParams;
  // L'ordre per columna va a l'adreça (vegeu `domini/ordre-llistat.ts`): es conserva en paginar i en cercar.
  const ordre = llegeixOrdre(ordreBrut, COLUMNES_LABORATORIS);
  const textOrdre = escriuOrdre(ordre);

  let dades: LlistaLaboratoris | null = null;
  let fallada: string | null = null;
  try {
    dades = await llistaLaboratoris({ cerca: q, pagina: Number(p) || 1, ordre });
  } catch (error) {
    fallada = (error as Error).message;
  }

  const Cerca = ICONES.cerca;
  const conservats = { ...(q ? { q } : {}), ...(textOrdre ? { ordre: textOrdre } : {}) };
  const enllacPagina = (numero: number) => `/laboratoris?${new URLSearchParams({ ...conservats, p: String(numero) })}`;
  // Canviar l'ordre torna a la primera pàgina.
  const enllacOrdre = (camp: string) => {
    const nou = escriuOrdre(seguentOrdre(ordre, camp));
    return `/laboratoris?${new URLSearchParams({ ...(q ? { q } : {}), ...(nou ? { ordre: nou } : {}) })}`;
  };
  const capcalera = (camp: string, etiqueta: string) => (
    <EnllacOrdre camp={camp} etiqueta={etiqueta} ordre={ordre} enllac={enllacOrdre(camp)} />
  );
  const pagines = dades ? Math.max(1, Math.ceil(dades.total / dades.perPagina)) : 1;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      <Capcalera
        titol="Laboratoris"
        descripcio={
          dades ? (
            <>
              {dades.total} {dades.total === 1 ? "laboratori" : "laboratoris"}
            </>
          ) : (
            "Els laboratoris de qui es compra"
          )
        }
        accions={
          dades ? (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <form action="/laboratoris" className="relative w-full sm:w-auto">
              {/* Cercar no desfà l'ordre triat. */}
              {textOrdre ? <input type="hidden" name="ordre" value={textOrdre} /> : null}
              <Cerca className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Cerca per nom, NIF o població"
                aria-label="Cerca laboratoris"
                className="field !py-2 pl-9 sm:w-[320px]"
              />
            </form>
            <Link href="/crm?v=proveidors&r=nou" className="btn-compacte">
              + Nou laboratori
            </Link>
            </div>
          ) : null
        }
      />

      {fallada ? (
        <div className="mt-8">
          <EstatBuit titol="No s'han pogut llegir els laboratoris" text={fallada} />
        </div>
      ) : dades!.files.length === 0 ? (
        <div className="mt-8">
          <EstatBuit
            titol="Sense resultats"
            text={
              q
                ? `Cap laboratori coincideix amb «${q}». Prova amb el codi, el NIF o la població.`
                : "Encara no hi ha cap laboratori. Crea'n un amb «+ Nou laboratori»."
            }
          />
        </div>
      ) : (
        <>
          {/* Al telèfon la meitat de columnes no hi són: l'ordre es tria d'un desplegable. */}
          <SelectorOrdre accio="/laboratoris" ocults={q ? { q } : {}} columnes={COLUMNES_LABORATORIS} valor={textOrdre} className="mt-6 md:hidden" />

          {/* Les capçaleres ordenen: ascendent, descendent i després res. */}
          <div className={`${COLUMNES} px-4 pb-2 pt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-muted md:pt-8`}>
            {capcalera("codi", "Codi")}
            {capcalera("laboratori", "Laboratori")}
            <span className="hidden xl:block">{capcalera("nif", "NIF")}</span>
            <span className="hidden md:block">{capcalera("poblacio", "Població")}</span>
            <span className="hidden xl:block">Contacte</span>
            <span className="text-right">{capcalera("estat", "Estat")}</span>
          </div>

          <ul className="card divide-y divide-line overflow-hidden">
            {dades!.files.map((laboratori) => (
              <li key={laboratori.id}>
                <Link
                  href={`/laboratoris/${laboratori.id}`}
                  className={`${COLUMNES} items-center px-4 py-3.5 transition hover:bg-parchment/60`}
                >
                  <span className="font-mono text-[13px] text-muted">{codiLaboratori(laboratori.codi_erp)}</span>

                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{laboratori.nom_comercial ?? "Sense nom"}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {laboratori.rao_social && laboratori.rao_social !== laboratori.nom_comercial ? laboratori.rao_social : laboratori.nif}
                    </span>
                  </span>

                  <span className="hidden truncate font-mono text-[13px] text-muted xl:block">{laboratori.nif}</span>

                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-[14px]">{laboratori.poblacio || "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted">{laboratori.provincia}</span>
                  </span>

                  <span className="hidden min-w-0 xl:block">
                    <span className="block truncate text-[13.5px]">{laboratori.telefon || "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted">{laboratori.correu}</span>
                  </span>

                  <span className="text-right">
                    <EstatLaboratori estat={laboratori.estat} />
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
