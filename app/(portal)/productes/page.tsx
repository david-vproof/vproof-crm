import Link from "next/link";

import { FiltresArticles } from "@/components/FiltresArticles";
import { FotoArticle } from "@/components/FotoArticle";
import { EnllacOrdre } from "@/components/OrdreLlistat";
import { PanellArticle } from "@/components/PanellArticle";
import { SelectorOrdre } from "@/components/SelectorOrdre";
import { Capcalera, EstatBuit } from "@/components/UI";
import { filtraArticles, llegeixFiltres, nomDeFormat, nomDeTipus, opcionsDeFiltres, quantsFiltres } from "@/domini/cataleg-articles";
import { CLAUS_ORDRE_ARTICLES, COLUMNES_ARTICLES, NOM_ARTICLE } from "@/domini/llistats-erp";
import { escriuOrdre, llegeixOrdre, ordena, seguentOrdre } from "@/domini/ordre-llistat";
import { catalegArticles, urlImatge, type FitxaArticle } from "@/serveis/articles";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export const metadata = { title: "Productes · vproof CRM" };

const PER_PAGINA = 30;

/**
 * Categoria i espècie surten a partir de la tauleta; prescripció i format, a l'escriptori.
 * Per sota, tot va dins de la cel·la del nom: al telèfon no es rasca de costat.
 */
const COLUMNES =
  "grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,2fr)_120px_minmax(0,1fr)] xl:grid-cols-[minmax(0,2.2fr)_120px_minmax(0,1fr)_110px_80px]";

type Parametres = Record<string, string | string[] | undefined>;

/**
 * El catàleg: els productes actius (`crm_articles`), creats des del portal o
 * portats de l'ERP. Es filtren per les característiques de la fitxa
 * (vegeu `domini/cataleg-articles.ts`), i tocar-ne un n'obre el detall en una
 * columna a la dreta, amb la foto gran.
 */
