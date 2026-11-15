"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ICONES } from "@/components/Icones";
import { VistaPdf } from "@/components/VistaPdf";
import type { ClientOLead } from "@/domini/cistella-productes";
import { ORDRES_DE_FULLA, type OrdreDeFulla, type ProducteDeFulla } from "@/domini/fulla-productes";

type Tarifa = { codi: number; nom: string | null; ivaInclos: boolean };

/** El que la ruta dona en JSON per a la revisió: la fulla tal com la faria l'ERP, sense fotos. */
type Revisio = {
  titol: string;
  destinatari: string | null;
  data: string | null;
  productes: ProducteDeFulla[];
  tarifa: Tarifa | null;
  avisos: string[];
};

/** El que el comercial retoca de cada producte, tal com ho escriu: s'envia tal qual i el servidor ho llegeix. */
type Ajust = { preu: string; descompte: string; observacions: string };

type Estat =
  | { fase: "carregant" }
  | { fase: "error"; missatge: string }
  | { fase: "revisio"; revisio: Revisio }
  | { fase: "fent" ; revisio: Revisio }
  | { fase: "llesta"; revisio: Revisio; url: string; fitxer: string; blob: Blob; avisos: string[] };

/** «Tarifa 2 · Venda al major», com la diu l'ERP però sense majúscules cridaneres. */
function nomDeTarifa(tarifa: Tarifa) {
  // l'ERP les anomena «TARIFA VENDA AL MAJOR»: el mot «tarifa» ja hi és al davant.
  const nom = (tarifa.nom ?? "").trim().replace(/^tarifa\s+/i, "");
  const bonic = nom ? nom.charAt(0).toLocaleUpperCase("ca") + nom.slice(1).toLocaleLowerCase("ca") : "";
  return `Tarifa ${tarifa.codi}${bonic ? ` · ${bonic}` : ""}`;
}

/** El preu com s'escriu al camp: dos decimals i coma, com a la fulla. */
const preuEscrit = (preu: number | null) => (preu === null ? "" : preu.toFixed(2).replace(".", ","));
const descompteEscrit = (descompte: number | null) => (descompte ? String(descompte).replace(".", ",") : "");

function ajustosInicials(productes: ProducteDeFulla[]): Record<string, Ajust> {
  return Object.fromEntries(
    productes.map((producte) => [producte.id, { preu: preuEscrit(producte.preu), descompte: descompteEscrit(producte.descompte), observacions: producte.observacions ?? "" }]),
  );
}

/**
 * Els camps en tornar a llegir la fulla: al preu i al descompte hi mana el
 * que diu l'ERP ara (un altre client és una altra tarifa), i només es
 * conserva el que s'hi havia escrit a mà si l'ERP continua dient el mateix
 * que abans. Les observacions escrites es conserven sempre.
 */
function ajustosRefets(
  productes: ProducteDeFulla[],
  previs: Record<string, Ajust>,
  inicialsPrevis: Record<string, Ajust>,
): Record<string, Ajust> {
  const nous = ajustosInicials(productes);
  const conserva = (camp: keyof Ajust, previ: Ajust, inicial: Ajust, nou: Ajust) =>
    previ[camp] !== inicial[camp] && (camp === "observacions" || nou[camp] === inicial[camp]) ? previ[camp] : nou[camp];
  return Object.fromEntries(
    productes.map((producte) => {
      const nou = nous[producte.id];
      const previ = previs[producte.id];
      const inicial = inicialsPrevis[producte.id];
      if (!previ || !inicial) return [producte.id, nou];
      return [
        producte.id,
        {
          preu: conserva("preu", previ, inicial, nou),
          descompte: conserva("descompte", previ, inicial, nou),
          observacions: conserva("observacions", previ, inicial, nou),
        },
      ];
    }),
  );
}

async function errorDe(resposta: Response) {
  const cos = (await resposta.json().catch(() => ({}))) as { error?: string };
  return new Error(cos.error ?? `El servidor ha respost ${resposta.status}.`);
}

/** Un client (o lead) del selector: l'id, el nom i si és un lead. */
export type ClientDeFulla = ClientOLead;

