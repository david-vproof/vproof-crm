import Link from "next/link";
import { redirect } from "next/navigation";

import { FormulariFitxa } from "@/components/crm/FormulariFitxa";
import { PanellFitxa, type Esborrable } from "@/components/crm/PanellFitxa";
import { Planner } from "@/components/crm/Planner";
import { LlegendaVisites } from "@/components/crm/LlegendaVisites";
import { TaulaRegistres } from "@/components/crm/TaulaRegistres";
import { TaulerCrm } from "@/components/crm/TaulerCrm";
import { TaulerNegoci } from "@/components/crm/TaulerNegoci";
import { VistaAvui } from "@/components/crm/VistaAvui";
import { VistaMapa } from "@/components/crm/VistaMapa";
import { VistaSegments } from "@/components/crm/VistaSegments";
import { VinsTastatsClient } from "@/components/crm/VinsTastatsClient";
import { VistaToDo, responsableDelsToDo } from "@/components/crm/VistaToDo";
import { Paginacio } from "@/components/Paginacio";
import { EstatBuit } from "@/components/UI";
import { SeccioDeures } from "@/components/crm/Deures";
import { atributsDelClient } from "@/serveis/atributs";
import { PENDENT, activitatTancada, FITXES, esClauFitxa, esVisiblePer, idDeRelacio, textAlta, veDeFactusol, type ClauFitxa } from "@/domini/crm-fitxes";
import {
  MIDA_PER_DEFECTE, TRAM_SCROLL, type Filtres, type OrdreLlistat, llegeixFiltres, llegeixMida, llegeixOrdre, paramsDeLlistat, seguentOrdre, teScroll,
} from "@/domini/crm-llistat";
import { SelectorMidaPagina } from "@/components/crm/SelectorMidaPagina";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { rutaDelClient } from "@/lib/navegacio";
import { comptaActivitatsDavui } from "@/serveis/crm-avui";
import { amoDeLActivitat, comptaToDos, deuresDeLaFitxa } from "@/serveis/crm-deures";
import {
  comptaFitxes, llistaFitxa, obteFitxa, opcionsDeRelacions, type OpcionsRelacio, type ValorsFitxa,
} from "@/serveis/crm-manteniment";
import { fitxaViva } from "@/serveis/crm-tipus-activitat";
import { vinsTastatsDelLead } from "@/serveis/crm-vins";

export const metadata = { title: "CRM · Wine Backend" };

type Parametres = {
  searchParams: Promise<{
    v?: string; q?: string; p?: string; r?: string; t?: string; pre?: string;
    esborrar?: string; nou?: string; f?: string; m?: string; pv?: string; s?: string; seg?: string; c?: string;
    /** La pantalla de To-Do: com s'agrupen i si s'ensenyen els fets. */
    g?: string; fets?: string;
    /** L'ordre i els filtres per columna dels llistats: vegeu domini/crm-llistat.ts. */
    ordre?: string;
    [altre: string]: string | string[] | undefined;
  }>;
};

/** L'espai de treball ha de sortir encara que Directus no respongui. */
async function comptadorsSegurs(comercial: string | null) {
  try {
    return await comptaFitxes(comercial);
  } catch {
    return null;
  }
}

/** El comptador de la pestanya d'avui no ha de tombar tot l'espai de treball. */
async function activitatsDavuiSegures(comercial: string | null) {
  try {
    return await comptaActivitatsDavui(comercial);
  } catch {
    return undefined;
  }
}

/** El mateix per al comptador de To-Do pendents. */
async function toDosPendentsSegurs(responsable: string | null) {
  try {
    return await comptaToDos(responsable);
  } catch {
    return undefined;
  }
}