export default async function PaginaArticles({ searchParams }: { searchParams: Promise<Parametres> }) {
  await exigeixVeuTot();
  const parametres = await searchParams;
  const filtres = llegeixFiltres(parametres);
  // L'ordre per columna viatja amb els filtres (vegeu `domini/ordre-llistat.ts`); sense, per nom.
  const ordre = llegeixOrdre(filtres.ordre, COLUMNES_ARTICLES);
  const text = (clau: string) => {
    const valor = parametres[clau];
    return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
  };

  let tots: FitxaArticle[] | null = null;
  let fallada: string | null = null;
  try {
    tots = await catalegArticles(filtres.ambHistorics ? "tots" : "actius");
  } catch (error) {
    fallada = (error as Error).message;
  }

  /** L'adreça d'ara amb uns quants paràmetres canviats; un valor buit el treu. */
  const adreca = (canvis: Record<string, string>) => {
    const nova = new URLSearchParams();
    for (const [clau, valor] of Object.entries(parametres)) {
      const pla = Array.isArray(valor) ? valor[0] : valor;
      if (pla) nova.set(clau, pla);
    }
    for (const [clau, valor] of Object.entries(canvis)) {
      if (valor) nova.set(clau, valor);
      else nova.delete(clau);
    }
    const consulta = nova.toString();
    return consulta ? `/productes?${consulta}` : "/productes";
  };

  if (!tots) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Capcalera titol="Productes" descripcio="El catàleg de productes sanitaris veterinaris" />
        <div className="mt-8">
          <EstatBuit titol="No s'han pogut llegir els productes" text={fallada ?? ""} />
        </div>
      </div>
    );
  }

  const trobats = ordena(filtraArticles(tots, filtres), ordre, CLAUS_ORDRE_ARTICLES, NOM_ARTICLE);
  const opcions = opcionsDeFiltres(tots, filtres);
  // Canviar l'ordre torna a la primera pàgina i tanca l'article obert, com un filtre.
  const capcalera = (camp: string, etiqueta: string) => (
    <EnllacOrdre
      camp={camp}
      etiqueta={etiqueta}
      ordre={ordre}
      enllac={adreca({ ordre: escriuOrdre(seguentOrdre(ordre, camp)), p: "", a: "" })}
    />
  );
  const pagines = Math.max(1, Math.ceil(trobats.length / PER_PAGINA));
  const pagina = Math.min(Math.max(1, Number(text("p")) || 1), pagines);
  const files = trobats.slice((pagina - 1) * PER_PAGINA, pagina * PER_PAGINA);
  // L'article obert es busca entre tots, no entre els filtrats: un enllaç guardat l'ha d'obrir igual.
  const obert = text("a") ? (tots.find((article) => article.id === text("a")) ?? null) : null;
  const filtrant = quantsFiltres(filtres) > 0 || filtres.cerca !== "";

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Capcalera
        titol="Productes"
        descripcio={
          filtres.ambHistorics
            ? `${trobats.length} de ${tots.length} productes, històrics inclosos`
            : filtrant
              ? `${trobats.length} de ${tots.length} productes actius`
              : `${tots.length} ${tots.length === 1 ? "producte actiu" : "productes actius"}`
        }
        accions={
          <Link href="/crm?v=productes&r=nou" className="btn-compacte">
            + Nou producte
          </Link>
        }
      />

      <FiltresArticles filtres={filtres} opcions={opcions} />

      {files.length === 0 ? (
        <div className="mt-8">
          <EstatBuit
            titol="Sense resultats"
            text={
              filtrant
                ? "Cap producte compleix tots els filtres. Treu-ne algun o prova una altra cerca."
                : "Encara no hi ha cap producte. Crea'n un amb «+ Nou producte»; quan l'ERP estigui connectat, n'arribaran sols."
            }
          />
        </div>
      ) : (
        <>
          {/* Al telèfon no hi ha columnes: l'ordre es tria d'un desplegable. */}
          <SelectorOrdre
            accio="/productes"
            ocults={{ q: filtres.cerca, foto: filtres.ambFoto ? "1" : "", historics: filtres.ambHistorics ? "1" : "", ...filtres.tria }}
            columnes={COLUMNES_ARTICLES}
            valor={escriuOrdre(ordre)}
            className="mt-5 md:hidden"
          />

          {/* Les capçaleres ordenen: ascendent, descendent i després res. */}
          <div className={`${COLUMNES} px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-muted md:pt-6`}>
            {capcalera("article", "Producte")}
            <span className="hidden md:block">{capcalera("tipus", "Categoria")}</span>
            <span className="hidden md:block">{capcalera("especie", "Espècie")}</span>
            <span className="hidden xl:block">{capcalera("prescripcio", "Prescripció")}</span>
            <span className="hidden xl:block">{capcalera("format", "Format")}</span>
          </div>

          <ul className="card divide-y divide-line overflow-hidden">
            {files.map((article) => {
              const actiu = obert?.id === article.id;
              const laboratori = article.laboratori?.nom_comercial ?? null;
              const principiActiu = article.garantia;
              const prescripcio = article.camp_programable_4;
              const format = nomDeFormat(article.camp_programable_5);
              return (
                <li key={article.id}>
                  <Link
                    href={adreca({ a: article.id })}
                    scroll={false}
                    aria-current={actiu ? "true" : undefined}
                    className={`${COLUMNES} group items-center px-4 py-3 transition ${actiu ? "bg-marca-clar/50" : "hover:bg-parchment/60"}`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FotoArticle petita={urlImatge(article, "petita")} nom={article.nom ?? "Producte"} className="size-11" />
                      <span className="min-w-0">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[14.5px] font-medium transition group-hover:text-marca">{article.nom ?? "Sense nom"}</span>
                          {article.historic ? <EtiquetaHistoric /> : null}
                        </span>
                        {/* Al telèfon no hi ha columnes: el que falta va a sota del nom. */}
                        <span className="block truncate text-[12.5px] text-muted md:hidden">
                          {[nomDeTipus(article.familia), laboratori, article.camp_programable_1].filter(Boolean).join(" · ")}
                        </span>
                        <span className="hidden truncate text-[12.5px] text-muted md:block xl:hidden">
                          {[laboratori, principiActiu, format].filter(Boolean).join(" · ")}
                        </span>
                        <span className="hidden truncate text-[12.5px] text-muted xl:block">{[laboratori, principiActiu].filter(Boolean).join(" · ")}</span>
                      </span>
                    </span>
                    <span className="hidden truncate text-[13.5px] md:block">{nomDeTipus(article.familia) ?? "—"}</span>
                    <span className="hidden min-w-0 md:block">
                      <span className="block truncate text-[13.5px]">{article.camp_programable_1 || "—"}</span>
                      <span className="block truncate text-[12px] text-muted">{article.camp_programable_2}</span>
                    </span>
                    <span className="hidden truncate text-[13.5px] xl:block">{prescripcio || "—"}</span>
                    <span className="hidden truncate text-[13px] text-muted xl:block">{format || "—"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {pagines > 1 ? (
            <nav className="mt-5 flex items-center justify-between text-[13.5px]" aria-label="Paginació">
              <span className="text-muted">
                Pàgina {pagina} de {pagines}
              </span>
              <span className="flex gap-2">
                <PasPagina href={adreca({ p: String(pagina - 1), a: "" })} actiu={pagina > 1}>
                  Anterior
                </PasPagina>
                <PasPagina href={adreca({ p: String(pagina + 1), a: "" })} actiu={pagina < pagines}>
                  Següent
                </PasPagina>
              </span>
            </nav>
          ) : null}
        </>
      )}

      {obert ? <PanellArticle article={obert} tancar={adreca({ a: "" })} /> : null}
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

/** La marca d'un article històric: descatalogat o no disponible a l'ERP. */
function EtiquetaHistoric() {
  return (
    <span className="shrink-0 rounded bg-parchment px-1.5 py-px text-[11px] text-muted" title="Descatalogat o no disponible a l'ERP">
      Històric
    </span>
  );
}
