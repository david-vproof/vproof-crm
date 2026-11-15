import Link from "next/link";

import { ICONES } from "@/components/Icones";
import { EnllacOrdre } from "@/components/OrdreLlistat";
import { SelectorOrdre } from "@/components/SelectorOrdre";
import { Capcalera, EstatBuit } from "@/components/UI";
import { COLUMNES_CELLERS } from "@/domini/llistats-erp";
import { escriuOrdre, llegeixOrdre, seguentOrdre } from "@/domini/ordre-llistat";
import { llistaCellers, type LlistaCellers } from "@/serveis/cellers";

import { EstatCeller, codiCeller } from "./Celler";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export const metadata = { title: "Cellers · Wine Backend" };

/** Les mateixes columnes que el llistat de clients, perquè les dues pantalles de l'ERP es llegeixin igual. */
const COLUMNES =
  "grid grid-cols-[62px_minmax(0,1fr)_88px] gap-4 md:grid-cols-[76px_minmax(0,1.6fr)_minmax(0,1fr)_88px] xl:grid-cols-[76px_minmax(0,1.8fr)_120px_minmax(0,1fr)_minmax(0,1.2fr)_88px]";

/**
 * Els cellers: els proveïdors homologats de FactuSol. A diferència dels
 * clients, no es llegeixen de l'ERP en directe sinó de la còpia que en manté
 * la sincronització a Directus, que és on hi pengen les activitats.
 */
export default async function PaginaCellers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string; ordre?: string }>;
}) {
  await exigeixVeuTot();
  const { q = "", p = "1", ordre: ordreBrut } = await searchParams;
  // L'ordre per columna va a l'adreça (vegeu `domini/ordre-llistat.ts`): es conserva en paginar i en cercar.
  const ordre = llegeixOrdre(ordreBrut, COLUMNES_CELLERS);
  const textOrdre = escriuOrdre(ordre);

  let dades: LlistaCellers | null = null;
  let fallada: string | null = null;
  try {
    dades = await llistaCellers({ cerca: q, pagina: Number(p) || 1, ordre });
  } catch (error) {
    fallada = (error as Error).message;
  }

  const Cerca = ICONES.cerca;
  const conservats = { ...(q ? { q } : {}), ...(textOrdre ? { ordre: textOrdre } : {}) };
  const enllacPagina = (numero: number) => `/cellers?${new URLSearchParams({ ...conservats, p: String(numero) })}`;
  // Canviar l'ordre torna a la primera pàgina.
  const enllacOrdre = (camp: string) => {
    const nou = escriuOrdre(seguentOrdre(ordre, camp));
    return `/cellers?${new URLSearchParams({ ...(q ? { q } : {}), ...(nou ? { ordre: nou } : {}) })}`;
  };
  const capcalera = (camp: string, etiqueta: string) => (
    <EnllacOrdre camp={camp} etiqueta={etiqueta} ordre={ordre} enllac={enllacOrdre(camp)} />
  );
  const pagines = dades ? Math.max(1, Math.ceil(dades.total / dades.perPagina)) : 1;

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      <Capcalera
        titol="Cellers"
        descripcio={
          dades ? (
            <>
              {dades.total} {dades.total === 1 ? "celler homologat" : "cellers homologats"} a FactuSol
            </>
          ) : (
            "Proveïdors homologats de l'ERP"
          )
        }
        accions={
          dades ? (
            <form action="/cellers" className="relative w-full sm:w-auto">
              {/* Cercar no desfà l'ordre triat. */}
              {textOrdre ? <input type="hidden" name="ordre" value={textOrdre} /> : null}
              <Cerca className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Cerca per nom, NIF o població"
                aria-label="Cerca cellers"
                className="field !py-2 pl-9 sm:w-[320px]"
              />
            </form>
          ) : null
        }
      />

      {fallada ? (
        <div className="mt-8">
          <EstatBuit titol="No s'han pogut llegir els cellers" text={fallada} />
        </div>
      ) : dades!.files.length === 0 ? (
        <div className="mt-8">
          <EstatBuit
            titol="Sense resultats"
            text={
              q
                ? `Cap celler coincideix amb «${q}». Prova amb el codi, el NIF o la població.`
                : "Encara no hi ha cap celler. Arribaran amb la propera sincronització amb FactuSol."
            }
          />
        </div>
      ) : (
        <>
          {/* Al telèfon la meitat de columnes no hi són: l'ordre es tria d'un desplegable. */}
          <SelectorOrdre accio="/cellers" ocults={q ? { q } : {}} columnes={COLUMNES_CELLERS} valor={textOrdre} className="mt-6 md:hidden" />

          {/* Les capçaleres ordenen: ascendent, descendent i després res. */}
          <div className={`${COLUMNES} px-4 pb-2 pt-6 text-[11px] font-medium uppercase tracking-[0.12em] text-muted md:pt-8`}>
            {capcalera("codi", "Codi")}
            {capcalera("celler", "Celler")}
            <span className="hidden xl:block">{capcalera("nif", "NIF")}</span>
            <span className="hidden md:block">{capcalera("poblacio", "Població")}</span>
            <span className="hidden xl:block">Contacte</span>
            <span className="text-right">{capcalera("estat", "Estat")}</span>
          </div>

          <ul className="card divide-y divide-line overflow-hidden">
            {dades!.files.map((celler) => (
              <li key={celler.id}>
                <Link
                  href={`/cellers/${celler.id}`}
                  className={`${COLUMNES} items-center px-4 py-3.5 transition hover:bg-parchment/60`}
                >
                  <span className="font-mono text-[13px] text-muted">{codiCeller(celler.codi_erp)}</span>

                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium">{celler.nom_comercial ?? "Sense nom"}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {celler.rao_social && celler.rao_social !== celler.nom_comercial ? celler.rao_social : celler.nif}
                    </span>
                  </span>

                  <span className="hidden truncate font-mono text-[13px] text-muted xl:block">{celler.nif}</span>

                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-[14px]">{celler.poblacio || "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted">{celler.provincia}</span>
                  </span>

                  <span className="hidden min-w-0 xl:block">
                    <span className="block truncate text-[13.5px]">{celler.telefon || "—"}</span>
                    <span className="block truncate text-[12.5px] text-muted">{celler.correu}</span>
                  </span>

                  <span className="text-right">
                    <EstatCeller estat={celler.estat} />
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
