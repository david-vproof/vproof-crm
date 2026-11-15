import Link from "next/link";
import type { ReactNode } from "react";

import { AlbaransClient } from "@/components/crm/AlbaransClient";
import { PanellAtributs } from "@/components/crm/Atributs";
import { BotoTanca, ID_TITOL_FITXA } from "@/components/crm/CapaFitxa";
import { BotonsContacte } from "@/components/crm/Contacte";
import { PanellDeures, SeccioDeures } from "@/components/crm/Deures";
import { BotoDesa, EdicioFitxa, type DespresDeDesar } from "@/components/crm/EdicioFitxa";
import { EsborraFitxa } from "@/components/crm/EsborraFitxa";
import { FormulariFitxa } from "@/components/crm/FormulariFitxa";
import { EtiquetaLletra } from "@/components/crm/Lletres";
import { LlistaRelacionada } from "@/components/crm/LlistaRelacionada";
import { MiniFacturacio } from "@/components/crm/MiniFacturacio";
import { MiniSeguiment } from "@/components/crm/MiniSeguiment";
import { PanellEstabliments } from "@/components/crm/PanellEstabliments";
import { PanellFacturacio } from "@/components/crm/PanellFacturacio";
import { PestanyesFitxa, type Pestanya } from "@/components/crm/PestanyesFitxa";
import { VinsTastatsClient } from "@/components/crm/VinsTastatsClient";
import { FITXES, PENDENT, activitatTancada, esVisiblePer, idDeRelacio, textAlta, veDeFactusol, type Fitxa } from "@/domini/crm-fitxes";
import { nomPeriode } from "@/domini/facturacio";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { rutaDelClient } from "@/lib/navegacio";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { albaransDelClient } from "@/serveis/albarans";
import { atributsDelClient } from "@/serveis/atributs";
import { deuresDe } from "@/serveis/crm-deures";
import { llistaRelacionada, obteFitxa, opcionsDeRelacions, type ValorsFitxa } from "@/serveis/crm-manteniment";
import { seguimentDelClient } from "@/serveis/crm-periodicitat";
import { fitxaViva } from "@/serveis/crm-tipus-activitat";
import { vinsTastatsDelClient } from "@/serveis/crm-vins";
import { establimentsDelClient } from "@/serveis/establiments";
import { resumDeFacturacio } from "@/serveis/facturacio";

/** L'ordre de les seccions: el que es mira més, primer. */
const ORDRE_PESTANYES = ["dades", "activitats", "vins", "contactes", "establiments", "facturacio", "leads"];

/**
 * La fitxa d'un client, a pantalla sencera i a sobre de la vista d'on es ve.
 *
 * A la capçalera, qui és i com va (la facturació i el seguiment). A
 * l'esquerra, el que s'ha de tenir a mà sigui quina sigui la secció: com
 * contactar-hi, els To-Do i els atributs. A la dreta, les seccions: les dades,
 * el que en penja i la facturació. El que penja d'un client (una activitat, un
 * contacte) s'obre i es desa dins la mateixa secció, sense sortir de la fitxa.
 */