export default async function PaginaCrm({ searchParams }: Parametres) {
  const params = await searchParams;
  const {
    v = "tauler", q = "", p = "1", r = "", t = "", pre = "", esborrar = "", nou = "", f = "", m = "",
    pv = "", s = "", seg = "", c = "", torna = "", ap = "", pf = "", g = "", fets = "",
  } = params as Record<string, string | undefined>;

  // Els cellers tenen pantalla pròpia, com els clients: els enllaços vells hi porten.
  if (v === "proveidors") redirect(r ? `/cellers/${encodeURIComponent(r)}` : "/cellers");

  // Els clients abans es deien «comptes» a l'adreça: els enllaços vells hi porten igual, amb la resta de l'adreça.
  if (v === "comptes") {
    const nova = new URLSearchParams();
    for (const [clau, valor] of Object.entries(params)) if (typeof valor === "string") nova.set(clau, valor);
    nova.set("v", "clients");
    redirect(`/crm?${nova}`);
  }

  // La fitxa d'un client té adreça pròpia i s'obre a sobre de la vista: els
  // enllaços d'abans (la llista, el mapa o el Planificador amb `r`) hi porten.
  if (r && (v === "clients" || v === "mapa" || (v === "segments" && pf === "clients"))) {
    redirect(rutaDelClient(r, Object.fromEntries(Object.entries({ t, f, nou, ap }).filter(([, valor]) => valor))));
  }

  // Cinc vistes panoràmiques (tauler, avui, agenda, To-Do i mapa) i una per
  // cada mena de fitxa.
  const vista: VistaCrm = esClauFitxa(v)
    ? v
    : v === "mapa" || v === "planner" || v === "avui" || v === "deures"
      ? v
      : "tauler";

  // El Planner es mira per mes o per setmana, d'una agenda o d'una altra, i el
  // mapa pot tenir un segment destacat: cal recordar-ho per tornar-hi igual
  // després d'obrir una fitxa.
  const setmanal = pv === "setmana";
  const agenda: Record<string, string> = c ? { c } : {};
  // Els llistats de fitxes tenen ordre i filtres per columna, que també s'han
  // de conservar en obrir una fitxa i en paginar.
  const ordre = esClauFitxa(vista) ? llegeixOrdre(FITXES[vista], params.ordre) : null;
  const filtres = esClauFitxa(vista) ? llegeixFiltres(FITXES[vista], params) : {};
  const abast = await abastDeLaSessio();
  // Qui només veu els clients del seu agent no filtra per agent: ni des del formulari ni posant-ho a l'adreça.
  if (!abast.totes) delete filtres.agent;
  // Un llistat amb scroll no té mida: l'adreça d'abans («pp=100», «pp=tots») ja no hi fa res.
  const mida = esClauFitxa(vista) && !teScroll(vista) ? llegeixMida(params.pp) : MIDA_PER_DEFECTE;
  const situacio: Record<string, string> =
    // L'agenda és sempre la d'avui: no hi ha res a recordar per tornar-hi igual.
    vista === "avui"
      ? {}
      : // Els To-Do es miren de qui, agrupats d'una manera i amb els fets o sense.
        vista === "deures"
        ? { ...agenda, ...(g ? { g } : {}), ...(fets ? { fets } : {}) }
        : esClauFitxa(vista)
        ? paramsDeLlistat(ordre, filtres, mida)
        : setmanal
          ? { pv: "setmana", ...(s ? { s } : {}), ...agenda }
          : { ...(m ? { m } : {}), ...agenda };

  // L'agenda i els To-Do obren les activitats a sobre i no en fan sortir. Els
  // clients no van en panell: tenen fitxa pròpia, a /crm/clients (vegeu layout.tsx).
  const clauPanell: ClauFitxa | null = esClauFitxa(vista)
    ? vista
    : vista === "planner" || vista === "avui" || vista === "deures"
      ? "activitats"
      : null;

  // Tothom veu tot el CRM, però les activitats són de cadascú: l'agenda, Avui,
  // el llistat i les pestanyes de les fitxes només ensenyen les que porta (i
  // les que no porta ningú). Un administrador les veu totes. Vegeu `abastDeLaSessio`.
  const comercial = abast.deQui;
  const [comptadors, activitatsDavui, toDosPendents] = await Promise.all([
    comptadorsSegurs(comercial),
    activitatsDavuiSegures(comercial),
    // Els To-Do van per responsable, i qui ho veu tot pot haver triat de qui: el mateix criteri que la vista.
    vista === "deures" ? toDosPendentsSegurs(responsableDelsToDo(c, abast.jo, abast.totes)) : Promise.resolve(undefined),
  ]);
  // Cada vista és un punt del menú lateral: la capçalera només diu on s'és.
  const { titol, descripcio, compte } = capcaleraDeLaVista(vista, comptadors, activitatsDavui, toDosPendents);

  return (
    // h-full i no només min-h-full: el mapa s'estira a l'espai que queda, i
    // per créixer li cal que el pare tingui una alçada definida.
    <div className="flex h-full min-h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-4 pb-4 pt-5 sm:px-5 sm:pt-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 font-display text-[26px] leading-tight">
            {titol}
            {compte === undefined ? null : (
              <span className="rounded bg-parchment px-1.5 py-px font-sans text-[12px] tabular-nums text-muted">{compte}</span>
            )}
          </h1>
          <p className="mt-0.5 text-[13.5px] text-muted">{descripcio}</p>
        </div>
      </div>

      {vista === "tauler" ? (
        <>
          {/* El tauler de negoci (casa, equip, avui) i, a sota, el pipeline i l'activitat de sempre. */}
          <TaulerNegoci totes={abast.totes} agent={c} />
          <details className="px-4 pb-6 sm:px-6">
            <summary className="cursor-pointer text-[13.5px] font-medium text-muted hover:text-ink">Pipeline i activitat comercial, en detall</summary>
            <TaulerCrm />
          </details>
        </>
      ) : vista === "avui" ? (
        <VistaAvui comercial={comercial} />
      ) : vista === "planner" ? (
        <Planner mes={m} dia={s} setmanal={setmanal} totes={abast.totes} c={c} />
      ) : vista === "deures" ? (
        <VistaToDo propi={abast.jo} totes={abast.totes} c={c} g={g} fets={fets === "1"} />
      ) : vista === "mapa" ? (
        <VistaMapa segmentInicial={seg} />
      ) : vista === "segments" ? (
        // Els segments no són una taula de files: cada un desplega la seva gent.
        <VistaSegments cerca={q} />
      ) : (
        <VistaFitxes clau={vista} cerca={q} pagina={Number(p) || 1} comercial={comercial} ordre={ordre} filtres={filtres} mida={mida} senseFiltre={abast.totes ? [] : ["agent"]} />
      )}

      {clauPanell && r ? (
        <Panell clau={clauPanell} vista={vista} situacio={situacio} registre={r} cerca={q} pagina={p}
          prefixat={pre} confirmant={esborrar === "1"}
          comercial={comercial}
          torna={torna}
        />
      ) : null}
    </div>
  );
}

