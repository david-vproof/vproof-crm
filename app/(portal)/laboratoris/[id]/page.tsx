import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetallArticle } from "@/components/DetallArticle";
import { FotoArticle } from "@/components/FotoArticle";
import { ICONES } from "@/components/Icones";
import { Dada, Etiqueta, EstatBuit, Plafo } from "@/components/UI";
import { dataCurta, percentatge } from "@/lib/format";
import { GALETA_SESSIO, verificaToken } from "@/lib/sessio";
import { articlesDelLaboratori, urlImatge } from "@/serveis/articles";
import { laboratoriPerId } from "@/serveis/laboratoris";
import { llistaRelacionada } from "@/serveis/crm-manteniment";

import { EstatLaboratori, codiLaboratori, tipusLaboratori } from "../Laboratori";
import { exigeixVeuTot } from "@/lib/sessio-actual";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const laboratori = UUID.test(id) ? await laboratoriPerId(id) : null;
    return { title: laboratori ? `${laboratori.nom_comercial ?? "Laboratori"} · Laboratoris` : "Laboratori no trobat" };
  } catch {
    return { title: "Laboratoris · vproof CRM" };
  }
}

/** La base de dades torna els decimals com a text («21.00»). */
function numero(valor: number | string | null) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Com les activitats: si els articles no es poden llegir, la fitxa surt igual. */
async function articlesDe(id: string) {
  try {
    return await articlesDelLaboratori(id);
  } catch {
    return null;
  }
}

/** Les activitats del laboratori no han de tombar la fitxa si la base de dades falla. */
async function activitatsDelLaboratori(id: string) {
  try {
    // Les activitats són de qui les porta, com a la resta del CRM.
    const sessio = await verificaToken((await cookies()).get(GALETA_SESSIO)?.value);
    return await llistaRelacionada("activitats", "laboratori", id, { limit: 20, comercial: sessio?.id ?? null });
  } catch {
    return null;
  }
}