/**
 * El botó de la fulla de productes i el seu modal. Va en dos temps: primer la
 * revisió, en web, amb els productes que hi ha triats ara mateix (encara que no
 * s'hagin desat) i els preus que l'ERP posaria al client; aquí el
 * comercial pot posar un preu a mà, un descompte o unes observacions per a
 * cada producte. Després, la fulla en PDF amb aquests retocs, que es mira aquí
 * mateix, es descarrega, s'obre sencera o, al telèfon, es comparteix.
 * Els retocs no es desen enlloc: són per a aquesta fulla. Els productes van per
 * color i preu, com la fulla de l'empresa, o tal com s'han triat.
 *
 * Es treu de dos llocs:
 * - D'una activitat (`activitat`): per al seu client, amb la seva tarifa.
 *   És dins del formulari de l'activitat: els camps del modal no tenen `name`,
 *   perquè no viatgin amb el formulari, i el retorn no l'envia.
 * - Del selector de productes (`clients`): sense ningú va sense preus, que sense
 *   client no hi ha tarifa; amb un, amb la seva tarifa (un lead encara no en
 *   té: amb la de venda al major); amb més d'un, una fulla per cadascun,
 *   triant-lo al modal.
 */
export function BotoFullaProductes({
  activitat,
  clients,
  productes,
  className = "mt-2",
}: {
  /** L'activitat de qui és la fulla. Null: encara no és desada. */
  activitat?: string | null;
  /** Des del selector: els clients triats, cap, un o més. */
  clients?: ClientDeFulla[];
  productes: string[];
  className?: string;
}) {
  const desDeActivitat = activitat !== undefined;
  const llistaClients = clients ?? [];
  // La llista arriba nova a cada pintada del formulari: el que compta és quins productes són, no l'objecte.
  const idsProductes = productes.join(",");
  const dialeg = useRef<HTMLDialogElement>(null);
  const tocaFons = useRef(false);
  const [obert, setObert] = useState(false);
  const [ambPreus, setAmbPreus] = useState(true);
  const [ordre, setOrdre] = useState<OrdreDeFulla>("color");
  const [estat, setEstat] = useState<Estat>({ fase: "carregant" });
  const [ajustos, setAjustos] = useState<Record<string, Ajust>>({});
  /** El que l'ERP va dir a l'última lectura: per saber què s'ha retocat a mà. */
  const inicials = useRef<Record<string, Ajust>>({});
  const [potCompartir, setPotCompartir] = useState(false);
  /** Des del selector amb més d'un client: per a quin es fa la fulla ara. */
  const [clientTriat, setClientTriat] = useState("");
  const urlActual = useRef("");

  // Un sol client és el de la fulla; amb més d'un es comença pel primer i es tria al modal.
  const client = llistaClients.find((c) => c.id === clientTriat) ?? llistaClients[0] ?? null;
  // Sense client no hi ha tarifa: la fulla va sense preus.
  const potDurPreus = desDeActivitat || client !== null;
  const preusDemanats = ambPreus && potDurPreus;

  const base = desDeActivitat ? `/api/crm/activitats/${activitat}/fulla-productes` : "/api/crm/fulla-productes";
  const adreca = useCallback(
    (extra: Record<string, string> = {}) => {
      const parametres = new URLSearchParams({ productes: idsProductes, ...extra });
      if (!preusDemanats) parametres.set("preus", "0");
      parametres.set("ordre", ordre);
      if (!desDeActivitat && client) parametres.set(client.lead ? "lead" : "client", client.id);
      return `${base}?${parametres}`;
    },
    [base, idsProductes, preusDemanats, ordre, desDeActivitat, client],
  );

  useEffect(() => {
    const element = dialeg.current;
    if (!element) return;
    if (obert && !element.open) element.showModal();
    if (!obert && element.open) element.close();
  }, [obert]);

  // En obrir, i a cada canvi d'opcions (preus, ordre, client), es tornen a llegir les dades per revisar-les.
  useEffect(() => {
    if (!obert || (desDeActivitat && !activitat)) return;
    let viu = true;
    const espera = setTimeout(async () => {
      setEstat({ fase: "carregant" });
      try {
        const resposta = await fetch(adreca({ format: "json" }), { cache: "no-store" });
        if (!resposta.ok) throw await errorDe(resposta);
        const revisio = (await resposta.json()) as Revisio;
        if (!viu) return;
        // Al camp hi va el preu de l'ERP d'ara; només es conserva el que s'hi havia retocat a mà.
        const anteriors = inicials.current;
        inicials.current = ajustosInicials(revisio.productes);
        setAjustos((previs) => ajustosRefets(revisio.productes, previs, anteriors));
        setEstat({ fase: "revisio", revisio });
      } catch (error) {
        if (viu) setEstat({ fase: "error", missatge: (error as Error).message });
      }
    }, 150);
    return () => {
      viu = false;
      clearTimeout(espera);
    };
  }, [obert, activitat, desDeActivitat, adreca]);

  // L'adreça del PDF a la memòria del navegador es deixa anar quan ja no es mira.
  useEffect(() => {
    const url = estat.fase === "llesta" ? estat.url : "";
    urlActual.current = url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [estat]);

  useEffect(() => {
    if (estat.fase !== "llesta") return;
    const fitxer = new File([estat.blob], estat.fitxer, { type: "application/pdf" });
    setPotCompartir(typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [fitxer] })));
  }, [estat]);

  const retoca = (id: string, canvi: Partial<Ajust>) =>
    setAjustos((previs) => ({ ...previs, [id]: { ...previs[id], ...canvi } }));

  async function generaPdf() {
    if (estat.fase !== "revisio" && estat.fase !== "llesta") return;
    const { revisio } = estat;
    setEstat({ fase: "fent", revisio });
    try {
      const resposta = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ambPreus: preusDemanats,
          ordre,
          ...(desDeActivitat ? {} : client?.lead ? { lead: client.id } : { client: client?.id ?? null }),
          productes: revisio.productes.map((producte) => ({ id: producte.id, ...(ajustos[producte.id] ?? { preu: "", descompte: "", observacions: "" }) })),
        }),
      });
      if (!resposta.ok) throw await errorDe(resposta);
      const blob = await resposta.blob();
      const avisos = JSON.parse(decodeURIComponent(resposta.headers.get("X-Avisos") ?? "%5B%5D")) as string[];
      const fitxer = decodeURIComponent(resposta.headers.get("X-Fitxer") ?? "Productes.pdf");
      setEstat({ fase: "llesta", revisio, url: URL.createObjectURL(blob), fitxer, blob, avisos });
    } catch (error) {
      setEstat({ fase: "error", missatge: (error as Error).message });
    }
  }

  async function comparteix() {
    if (estat.fase !== "llesta") return;
    const fitxer = new File([estat.blob], estat.fitxer, { type: "application/pdf" });
    try {
      await navigator.share({ files: [fitxer], title: estat.fitxer.replace(/\.pdf$/, "") });
    } catch {
      // Tancar el full de compartir no és cap error.
    }
  }

  if (productes.length === 0) return null;
  if (desDeActivitat && !activitat) {
    return <p className="mt-1.5 text-[12px] text-muted">Desa l&apos;activitat per treure&apos;n la fulla de productes en PDF.</p>;
  }

  const Tancar = ICONES.tancar;
  const boto = "inline-flex items-center rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink";
  const revisio = "revisio" in estat ? estat.revisio : null;
  const avisos = estat.fase === "llesta" ? estat.avisos : revisio?.avisos ?? [];

  return (
    <>
      <button type="button" onClick={() => setObert(true)} className={`${className} ${boto}`}>
        Fulla de productes (PDF)
      </button>

      <dialog
        ref={dialeg}
        aria-label="Fulla de productes"
        onClose={() => setObert(false)}
        onPointerDown={(e) => {
          tocaFons.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (tocaFons.current && e.target === e.currentTarget) setObert(false);
        }}
        // «hidden open:flex» i no «flex»: un display propi guanya al del navegador i el diàleg tancat quedaria pintat.
        className="m-auto hidden max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[1040px] flex-col overflow-hidden rounded-xl bg-cream p-0 text-ink shadow-2xl backdrop:bg-[rgba(23,16,15,0.5)] open:flex"
      >
        {obert ? (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.08em] text-muted">
                  {estat.fase === "llesta" ? "Fulla de productes" : "Abans de fer la fulla"}
                </p>
                <h2 className="font-display text-[20px] leading-tight">
                  {estat.fase === "llesta" ? "Fulla de productes" : "Revisa els productes"}
                  {revisio?.destinatari ? <span className="text-muted"> · {revisio.destinatari}</span> : null}
                </h2>
                {!desDeActivitat && llistaClients.length > 1 ? (
                  // Més d'un client triat: la fulla és d'un de sol, amb la seva tarifa. Es fan d'una en una.
                  <label className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                    Per a
                    <select
                      value={client?.id ?? ""}
                      disabled={estat.fase === "fent"}
                      onChange={(e) => setClientTriat(e.target.value)}
                      className="field-compacte w-auto max-w-full"
                    >
                      {llistaClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.text}
                        </option>
                      ))}
                    </select>
                    <span>{llistaClients.length} clients triats: una fulla per client.</span>
                  </label>
                ) : null}
                {!desDeActivitat && llistaClients.length === 0 ? (
                  <p className="mt-1 text-[12.5px] text-muted">Sense cap client triat la fulla va sense preus: no hi ha tarifa.</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setObert(false)}
                aria-label="Tanca"
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted transition hover:text-ink"
              >
                <Tancar className="size-[18px]" />
              </button>
            </header>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 text-[13px]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={preusDemanats}
                  disabled={estat.fase === "fent" || !potDurPreus}
                  onChange={(e) => setAmbPreus(e.target.checked)}
                  className="size-4 accent-marca"
                />
                Amb preus
              </label>
              <label className="flex items-center gap-2">
                Ordre
                <select
                  value={ordre}
                  disabled={estat.fase === "fent"}
                  onChange={(e) => setOrdre(e.target.value as OrdreDeFulla)}
                  className="field-compacte w-auto"
                >
                  {ORDRES_DE_FULLA.map((opcio) => (
                    <option key={opcio.valor} value={opcio.valor}>
                      {opcio.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              {ordre === "color" && !potDurPreus && revisio?.tarifa ? (
                <span className="text-[12.5px] text-muted">
                  Sense client, dins de cada color s&apos;ordenen pel preu de la {nomDeTarifa(revisio.tarifa)}, que no surt a la fulla.
                </span>
              ) : null}
              {preusDemanats && revisio?.tarifa ? (
                <span className="text-[12.5px] text-muted">
                  {client?.lead
                    ? <>Un lead encara no té condicions pròpies: preus de l&apos;ERP de la {nomDeTarifa(revisio.tarifa)}.</>
                    : <>Preus de l&apos;ERP per a aquest client: {nomDeTarifa(revisio.tarifa)}, amb les seves condicions especials i el seu descompte.</>}
                </span>
              ) : null}
              <span className="flex flex-1 flex-wrap justify-end gap-2">
                {estat.fase === "revisio" ? (
                  <button type="button" onClick={generaPdf} className="btn-compacte">
                    Genera el PDF
                  </button>
                ) : null}
                {estat.fase === "fent" ? (
                  <button type="button" disabled className="btn-compacte">
                    Fent la fulla…
                  </button>
                ) : null}
                {estat.fase === "llesta" ? (
                  <>
                    <button type="button" onClick={() => setEstat({ fase: "revisio", revisio: estat.revisio })} className={boto}>
                      Torna a revisar
                    </button>
                    {potCompartir ? (
                      <button type="button" onClick={comparteix} className="btn-compacte">
                        Comparteix
                      </button>
                    ) : null}
                    <a href={estat.url} download={estat.fitxer} className={boto}>
                      Descarrega
                    </a>
                    <a href={estat.url} target="_blank" rel="noreferrer" className={boto}>
                      Obre-la sencera
                    </a>
                  </>
                ) : null}
              </span>
            </div>

            {avisos.length > 0 ? (
              <ul className="border-b border-line bg-marca-clar/50 px-4 py-2 text-[12.5px] text-marca-fosc">
                {avisos.map((avis) => (
                  <li key={avis}>{avis}</li>
                ))}
              </ul>
            ) : null}

            <div className="scroll-slim relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-parchment/40 p-3">
              {estat.fase === "llesta" ? (
                <VistaPdf key={estat.url} pdf={estat.blob} titol="Fulla de productes" />
              ) : estat.fase === "revisio" || estat.fase === "fent" ? (
                <TaulaRevisio productes={estat.revisio.productes} ajustos={ajustos} ambPreus={preusDemanats} bloquejada={estat.fase === "fent"} retoca={retoca} />
              ) : (
                <div className="grid h-[70dvh] place-items-center text-[13.5px] text-muted">
                  {estat.fase === "error" ? (
                    <span className="max-w-[40ch] text-center text-marca-fosc">No s&apos;ha pogut fer la fulla: {estat.missatge}</span>
                  ) : (
                    "Llegint els productes i els preus…"
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}

/**
 * Els productes de la fulla, un per targeta, amb el que surt al PDF i els tres
 * camps que es poden retocar: el preu (a mà, per sobre del de l'ERP), el
 * descompte, que al PDF s'escriu al costat i no es resta, i les observacions.
 */
function TaulaRevisio({
  productes,
  ajustos,
  ambPreus,
  bloquejada,
  retoca,
}: {
  productes: ProducteDeFulla[];
  ajustos: Record<string, Ajust>;
  ambPreus: boolean;
  bloquejada: boolean;
  retoca: (id: string, canvi: Partial<Ajust>) => void;
}) {
  const etiqueta = "block text-[11px] font-medium uppercase tracking-[0.04em] text-muted";
  return (
    <ol className="space-y-2">
      {productes.map((producte, posicio) => {
        const ajust = ajustos[producte.id] ?? { preu: "", descompte: "", observacions: "" };
        const preuCanviat = ambPreus && ajust.preu !== preuEscrit(producte.preu);
        const descompteCanviat = ambPreus && ajust.descompte !== descompteEscrit(producte.descompte);
        return (
          <li key={producte.id} className="rounded-xl border border-line bg-white px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex items-center gap-2">
                <span className="w-[1.5ch] text-[12px] tabular-nums text-muted">{posicio + 1}</span>
                {producte.tipus ? <span className="text-[12px] lowercase text-muted">{producte.tipus}</span> : null}
              </span>
              <span className="font-display text-[16px] leading-tight">{producte.nom}</span>
              {producte.principiActiu ? <span className="text-[12.5px] text-muted">{producte.principiActiu}</span> : null}
              <span className="ml-auto flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                {producte.especie ? <span>{producte.especie}</span> : null}
                {producte.forma ? <span>{producte.forma}</span> : null}
                {producte.format ? <span>{producte.format}</span> : null}
              </span>
            </div>

            <div className="mt-2.5 grid gap-x-3 gap-y-2 sm:grid-cols-[140px_120px_1fr]">
              {ambPreus ? (
                <>
                  <label className="space-y-1">
                    <span className={etiqueta}>Preu (sense IVA)</span>
                    <span className="relative block">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ajust.preu}
                        disabled={bloquejada}
                        placeholder="Sense preu"
                        onChange={(e) => retoca(producte.id, { preu: e.target.value })}
                        className={`field-compacte pr-7 text-right tabular-nums ${preuCanviat ? "border-marca bg-marca-clar/30" : ""}`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[13px] text-muted">€</span>
                    </span>
                  </label>
                  <label className="space-y-1">
                    <span className={etiqueta}>Descompte</span>
                    <span className="relative block">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ajust.descompte}
                        disabled={bloquejada}
                        placeholder="Cap"
                        onChange={(e) => retoca(producte.id, { descompte: e.target.value })}
                        className={`field-compacte pr-7 text-right tabular-nums ${descompteCanviat ? "border-marca bg-marca-clar/30" : ""}`}
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-[13px] text-muted">%</span>
                    </span>
                  </label>
                </>
              ) : (
                <p className="self-end text-[12.5px] text-muted sm:col-span-2">La fulla anirà sense preus.</p>
              )}
              <label className="space-y-1">
                <span className={etiqueta}>Observacions</span>
                <input
                  type="text"
                  value={ajust.observacions}
                  disabled={bloquejada}
                  maxLength={400}
                  placeholder="Surt a la columna d'observacions de la fulla"
                  onChange={(e) => retoca(producte.id, { observacions: e.target.value })}
                  className="field-compacte"
                />
              </label>
            </div>

            {ambPreus && (preuCanviat || descompteCanviat) ? (
              <p className="mt-1.5 text-[12px] text-muted">
                L&apos;ERP posaria {producte.preu === null ? "cap preu" : `${preuEscrit(producte.preu)}€`}
                {producte.descompte ? ` amb ${descompteEscrit(producte.descompte)}% de descompte` : ""}. El descompte s&apos;escriu al costat del preu: no es resta.
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