type VistaCrm = ClauFitxa | "tauler" | "mapa" | "planner" | "avui" | "deures";

const VISTES_PANORAMIQUES: Record<Exclude<VistaCrm, ClauFitxa>, { titol: string; descripcio: string }> = {
  tauler: { titol: "Tauler", descripcio: "Com va el comercial d'un cop d'ull." },
  avui: { titol: "Avui", descripcio: "Les visites i les tasques del dia." },
  planner: { titol: "Agenda", descripcio: "Les activitats, per mes o per setmana." },
  deures: { titol: "To-Do", descripcio: "Tot el que queda per fer, amb d'on surt i de qui és." },
  mapa: { titol: "Mapa", descripcio: "On són els clients i com s'agrupen." },
};

const DESCRIPCIONS_FITXA: Record<ClauFitxa, string> = {
  leads: "Qui encara no compra i podria comprar.",
  clients: "Els clients del CRM: qui ja compra o hi té relació.",
  oportunitats: "El que hi ha obert i en quin punt és.",
  proveidors: "De qui es compra el vi: els proveïdors de FactuSol.",
  contactes: "Amb qui es parla a cada client.",
  activitats: "Trucades, visites i tasques, fetes i pendents.",
  segments: "Grups de clients segons criteris, per planificar-hi rondes i activitats.",
  tipus_client: "Els tipus de client de FactuSol.",
  agents: "Els agents comercials de FactuSol.",
};