export async function FitxaClient({
  id,
  pestanya,
  relacionada,
  nova,
  paginaAlbarans,
}: {
  /** «nou» per a l'alta. */
  id: string;
  pestanya: string;
  /** El que en penja i s'ha obert a la secció: una activitat, un contacte. */
  relacionada: string;
  /** Si a la secció s'hi dona d'alta alguna cosa nova. */
  nova: boolean;
  paginaAlbarans: string;
}) {
  const fitxa = FITXES.clients;
  const esNou = id === "nou";
  const { deQui: comercial } = await abastDeLaSessio();

  let llegits: ValorsFitxa | null;
  try {
    llegits = esNou ? {} : await obteFitxa("clients", id);
  } catch (error) {
    return <FitxaBuida titol="No s'ha pogut llegir el client" text={(error as Error).message} />;
  }
  if (!llegits || !esVisiblePer(fitxa, llegits, comercial)) {
    return <FitxaBuida titol="Aquest client no hi és" text="Potser s'ha esborrat, o ja no és dels que es treballen al CRM." />;
  }
  const valors = llegits;

  // Tot es demana alhora. El que no es pot llegir no tomba la fitxa: la seva secció no surt.
  const relacionades = esNou ? [] : (fitxa.relacionades ?? []);
  const [opcions, llistes, deures, facturacio, seguiment, establiments, atributs, vinsTastats] = await Promise.all([
    opcionsDeRelacions("clients", valors),
    Promise.all(relacionades.map((relacio) => llistaRelacionada(relacio.clau, relacio.camp, id, { comercial }))),
    esNou ? null : deuresDe({ camp: "client", id }).catch(() => null),
    esNou ? null : resumDeFacturacio({ camp: "client", valor: id }).catch(() => null),
    esNou ? null : seguimentDelClient(id, valors.periodicitat).catch(() => null),
    esNou ? null : establimentsDelClient(id).catch(() => null),
    esNou ? null : atributsDelClient(id).catch(() => null),
    esNou ? null : vinsTastatsDelClient(id).catch(() => null),
  ]);

  const relacio = relacionades.find((candidata) => candidata.clau === pestanya) ?? null;
  const activa = relacio
    ? relacio.clau
    : establiments && pestanya === "establiments"
      ? "establiments"
      : facturacio && pestanya === "facturacio"
        ? "facturacio"
        : vinsTastats && pestanya === "vins"
          ? "vins"
          : "dades";
  const llista = relacio ? llistes[relacionades.indexOf(relacio)] : null;

  // Moure's per la fitxa és sempre una adreça de la fitxa: les pestanyes, el
  // que s'hi obre i les pàgines d'albarans. Per això tornar-hi la deixa igual.
  const enllac = (extra: Record<string, string> = {}) => rutaDelClient(id, extra);
  const tornaAPestanya = enllac(activa === "dades" ? {} : { t: activa });

  // El que penja del client i s'ha obert: una de nova surt amb el client posat.
  // Una activitat d'un altre no s'obre, encara que se'n tingui l'enllaç.
  let oberta: { relacio: NonNullable<typeof relacio>; fitxa: Fitxa; valors: ValorsFitxa } | null = null;
  if (relacio && (nova || relacionada)) {
    const fitxaRelacionada = await fitxaViva(relacio.clau);
    const llegida = relacionada ? await obteFitxa(relacio.clau, relacionada) : { [relacio.camp]: id };
    if (llegida && esVisiblePer(fitxaRelacionada, llegida, comercial)) oberta = { relacio, fitxa: fitxaRelacionada, valors: llegida };
  }
  const [opcionsRelacionada, albarans] = await Promise.all([
    oberta ? opcionsDeRelacions(oberta.relacio.clau, oberta.valors) : {},
    activa === "facturacio" ? albaransDelClient(id, Number(paginaAlbarans) || 1).catch(() => null) : null,
  ]);

  const nom = esNou ? textAlta(fitxa) : String(valors[fitxa.titol] ?? fitxa.singular);
  // Què hi ha obert per editar: governa el «Desa» de la filera de seccions.
  const edicio = activa === "dades" ? `clients:${id}` : oberta ? `${oberta.relacio.clau}:${relacionada || "nou"}` : null;
  const esActivitat = oberta?.relacio.clau === "activitats";
  // Desat el client, la fitxa es tanca, com sempre; desat el que en penja, es torna a la seva secció.
  const despres: DespresDeDesar = activa === "dades" ? { mena: "tanca" } : { mena: "ves", href: tornaAPestanya };

  const pestanyes: Pestanya[] = esNou
    ? []
    : [
        { clau: "dades", etiqueta: "Dades", href: enllac() },
        ...relacionades.map((candidata, i) => ({
          clau: candidata.clau,
          etiqueta: candidata.etiqueta,
          compte: llistes[i].total,
          href: enllac({ t: candidata.clau }),
        })),
        ...(establiments
          ? [{ clau: "establiments", etiqueta: "Establiments", compte: establiments.length, href: enllac({ t: "establiments" }) }]
          : []),
        ...(facturacio ? [{ clau: "facturacio", etiqueta: "Facturació", href: enllac({ t: "facturacio" }) }] : []),
        ...(vinsTastats ? [{ clau: "vins", etiqueta: "Vins tastats", compte: vinsTastats.length, href: enllac({ t: "vins" }) }] : []),
      ].sort((a, b) => ORDRE_PESTANYES.indexOf(a.clau) - ORDRE_PESTANYES.indexOf(b.clau));

  /** El text d'una relació de la fitxa (el tipus, l'agent), tal com surt al desplegable. */
  const textDe = (nomCamp: string) => {
    const camp = fitxa.camps.find((c) => c.nom === nomCamp);
    const valor = idDeRelacio(valors[nomCamp]);
    if (!camp || !valor) return "";
    return (opcions[camp.nom] ?? opcions[camp.relacio ?? ""] ?? []).find((opcio) => opcio.id === valor)?.text ?? "";
  };
  const agent = textDe("agent");
  const detall = esNou
    ? []
    : [
        textDe("tipus_client"),
        String(valors.poblacio ?? "").trim(),
        agent ? `Agent ${agent}` : "",
        valors.codi_erp ? `FactuSol ${valors.codi_erp}` : "",
      ].filter(Boolean);

  const ambLateral = !esNou;

  return (
    // Al telèfon la fitxa es desplaça d'una peça i només s'enganxa a dalt la franja del nom, amb «Tanca». A
    // l'ordinador la capçalera és fixa i cada columna es desplaça pel seu compte.
    <div className="scroll-slim flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:overflow-hidden">
      {/* Fill directe del que es desplaça: un `sticky` només s'enganxa dins del seu pare. */}
      <header
        data-capcalera-fitxa
        className={`sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-line bg-cream px-4 pb-2.5 pt-3 sm:px-6 sm:pt-5 lg:static lg:shrink-0 ${
          esNou ? "" : "lg:border-b-0 lg:pb-1.5"
        }`}
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{esNou ? "CRM" : fitxa.singular}</p>
          <h2
            id={ID_TITOL_FITXA}
            className="line-clamp-2 font-display text-[20px] leading-tight [overflow-wrap:anywhere] sm:text-[27px] lg:line-clamp-none"
          >
            {nom}
          </h2>
        </div>
        <BotoTanca />
      </header>

      {esNou ? null : (
        <div className="border-b border-line px-4 pb-3.5 pt-3 sm:px-6 lg:shrink-0 lg:pt-0">
          {/* La categoria i el potencial s'han de veure sempre, sigui quina sigui la secció. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <EtiquetaLletra que="categoria" valor={valors.categoria} />
              <EtiquetaLletra que="potencial" valor={valors.potencial} />
            </span>
            {detall.length > 0 ? <p className="text-[13px] text-muted">{detall.join(" · ")}</p> : null}
          </div>

          {/* Com va: la facturació, que porta a la secció sencera, i el seguiment de la periodicitat, que porta a les activitats. */}
          {valors.facturacio_tendencia || seguiment ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
              {valors.facturacio_tendencia ? (
                <Link
                  href={enllac({ t: "facturacio" })}
                  replace
                  scroll={false}
                  className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md transition-opacity hover:opacity-80"
                >
                  <span className="text-muted">Facturació {nomPeriode(Number(valors.facturacio_fins_mes)) ?? ""}</span>
                  <MiniFacturacio dades={Object.fromEntries(CAMPS_RESUM_FACTURACIO.map((camp) => [camp, valors[camp] ?? null]))} />
                </Link>
              ) : null}
              {seguiment ? (
                <Link
                  href={enllac({ t: "activitats" })}
                  replace
                  scroll={false}
                  className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md transition-opacity hover:opacity-80"
                >
                  <span className="text-muted">Activitats d&apos;enguany</span>
                  <MiniSeguiment dades={seguiment} />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div
        className={
          ambLateral
            ? "lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]"
            : "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
        }
      >
        {ambLateral ? (
          <aside className="space-y-6 border-b border-line px-4 py-5 sm:px-6 lg:scroll-slim lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:px-5">
            <Contacte valors={valors} />
            {deures ? (
              <Apartat titol="To-Do">
                <PanellDeures client={id} deures={deures} compte={nom} />
              </Apartat>
            ) : null}
            {atributs ? (
              <Apartat titol="Atributs">
                <PanellAtributs client={id} atributs={atributs} />
              </Apartat>
            ) : null}
          </aside>
        ) : null}

        <section className="min-w-0 lg:scroll-slim lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
          {/* La clau fa que cada fitxa editada comenci amb l'estat del desat a zero. */}
          <EdicioFitxa key={edicio ?? "lectura"} despres={despres}>
            <PestanyesFitxa pestanyes={pestanyes} actual={activa}>
              {edicio ? <BotoDesa /> : null}
            </PestanyesFitxa>

            <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
              {activa === "dades" ? (
                <>
                  <FormulariFitxa fitxa={fitxa} valors={valors} opcions={opcions} id={esNou ? null : id} />
                  {/* Les fitxes de FactuSol no s'esborren: les manté l'ERP. */}
                  {esNou || veDeFactusol(fitxa, valors) ? null : (
                    <EsborraFitxa entitat="clients" id={id} nom={nom} despres={{ mena: "tanca" }} />
                  )}
                </>
              ) : activa === "establiments" && establiments ? (
                <PanellEstabliments establiments={establiments} />
              ) : activa === "vins" && vinsTastats ? (
                <VinsTastatsClient
                  vins={vinsTastats}
                  comercial={comercial}
                  enllacActivitat={(activitat) => enllac({ t: "activitats", f: activitat.id })}
                />
              ) : activa === "facturacio" && facturacio ? (
                <div className="space-y-6">
                  <PanellFacturacio resum={facturacio} />
                  <AlbaransClient
                    dades={albarans}
                    enllacPagina={(numero) => `${enllac({ t: "facturacio", ...(numero > 1 ? { ap: String(numero) } : {}) })}#albarans`}
                  />
                </div>
              ) : oberta ? (
                // Una activitat o un contacte no tenen seccions: una columna, a una amplada que es pugui llegir.
                <div className="max-w-2xl space-y-4">
                  <Link href={tornaAPestanya} replace scroll={false} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                    ← {oberta.relacio.etiqueta} del client
                  </Link>
                  <FormulariFitxa
                    fitxa={oberta.fitxa}
                    valors={oberta.valors}
                    opcions={opcionsRelacionada}
                    id={relacionada || null}
                    // Una activitat creada des d'aquí és d'aquest client: no es pot passar a un altre.
                    fixats={esActivitat ? [oberta.relacio.camp] : undefined}
                  />
                  {/* Tancar-la, sense sortir de la fitxa. Els To-Do pendents ja són a la columna del costat. */}
                  {esActivitat && relacionada ? (
                    <SeccioDeures
                      id={relacionada}
                      tancada={activitatTancada(oberta.valors)}
                      resultat={String(oberta.valors.resultat ?? PENDENT)}
                      compte={nom}
                      propis={(deures ?? []).filter((deure) => deure.activitat === relacionada)}
                      atributs={atributs}
                    />
                  ) : null}
                  {relacionada && !veDeFactusol(oberta.fitxa, oberta.valors) ? (
                    <EsborraFitxa
                      entitat={oberta.relacio.clau}
                      id={relacionada}
                      nom={String(oberta.valors[oberta.fitxa.titol] ?? oberta.fitxa.singular)}
                      despres={{ mena: "ves", href: tornaAPestanya }}
                    />
                  ) : null}
                </div>
              ) : relacio && llista ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] text-muted">
                      {llista.total} {llista.total === 1 ? "registre" : "registres"}
                    </p>
                    <Link href={enllac({ t: relacio.clau, nou: "1" })} replace scroll={false} className="btn-compacte">
                      + {textAlta(llista.fitxa)}
                    </Link>
                  </div>
                  <LlistaRelacionada
                    files={llista.files}
                    enllacFitxa={(fila) => enllac({ t: relacio.clau, f: fila })}
                    buit={`Aquest client encara no té ${llista.fitxa.plural.toLowerCase()}.`}
                  />
                </div>
              ) : null}
            </div>

            {/* Al telèfon, «Desa» va a baix, a l'abast del polze, i hi queda mentre es baixa pel formulari. */}
            {edicio ? (
              <div className="sticky bottom-0 z-10 flex justify-end border-t border-line bg-cream px-4 py-2.5 sm:px-6 lg:hidden">
                <BotoDesa />
              </div>
            ) : null}
          </EdicioFitxa>
        </section>
      </div>
    </div>
  );
}

/** Un apartat de la columna del costat. Sense majúscules: «To-Do» s'ha de llegir tal qual. */
function Apartat({ titol, children }: { titol: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[12.5px] font-medium text-ink-soft">{titol}</h3>
      {children}
    </section>
  );
}

/** Com contactar-hi, a mà des de qualsevol secció. Els mateixos camps s'editen a Dades. */
function Contacte({ valors }: { valors: ValorsFitxa }) {
  const text = (camp: string) => String(valors[camp] ?? "").trim();
  const telefon = text("telefon");
  const correu = text("correu");
  const web = text("web");
  const pais = text("pais");
  const adreca = [
    text("adreca"),
    [text("codi_postal"), text("poblacio")].filter(Boolean).join(" "),
    [text("provincia"), pais && !/^(es|espanya|españa)$/i.test(pais) ? pais : ""].filter(Boolean).join(", "),
  ].filter(Boolean);

  if (!telefon && !correu && !web && adreca.length === 0) return null;

  return (
    <Apartat titol="Contacte">
      <div className="space-y-2.5 text-[13px] text-ink-soft">
        {telefon ? <FilaContacte botons={<BotonsContacte mena="telefon" valor={telefon} />}>{telefon}</FilaContacte> : null}
        {correu ? <FilaContacte botons={<BotonsContacte mena="correu" valor={correu} />}>{correu}</FilaContacte> : null}
        {web ? (
          <p className="[overflow-wrap:anywhere]">
            <a
              href={/^https?:\/\//i.test(web) ? web : `https://${web}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-wine hover:underline"
            >
              {web.replace(/^https?:\/\//i, "")}
            </a>
          </p>
        ) : null}
        {adreca.length > 0 ? (
          <address className="not-italic leading-snug text-muted">
            {adreca.map((linia) => (
              <span key={linia} className="block [overflow-wrap:anywhere]">
                {linia}
              </span>
            ))}
          </address>
        ) : null}
      </div>
    </Apartat>
  );
}

/** Els botons de trucar o escriure al davant, perquè el text es pot partir. */
function FilaContacte({ botons, children }: { botons: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5">{botons}</span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

/** El client no hi és, o no s'ha pogut llegir: la capa surt igual, amb el «Tanca». */
function FitxaBuida({ titol, text }: { titol: string; text: string }) {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-line px-4 pb-3.5 pt-3.5 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Client</p>
          <h2 id={ID_TITOL_FITXA} className="font-display text-[23px] leading-tight sm:text-[27px]">
            {titol}
          </h2>
        </div>
        <BotoTanca />
      </header>
      <p className="max-w-[60ch] px-4 py-6 text-[14px] text-muted sm:px-6">{text}</p>
    </>
  );
}
