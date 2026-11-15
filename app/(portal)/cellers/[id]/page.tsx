import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DetallArticle } from "@/components/DetallArticle";
import { FotoArticle } from "@/components/FotoArticle";
import { ICONES } from "@/components/Icones";
import { Dada, Etiqueta, EstatBuit, Plafo } from "@/components/UI";
import { dataCurta, percentatge } from "@/lib/format";
import { GALETA_SESSIO, verificaToken } from "@/lib/sessio";
import { articlesDelCeller, urlImatge } from "@/serveis/articles";
import { cellerPerId } from "@/serveis/cellers";
import { llistaRelacionada } from "@/serveis/crm-manteniment";

import { EstatCeller, codiCeller, tipusCeller } from "../Celler";
import { exigeixVeuTot } from "@/lib/sessio-actual";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const celler = UUID.test(id) ? await cellerPerId(id) : null;
    return { title: celler ? `${celler.nom_comercial ?? "Celler"} · Cellers` : "Celler no trobat" };
  } catch {
    return { title: "Cellers · Wine Backend" };
  }
}

/** Directus torna els decimals com a text («21.00»). */
function numero(valor: number | string | null) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Com les activitats: si els articles no es poden llegir, la fitxa surt igual. */
async function articlesDe(id: string) {
  try {
    return await articlesDelCeller(id);
  } catch {
    return null;
  }
}

/** Les activitats del celler no han de tombar la fitxa si Directus falla. */
async function activitatsDelCeller(id: string) {
  try {
    // Les activitats són de qui les porta, com a la resta del CRM.
    const sessio = await verificaToken((await cookies()).get(GALETA_SESSIO)?.value);
    return await llistaRelacionada("activitats", "celler", id, { limit: 20, comercial: sessio?.id ?? null });
  } catch {
    return null;
  }
}