function capcaleraDeLaVista(
  vista: VistaCrm,
  comptadors: Partial<Record<ClauFitxa, number>> | null,
  activitatsDavui: number | undefined,
  toDosPendents: number | undefined,
) {
  if (esClauFitxa(vista)) {
    return { titol: FITXES[vista].titolVista ?? FITXES[vista].plural, descripcio: DESCRIPCIONS_FITXA[vista], compte: comptadors?.[vista] };
  }
  return {
    ...VISTES_PANORAMIQUES[vista],
    compte: vista === "avui" ? activitatsDavui : vista === "deures" ? toDosPendents : undefined,
  };
}

async function VistaFitxes({
  clau,
  cerca,
  pagina,
  comercial,
  ordre,
  filtres,
  mida,
  senseFiltre,
}: {
  clau: ClauFitxa;
  cerca: string;
  pagina: number;
  comercial: string | null;
  ordre: OrdreLlistat | null;
  filtres: Filtres;
  /** Files per pàgina; 0 vol dir totes. */
  mida: number;
  /** Columnes sense filtre: vegeu `TaulaRegistres`. */
  senseFiltre: string[];
}) {
  const ambScroll = teScroll(clau);
  let dades;
  try {
    // Amb scroll, aquí només el primer tram: la resta el demana el navegador en baixar.
    dades = await llistaFitxa(clau, { cerca, pagina: ambScroll ? 1 : pagina, comercial, ordre, filtres, perPagina: ambScroll ? TRAM_SCROLL : mida });
  } catch (error) {
    return (
      <div className="p-5">
        <EstatBuit titol="No s'ha pogut llegir el CRM" text={(error as Error).message} />
      </div>
    );
  }

  const { fitxa, columnes, files, total, perPagina } = dades;
  const llistat = paramsDeLlistat(ordre, filtres, mida);
  const base = (extra: Record<string, string>) =>
    `/crm?${new URLSearchParams({ v: clau, ...(cerca ? { q: cerca } : {}), ...llistat, ...extra })}`;
  // Canviar l'ordre o treure els filtres torna a la primera pàgina, amb la mateixa mida.
  const ambLlistat = (nou: OrdreLlistat | null, nousFiltres: Filtres) =>
    `/crm?${new URLSearchParams({ v: clau, ...(cerca ? { q: cerca } : {}), ...paramsDeLlistat(nou, nousFiltres, mida) })}`;
  const filtrat = Object.keys(filtres).length > 0;
  // Restaurar deixa la llista sense cap filtre ni cerca; l'ordre i la mida no són filtres i es queden.
  const restaura = `/crm?${new URLSearchParams({ v: clau, ...paramsDeLlistat(ordre, {}, mida) })}`;

  return (
    // Sense `min-h-0`: ha de fer tota l'alçada de la llista. Si no, el bloc de filtres
    // del telèfon, que s'hi enganxa, se n'anava amb el primer tros de llista.
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        {/* Sense cercador genèric: cada columna del llistat filtra pel seu compte. A
            dalt, quantes n'hi ha amb els filtres posats i quantes se'n veuen per
            pàgina: és el que es mira després de filtrar. La paginació va a sota. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="whitespace-nowrap text-[13px] text-muted">
            <strong className="font-semibold text-ink">{total}</strong> {total === 1 ? "fitxa" : "fitxes"}
            {filtrat ? " amb els filtres actuals" : ""}
          </span>
          {/* Canviar la mida conserva l'ordre i els filtres, i torna a la primera pàgina. */}
          {ambScroll ? null : <SelectorMidaPagina valor={mida} ocults={{ v: clau, ...(cerca ? { q: cerca } : {}), ...paramsDeLlistat(ordre, filtres) }} />}
          {filtrat || cerca ? (
            <Link href={restaura} className="whitespace-nowrap rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px] text-muted transition hover:border-ink hover:text-ink">
              ↺ Restaura els filtres
            </Link>
          ) : null}
          {/* A clients, el fons de cada fila diu quant fa que no s'hi va: aquí es diu què vol dir cada color. */}
          {clau === "clients" ? <LlegendaVisites /> : null}
        </div>

        {fitxa.nomesLectura ? (
          <span className="text-[13px] text-muted">Els manté FactuSol</span>
        ) : (
          <Link href={clau === "clients" ? rutaDelClient("nou") : base({ r: "nou" })} className="btn-compacte">
            + {textAlta(fitxa)}
          </Link>
        )}
      </div>

      {/* La barra de filtres hi és sempre, també sense cap resultat: és on es desfà el filtre que ha deixat la llista buida. */}
      <TaulaRegistres
        columnes={columnes}
        files={files}
        // Un client s'obre a la seva fitxa, a sobre: la llista es queda al darrere tal com és.
        enllacFitxa={(id) => (clau === "clients" ? rutaDelClient(id) : base({ ...(ambScroll ? {} : { p: String(pagina) }), r: id }))}
        ordre={ordre}
        filtres={filtres}
        enllacOrdre={(camp) => ambLlistat(seguentOrdre(ordre, camp), filtres)}
        enllacNeteja={ambLlistat(ordre, {})}
        ocults={{ v: clau, ...(cerca ? { q: cerca } : {}), ...paramsDeLlistat(null, {}, mida) }}
        senseFiltre={senseFiltre}
        scroll={ambScroll ? { consulta: new URLSearchParams({ v: clau, ...(cerca ? { q: cerca } : {}), ...llistat }).toString(), total } : undefined}
      />

      {files.length === 0 ? (
        <div className="px-4 py-6 sm:px-5">
          <EstatBuit
            titol={cerca || filtrat ? "Cap resultat" : `Encara no hi ha ${fitxa.plural.toLowerCase()}`}
            text={
              filtrat
                ? "Cap fitxa compleix els filtres de columna."
                : cerca
                  ? "Prova amb un altre terme de cerca."
                  : fitxa.nomesLectura
                    ? "Arribaran amb la propera sincronització amb FactuSol."
                    : `Comença amb el botó «${textAlta(fitxa)}».`
            }
          />
          {filtrat || cerca ? (
            <p className="mt-3 text-center">
              <Link href={restaura} className="text-[13px] text-wine underline underline-offset-2">
                Restaura els filtres
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* A sota de la llista, on s'és i on anar: la paginació. */}
      {files.length > 0 && !ambScroll ? (
        <div className="px-4 py-4 sm:px-5">
          <Paginacio className="gap-x-3" pagina={pagina} pagines={perPagina > 0 ? Math.max(1, Math.ceil(total / perPagina)) : 1} enllac={(numero) => base({ p: String(numero) })} />
        </div>
      ) : null}
    </div>
  );
}

async function Panell({
  clau,
  vista,
  situacio,
  registre,
  cerca,
  pagina,
  prefixat,
  confirmant,
  comercial,
  torna,
}: {
  clau: ClauFitxa;
  /** La vista de darrere, que no sempre és la de la fitxa: el Planner obre activitats. */
  vista: string;
  /** On era la vista de darrere (mes o setmana del Planner), per tornar-hi igual. */
  situacio: Record<string, string>;
  registre: string;
  cerca: string;
  pagina: string;
  prefixat: string;
  confirmant: boolean;
  /**
   * De qui són les activitats que es veuen (null: totes). L'activitat d'un
   * altre no s'obre.
   */
  comercial: string | null;
  /** D'on s'ha vingut, si s'hi ha arribat des d'una altra fitxa: el lead obert des d'una activitat. */
  torna: string;
}) {
  const fitxa = await fitxaViva(clau);
  const esNova = registre === "nou";

  // Una fitxa nova pot arribar amb camps ja resolts, «camp:valor» separats per
  // comes: «nova activitat» des del Planner surt amb el dia, i des d'un lead, amb
  // el lead i el tipus. Es talla pel primer dos punts: una data i hora en porta més.
  const inicials: Record<string, string> = esNova
    ? Object.fromEntries(
        prefixat.split(",").flatMap((tros) => {
          const tall = tros.indexOf(":");
          return tall > 0 && tall < tros.length - 1 ? [[tros.slice(0, tall), tros.slice(tall + 1)] as [string, string]] : [];
        }),
      )
    : {};

  // Les opcions es demanen després dels valors: així el desplegable ja porta
  // la fitxa que hi ha triada encara que no surti a la primera pàgina.
  const valors = esNova ? inicials : await obteFitxa(clau, registre);
  // L'activitat d'un altre no s'obre, encara que se'n tingui l'enllaç: com si no hi fos.
  if (!valors || !esVisiblePer(fitxa, valors, comercial)) return null;
  const opcions = await opcionsDeRelacions(clau, valors);

  // Només es torna a una altra fitxa del CRM: el paràmetre ve de l'URL i no ha de portar enlloc més.
  const tornaSegur = torna.startsWith("/crm?") ? torna : "";
  const enllac = (extra: Record<string, string>, ambTornada: boolean) =>
    `/crm?${new URLSearchParams({
      v: vista,
      ...(cerca ? { q: cerca } : {}),
      ...situacio,
      // La primera pàgina no cal dir-la: i un llistat amb scroll no en té, de pàgines.
      ...(pagina === "1" ? {} : { p: pagina }),
      ...(ambTornada && tornaSegur ? { torna: tornaSegur } : {}),
      ...extra,
    })}`;
  // Moure's per la fitxa no fa perdre el camí de tornada; tancar-la, sí. Una
  // activitat oberta des de la fitxa d'un lead, en canvi, hi torna en tancar-la,
  // desar-la o esborrar-la: se n'havia sortit només per mirar-la.
  const base = (extra: Record<string, string>) => enllac(extra, true);
  const tancar = clau === "activitats" && tornaSegur ? tornaSegur : enllac({}, false);

  // Les fitxes de FactuSol no s'esborren: les manté l'ERP.
  const esborrable: Esborrable | null =
    esNova || fitxa.nomesLectura || veDeFactusol(fitxa, valors)
      ? null
      : { entitat: clau, id: registre, nom: String(valors[fitxa.titol] ?? fitxa.singular), retorn: tancar };

  // Les fitxes que manté l'ERP no s'editen: no hi ha res a desar.
  const edicio = fitxa.nomesLectura ? null : `${clau}:${registre}`;

  // D'una activitat es pot saltar a la fitxa del client (o del lead). El client
  // s'obre a sobre, i en tancar-lo es torna aquí; al lead se li diu d'on ve.
  const amo = clau === "activitats" && !esNova ? amoDeLActivitat(valors) : null;
  const fitxaAmo = amo ? FITXES[amo.camp === "client" ? "clients" : "leads"] : null;
  const enllacAmo =
    amo && fitxaAmo
      ? {
          href:
            amo.camp === "client"
              ? rutaDelClient(amo.id)
              : `/crm?${new URLSearchParams({ v: fitxaAmo.clau, r: amo.id, torna: base({ r: registre }) })}`,
          nom: (amo.camp === "client" ? opcions.clients : opcions.leads)?.find((o) => o.id === amo.id)?.text ?? fitxaAmo.singular,
        }
      : null;

  return (
    <PanellFitxa
      fitxa={fitxa}
      enrere={tornaSegur ? { href: tornaSegur, text: clau === "activitats" ? "Torna al lead" : "Torna a l'activitat" } : undefined}
      titol={esNova ? textAlta(fitxa) : String(valors[fitxa.titol] ?? fitxa.singular)}
      tancar={tancar}
      confirmant={confirmant}
      hrefEsborrar={base({ r: registre, esborrar: "1" })}
      esborrable={esborrable}
      edicio={edicio}
      resum={
        enllacAmo && fitxaAmo ? (
          <Link href={enllacAmo.href} scroll={false} className="inline-flex max-w-full items-center gap-1.5 rounded-md text-wine hover:underline">
            <span className="text-muted">{fitxaAmo.singular}</span>
            <span className="truncate font-medium">{enllacAmo.nom}</span>
            <span aria-hidden>→</span>
          </Link>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* Desar torna on s'era, com tancar: amb els filtres, l'ordre i la pàgina de la llista. */}
        <FormulariFitxa fitxa={fitxa} valors={valors} opcions={opcions} id={esNova ? null : registre} retorn={tancar} />
        {clau === "activitats" ? (
          <DeuresDeLActivitat id={esNova ? "" : registre} valors={valors} opcions={opcions} />
        ) : null}
        {clau === "leads" && !esNova ? (
          <VinsDelLead id={registre} client={idDeRelacio(valors.client)} comercial={comercial} torna={base({ r: registre })} />
        ) : null}
      </div>
    </PanellFitxa>
  );
}

/**
 * Els vins d'un lead, a la seva fitxa: els que ha tastat i, per triar-ne de
 * nous, una activitat amb vins ja lligada al lead. Els vins sempre van amb una
 * activitat (`crm_activitats_vins`), i així quan el lead es converteix tot
 * passa al client (vegeu `passaDelLeadAlClient`). Un lead ja convertit no en
 * tria més: el que es tasti d'ara endavant s'apunta al client.
 */
async function VinsDelLead({ id, client, comercial, torna }: { id: string; client: string; comercial: string | null; torna: string }) {
  const vins = await vinsTastatsDelLead(id).catch(() => null);
  const activitat = (extra: Record<string, string>) => `/crm?${new URLSearchParams({ v: "activitats", ...extra, torna })}`;

  return (
    <section aria-labelledby={`vins-lead-${id}`} className="space-y-2 border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`vins-lead-${id}`} className="text-[12px] font-medium text-muted">
          Vins
        </h3>
        {client ? (
          <Link href={rutaDelClient(client, { t: "vins" })} scroll={false} className="text-[12.5px] text-wine hover:underline">
            Ja és client: mira&apos;ls a la seva fitxa →
          </Link>
        ) : (
          <Link href={activitat({ r: "nou", pre: `lead:${id},tipus:visita_amb_vi` })} scroll={false} className="btn-compacte">
            Tria vins per a una visita
          </Link>
        )}
      </div>
      {vins ? (
        <VinsTastatsClient vins={vins} comercial={comercial} qui="lead" enllacActivitat={({ id: oberta }) => activitat({ r: oberta })} />
      ) : (
        <p className="text-[13px] text-muted">No s&apos;han pogut llegir els vins d&apos;aquest lead.</p>
      )}
    </section>
  );
}

/**
 * Els deures que envolten una activitat: el que arrossega el compte i, si
 * encara és oberta, el pas de tancar-la.
 *
 * D'una activitat nova només se'n saben els deures si el compte ja ve posat
 * —quan es dona d'alta des de la fitxa del compte—, perquè mentre s'està
 * triant al desplegable el servidor encara no sap de qui parlem.
 */
async function DeuresDeLActivitat({
  id,
  valors,
  opcions,
}: {
  id: string;
  valors: ValorsFitxa;
  opcions: OpcionsRelacio;
}) {
  const amo = amoDeLActivitat(valors);
  if (!amo) return null;

  const nom =
    (amo.camp === "client" ? opcions.clients : opcions.leads)?.find((o) => o.id === amo.id)?.text ?? "";

  let deures;
  try {
    deures = await deuresDeLaFitxa(amo, id);
  } catch {
    // Un tall amb Directus no ha de deixar la fitxa sense poder-se desar.
    return null;
  }
  // Al tancament es veuen els atributs del client i se n'hi afegeixen. Un lead encara no en té.
  const atributs = amo.camp === "client" ? await atributsDelClient(amo.id).catch(() => null) : null;

  // Sense id encara no es pot tancar res: només s'ensenya què s'arrossega.
  if (!id) {
    return deures.arrossegats.length === 0 ? null : (
      <SeccioDeures
        id=""
        tancada={false}
        resultat={PENDENT}
        compte={nom}
        arrossegats={deures.arrossegats}
        propis={[]}
        nomesLectura
      />
    );
  }

  return (
    <SeccioDeures
      id={id}
      tancada={activitatTancada(valors)}
      resultat={String(valors.resultat ?? PENDENT)}
      compte={nom}
      arrossegats={deures.arrossegats}
      propis={deures.propis}
      atributs={atributs}
    />
  );
}