export default async function DetallLaboratori({ params }: { params: Promise<{ id: string }> }) {
  await exigeixVeuTot();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const Enrere = ICONES.enrere;
  const tornar = (
    <Link href="/laboratoris" className="inline-flex items-center gap-1 text-[13.5px] text-muted transition hover:text-ink">
      <Enrere className="size-4" />
      Laboratoris
    </Link>
  );

  let laboratori: Awaited<ReturnType<typeof laboratoriPerId>>;
  let activitats: Awaited<ReturnType<typeof activitatsDelLaboratori>>;
  let articles: Awaited<ReturnType<typeof articlesDe>>;
  try {
    [laboratori, activitats, articles] = await Promise.all([laboratoriPerId(id), activitatsDelLaboratori(id), articlesDe(id)]);
  } catch (error) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
        {tornar}
        <div className="mt-6">
          <EstatBuit titol="No s'ha pogut llegir el laboratori" text={(error as Error).message} />
        </div>
      </div>
    );
  }
  if (!laboratori) notFound();

  const retencio = numero(laboratori.retencio);
  const descompte = numero(laboratori.descompte);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      {tornar}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-muted">{codiLaboratori(laboratori.codi_erp)}</span>
            {laboratori.tipus ? <Etiqueta>{tipusLaboratori(laboratori.tipus)}</Etiqueta> : null}
            <EstatLaboratori estat={laboratori.estat} />
          </div>
          <h1 className="mt-2 font-display text-[34px] leading-[1.15] tracking-[-0.01em]">{laboratori.nom_comercial ?? "Sense nom"}</h1>
          {laboratori.rao_social && laboratori.rao_social !== laboratori.nom_comercial ? (
            <p className="mt-1 text-[14px] text-muted">{laboratori.rao_social}</p>
          ) : null}
        </div>

        <div className="text-right text-[13px] text-muted">
          <Link href={`/crm?v=proveidors&r=${encodeURIComponent(laboratori.id)}`} className="btn-compacte mb-2 inline-flex">
            Edita
          </Link>
          <p>
            Alta <span className="text-ink">{dataCurta(laboratori.data_alta ?? undefined) || "—"}</span>
          </p>
          <p className="mt-1">
            Darrer moviment <span className="text-ink">{dataCurta(laboratori.erp_modificat_el ?? undefined) || "—"}</span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Plafo titol="Identificació">
          <Dada etiqueta="NIF / CIF" valor={laboratori.nif ? <span className="font-mono">{laboratori.nif}</span> : ""} />
          <Dada etiqueta="Raó social" valor={laboratori.rao_social} />
          <Dada etiqueta="Nom comercial" valor={laboratori.nom_comercial} />
          <Dada etiqueta="Tipus" valor={tipusLaboratori(laboratori.tipus)} />
        </Plafo>

        <Plafo titol="Adreça fiscal">
          <Dada etiqueta="Domicili" valor={laboratori.adreca} />
          <Dada etiqueta="Població" valor={[laboratori.codi_postal, laboratori.poblacio].filter(Boolean).join(" · ")} />
          <Dada etiqueta="Província" valor={laboratori.provincia} />
          <Dada etiqueta="País" valor={laboratori.pais} />
        </Plafo>

        <Plafo titol="Contacte">
          <Dada etiqueta="Persona" valor={laboratori.persona_contacte} />
          <Dada
            etiqueta="Telèfon"
            valor={laboratori.telefon ? <a className="hover:text-marca" href={`tel:${laboratori.telefon}`}>{laboratori.telefon}</a> : ""}
          />
          <Dada
            etiqueta="Mòbil"
            valor={laboratori.mobil ? <a className="hover:text-marca" href={`tel:${laboratori.mobil}`}>{laboratori.mobil}</a> : ""}
          />
          <Dada
            etiqueta="Correu"
            valor={laboratori.correu ? <a className="hover:text-marca" href={`mailto:${laboratori.correu}`}>{laboratori.correu}</a> : ""}
          />
          <Dada etiqueta="Web" valor={laboratori.web} />
        </Plafo>

        <Plafo titol="Condicions de compra">
          <Dada etiqueta="Forma de pagament" valor={laboratori.forma_pagament} />
          <Dada etiqueta="Descompte" valor={descompte ? percentatge(descompte) : "Sense descompte"} />
          <Dada etiqueta="Retenció" valor={retencio ? percentatge(retencio) : ""} />
          <Dada etiqueta="Compte comptable" valor={laboratori.compte_comptable ? <span className="font-mono">{laboratori.compte_comptable}</span> : ""} />
        </Plafo>

        {laboratori.iban || laboratori.banc ? (
          <Plafo titol="Dades bancàries">
            <Dada etiqueta="Entitat" valor={laboratori.banc} />
            <Dada etiqueta="IBAN" valor={laboratori.iban ? <span className="font-mono text-[13.5px]">{laboratori.iban}</span> : ""} />
            <Dada etiqueta="BIC" valor={laboratori.bic ? <span className="font-mono text-[13.5px]">{laboratori.bic}</span> : ""} />
          </Plafo>
        ) : null}

        {laboratori.observacions ? (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Observacions</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{laboratori.observacions}</p>
          </section>
        ) : null}

        {laboratori.notes ? (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Notes del portal</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{laboratori.notes}</p>
          </section>
        ) : null}

        {/* Els productes que se li compren: els articles actius que el tenen com a proveïdor habitual. */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Articles{articles ? ` · ${articles.total}` : ""}
          </h2>
          {!articles ? (
            <p className="mt-3 text-[14px] text-muted">No s&apos;han pogut llegir els articles.</p>
          ) : articles.files.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">L&apos;ERP no té cap article actiu amb aquest laboratori com a proveïdor habitual.</p>
          ) : (
            <>
              <ul className="mt-2 divide-y divide-line">
                {articles.files.map((article) => (
                  <li key={article.id}>
                    {/* Com al llistat d'articles: la fila obre la fitxa, amb la foto gran. */}
                    <DetallArticle
                      article={article}
                      petita={urlImatge(article, "petita")}
                      gran={urlImatge(article, "gran")}
                      className="group flex w-full items-center gap-3 py-2"
                    >
                      <FotoArticle
                        petita={urlImatge(article, "petita")}
                        nom={article.nom ?? "Article"}
                        className="size-9 transition group-hover:border-ink"
                      />
                      <span className="w-[76px] shrink-0 truncate font-mono text-[13px] text-muted">{article.codi_erp}</span>
                      <span className="min-w-0 flex-1 truncate text-[14px] transition group-hover:text-marca">{article.nom ?? "Sense nom"}</span>
                      {article.familia ? (
                        <span className="hidden shrink-0 truncate text-[13px] text-muted sm:block sm:max-w-[200px]">{article.familia}</span>
                      ) : null}
                    </DetallArticle>
                  </li>
                ))}
              </ul>
              {articles.total > articles.files.length ? (
                <p className="mt-2 text-[13px] text-muted">
                  N&apos;hi ha {articles.total - articles.files.length} més: cerca&apos;ls a{" "}
                  <Link href={`/productes?q=${encodeURIComponent(laboratori.nom_comercial ?? "")}`} className="text-marca hover:underline">
                    Articles
                  </Link>
                  .
                </p>
              ) : null}
            </>
          )}
        </section>

        {/* El que és només del CRM: les visites i accions en què ha sortit el laboratori. */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Activitats{activitats ? ` · ${activitats.total}` : ""}
          </h2>
          {!activitats ? (
            <p className="mt-3 text-[14px] text-muted">No s&apos;han pogut llegir les activitats.</p>
          ) : activitats.files.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">Encara no hi ha cap activitat amb aquest laboratori.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {activitats.files.map((fila) => {
                const [titol, ...resta] = fila["cel·les"];
                return (
                  <li key={fila.id}>
                    <Link href={`/crm?v=activitats&r=${fila.id}`} className="block py-2.5 transition hover:text-marca">
                      <span className="block truncate text-[14px] font-medium">{titol.buida ? "Sense assumpte" : titol.text}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        {resta.filter((cella) => !cella.buida).map((cella) => cella.text).join(" · ")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