export default async function DetallCeller({ params }: { params: Promise<{ id: string }> }) {
  await exigeixVeuTot();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const Enrere = ICONES.enrere;
  const tornar = (
    <Link href="/cellers" className="inline-flex items-center gap-1 text-[13.5px] text-muted transition hover:text-ink">
      <Enrere className="size-4" />
      Cellers
    </Link>
  );

  let celler: Awaited<ReturnType<typeof cellerPerId>>;
  let activitats: Awaited<ReturnType<typeof activitatsDelCeller>>;
  let articles: Awaited<ReturnType<typeof articlesDe>>;
  try {
    [celler, activitats, articles] = await Promise.all([cellerPerId(id), activitatsDelCeller(id), articlesDe(id)]);
  } catch (error) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
        {tornar}
        <div className="mt-6">
          <EstatBuit titol="No s'ha pogut llegir el celler" text={(error as Error).message} />
        </div>
      </div>
    );
  }
  if (!celler) notFound();

  const retencio = numero(celler.retencio);
  const descompte = numero(celler.descompte);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      {tornar}

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-muted">{codiCeller(celler.codi_erp)}</span>
            {celler.tipus ? <Etiqueta>{tipusCeller(celler.tipus)}</Etiqueta> : null}
            <EstatCeller estat={celler.estat} />
          </div>
          <h1 className="mt-2 font-display text-[34px] leading-[1.15] tracking-[-0.01em]">{celler.nom_comercial ?? "Sense nom"}</h1>
          {celler.rao_social && celler.rao_social !== celler.nom_comercial ? (
            <p className="mt-1 text-[14px] text-muted">{celler.rao_social}</p>
          ) : null}
        </div>

        <div className="text-right text-[13px] text-muted">
          <p>
            Alta <span className="text-ink">{dataCurta(celler.data_alta ?? undefined) || "—"}</span>
          </p>
          <p className="mt-1">
            Darrer moviment <span className="text-ink">{dataCurta(celler.erp_modificat_el ?? undefined) || "—"}</span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Plafo titol="Identificació">
          <Dada etiqueta="NIF / CIF" valor={celler.nif ? <span className="font-mono">{celler.nif}</span> : ""} />
          <Dada etiqueta="Raó social" valor={celler.rao_social} />
          <Dada etiqueta="Nom comercial" valor={celler.nom_comercial} />
          <Dada etiqueta="Tipus" valor={tipusCeller(celler.tipus)} />
        </Plafo>

        <Plafo titol="Adreça fiscal">
          <Dada etiqueta="Domicili" valor={celler.adreca} />
          <Dada etiqueta="Població" valor={[celler.codi_postal, celler.poblacio].filter(Boolean).join(" · ")} />
          <Dada etiqueta="Província" valor={celler.provincia} />
          <Dada etiqueta="País" valor={celler.pais} />
        </Plafo>

        <Plafo titol="Contacte">
          <Dada etiqueta="Persona" valor={celler.persona_contacte} />
          <Dada
            etiqueta="Telèfon"
            valor={celler.telefon ? <a className="hover:text-wine" href={`tel:${celler.telefon}`}>{celler.telefon}</a> : ""}
          />
          <Dada
            etiqueta="Mòbil"
            valor={celler.mobil ? <a className="hover:text-wine" href={`tel:${celler.mobil}`}>{celler.mobil}</a> : ""}
          />
          <Dada
            etiqueta="Correu"
            valor={celler.correu ? <a className="hover:text-wine" href={`mailto:${celler.correu}`}>{celler.correu}</a> : ""}
          />
          <Dada etiqueta="Web" valor={celler.web} />
        </Plafo>

        <Plafo titol="Condicions de compra">
          <Dada etiqueta="Forma de pagament" valor={celler.forma_pagament} />
          <Dada etiqueta="Descompte" valor={descompte ? percentatge(descompte) : "Sense descompte"} />
          <Dada etiqueta="Retenció" valor={retencio ? percentatge(retencio) : ""} />
          <Dada etiqueta="Compte comptable" valor={celler.compte_comptable ? <span className="font-mono">{celler.compte_comptable}</span> : ""} />
        </Plafo>

        {celler.iban || celler.banc ? (
          <Plafo titol="Dades bancàries">
            <Dada etiqueta="Entitat" valor={celler.banc} />
            <Dada etiqueta="IBAN" valor={celler.iban ? <span className="font-mono text-[13.5px]">{celler.iban}</span> : ""} />
            <Dada etiqueta="BIC" valor={celler.bic ? <span className="font-mono text-[13.5px]">{celler.bic}</span> : ""} />
          </Plafo>
        ) : null}

        {celler.observacions ? (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Observacions</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{celler.observacions}</p>
          </section>
        ) : null}

        {celler.notes ? (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Notes del portal</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed">{celler.notes}</p>
          </section>
        ) : null}

        {/* Els vins que se li compren: els articles actius que el tenen com a proveïdor habitual. */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Articles{articles ? ` · ${articles.total}` : ""}
          </h2>
          {!articles ? (
            <p className="mt-3 text-[14px] text-muted">No s&apos;han pogut llegir els articles.</p>
          ) : articles.files.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">FactuSol no té cap article actiu amb aquest celler com a proveïdor habitual.</p>
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
                      <span className="min-w-0 flex-1 truncate text-[14px] transition group-hover:text-wine">{article.nom ?? "Sense nom"}</span>
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
                  <Link href={`/articles?q=${encodeURIComponent(celler.nom_comercial ?? "")}`} className="text-wine hover:underline">
                    Articles
                  </Link>
                  .
                </p>
              ) : null}
            </>
          )}
        </section>

        {/* El que és només del CRM: les visites i accions en què ha sortit el celler. */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Activitats{activitats ? ` · ${activitats.total}` : ""}
          </h2>
          {!activitats ? (
            <p className="mt-3 text-[14px] text-muted">No s&apos;han pogut llegir les activitats.</p>
          ) : activitats.files.length === 0 ? (
            <p className="mt-3 text-[14px] text-muted">Encara no hi ha cap activitat amb aquest celler.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {activitats.files.map((fila) => {
                const [titol, ...resta] = fila["cel·les"];
                return (
                  <li key={fila.id}>
                    <Link href={`/crm?v=activitats&r=${fila.id}`} className="block py-2.5 transition hover:text-wine">
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
