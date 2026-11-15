import Link from "next/link";

import { AvisConnexio } from "@/components/AvisConnexio";
import { Capcalera, Dada, EstatBuit, Etiqueta, Plafo, Seccio } from "@/components/UI";
import { type Taula, FITXA_TAULA, TAULES, esTaula, resumComptadors } from "@/domini/sincronitzacio";
import { dataHoraCurta } from "@/lib/format";
import { rutaDelClient } from "@/lib/navegacio";
import { type RecompteArticles, credencialsActives, recompteArticles } from "@/serveis/configuracio";
import { clientsPerCategoria, frangesDeCategoria } from "@/serveis/crm-categoria";
import { llistaTipusActivitat, usosDelsTipus } from "@/serveis/crm-tipus-activitat";
import {
  type PanellGlobal, type PanellSincronitzacio, panellAlbarans, panellArticles, panellClients, panellGlobal, panellProveidors,
} from "@/serveis/sincronitzacio";

import { BotoProva } from "./BotoProva";
import { FormulariCategoria } from "./FormulariCategoria";
import { FormulariProgramacions } from "./FormulariProgramacions";
import { FormulariTipusActivitat } from "./FormulariTipusActivitat";
import { type TaulaPerTriar, PanellSincronitzaAra, SeguimentAdjunt } from "./PanellSincronitzaAra";
import { HistorialPassades, ResultatPassada } from "./ResultatPassada";
import { TaulaAlbaransFactusol } from "./TaulaAlbaransFactusol";
import { TaulaArticlesFactusol } from "./TaulaArticlesFactusol";
import { TaulaClientsFactusol } from "./TaulaClientsFactusol";
import { TaulaProveidorsFactusol } from "./TaulaProveidorsFactusol";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export const metadata = { title: "Configuració · Wine Backend" };

const VARIABLES = ["api_url", "api_fabricante", "api_cliente", "api_db", "api_ejercicio", "api_password"];

/**
 * La primera pestanya és la sincronització global: des d'on s'engega i es
 * programa tot. Després, una pestanya per taula de l'ERP amb els resultats de
 * les seves passades i la taula en cru, i al final els valors del CRM i la
 * connexió.
 */
const PESTANYES = [
  { clau: "sincronitzacio", etiqueta: "Sincronització" },
  { clau: "clients", etiqueta: "Clients" },
  { clau: "proveidors", etiqueta: "Proveïdors" },
  { clau: "articles", etiqueta: "Articles" },
  { clau: "albarans", etiqueta: "Albarans" },
  { clau: "valors", etiqueta: "Valors CRM" },
  { clau: "connexio", etiqueta: "Connexió" },
] as const;

type Pestanya = (typeof PESTANYES)[number]["clau"];

export default async function PaginaConfiguracio({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; p?: string; taules?: string }>;
}) {
  await exigeixVeuTot();
  const { t, p = "1", taules } = await searchParams;
  const pestanya: Pestanya = PESTANYES.some((x) => x.clau === t) ? (t as Pestanya) : "sincronitzacio";
  const credencials = credencialsActives();

  const pagina = Number(p) || 1;
  const global = pestanya === "sincronitzacio" ? await panellGlobal() : null;
  const clients = pestanya === "clients" ? await panellClients(pagina) : null;
  const proveidors = pestanya === "proveidors" ? await panellProveidors(pagina) : null;
  const [articles, recompte] =
    pestanya === "articles" ? await Promise.all([panellArticles(pagina), recompteArticles()]) : [null, null];
  const albarans = pestanya === "albarans" ? await panellAlbarans(pagina) : null;
  const total = clients?.llista?.total ?? proveidors?.llista?.total ?? articles?.llista?.total ?? albarans?.llista?.total ?? null;

  // Les taules que es volen deixar marcades en obrir la pestanya global: «?taules=clients,articles».
  const preseleccio = (taules ?? "").split(",").filter(esTaula);

  const enllac = (clau: Pestanya, pagina?: number) =>
    `/configuracio?${new URLSearchParams({ t: clau, ...(pagina && pagina > 1 ? { p: String(pagina) } : {}) })}`;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Capcalera
        titol="Configuració"
        descripcio="Sincronització amb FactuSol (API de DELSOL), resultats de cada taula, valors del CRM i connexió."
        accions={
          credencials ? (
            <Etiqueta to="verd">Credencials a l&apos;entorn</Etiqueta>
          ) : (
            <Etiqueta to="vi">Sense configurar</Etiqueta>
          )
        }
      />

      {/* Embolcallen en comptes de rascar: al mòbil no hi ha scroll de costat. */}
      <nav className="mt-5 flex flex-wrap gap-1 border-b border-line" aria-label="Seccions de configuració">
        {PESTANYES.map((x) => {
          const activa = x.clau === pestanya;
          return (
            <Link
              key={x.clau}
              href={enllac(x.clau)}
              aria-current={activa ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] transition-colors ${
                activa
                  ? "border-wine font-medium text-ink"
                  : "border-transparent text-muted hover:border-line hover:text-ink-soft"
              }`}
            >
              {x.etiqueta}
              {x.clau === pestanya && total !== null ? (
                <span className={`rounded px-1.5 py-px text-[11px] tabular-nums ${activa ? "bg-wine-tint text-wine-deep" : "bg-parchment text-muted"}`}>
                  {total}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {global ? (
          <SeccioGlobal panell={global} credencials={Boolean(credencials)} preseleccio={preseleccio.length > 0 ? preseleccio : TAULES} />
        ) : clients ? (
          <SeccioResultats
            credencials={Boolean(credencials)}
            panell={clients}
            descripcio={
              <>
                Els clients de <TaulaErp nom="F_CLI" /> es copien als clients del CRM, lligats pel codi d&apos;ERP. Als camps que
                vénen de FactuSol hi mana FactuSol —també l&apos;estat i el tipus de client, que es copien abans de F_TCL—; els del CRM
                (potencial, zona, comercial, horaris, notes) no es toquen mai. Els clients que desapareixen de l&apos;ERP no s&apos;esborren: queden marcats com a absents.
                A la mateixa passada es copien els establiments de cada client, que són les seves direccions d&apos;entrega de{" "}
                <TaulaErp nom="F_OBR" />: surten a la pestanya Establiments de la fitxa i són els punts del mapa.
              </>
            }
            titolPortal="Clients creats al portal"
            notaPortal="No estan lligats a cap client de FactuSol. Per lligar-ne un, posa-li el codi d'ERP a la seva fitxa del CRM: a la propera passada rebrà les dades de l'ERP i passarà a tenir FactuSol com a font."
            enllacFitxa={(id) => rutaDelClient(id)}
            taula={(llista, situacio) => (
              <TaulaClientsFactusol dades={llista} situacio={situacio} enllacPagina={(numero) => enllac("clients", numero)} />
            )}
          />
        ) : proveidors ? (
          <SeccioResultats
            credencials={Boolean(credencials)}
            panell={proveidors}
            descripcio={
              <>
                De <TaulaErp nom="F_PRO" /> només es copien els proveïdors homologats —la casella «Proveedor homologado»
                d&apos;Otros datos—, que són els cellers de qui es compra: la taula sencera també porta transportistes,
                gestories i subministraments. S&apos;hi copien la identitat, l&apos;adreça, el contacte i les condicions de
                pagament (forma de pagament, IBAN, retenció i descompte). Un celler que deixi d&apos;estar homologat no
                s&apos;esborra: queda marcat com a absent, amb tot el que hi penja.
              </>
            }
            titolPortal="Proveïdors creats al portal"
            notaPortal="No estan lligats a cap proveïdor de FactuSol. Per lligar-ne un, posa-li el codi d'ERP a la seva fitxa: a la propera passada rebrà les dades de l'ERP i passarà a tenir FactuSol com a font."
            taula={(llista, situacio) => (
              <TaulaProveidorsFactusol dades={llista} situacio={situacio} enllacPagina={(numero) => enllac("proveidors", numero)} />
            )}
          />
        ) : articles ? (
          <SeccioResultats
            credencials={Boolean(credencials)}
            panell={articles}
            descripcio={
              <>
                De <TaulaErp nom="F_ART" /> només es copien els articles actius: els descatalogats i els que no es poden fer
                servir es queden a FactuSol. De cada article es copien el codi, la descripció, la família, el codi de barres
                i el proveïdor habitual, que queda lligat al seu celler si és un dels homologats. La foto es copia a Directus
                quan canvia a FactuSol, a tongades de 150 per passada. Un article que deixa de ser actiu no s&apos;esborra:
                queda marcat com a absent i surt del llistat d&apos;articles.
                {recompte ? <RecompteArticlesErp recompte={recompte} /> : null}
              </>
            }
            titolPortal="Articles creats al portal"
            notaPortal="No estan lligats a cap article de FactuSol. Per lligar-ne un, posa-li el codi d'ERP: a la propera passada rebrà les dades de l'ERP."
            taula={(llista, situacio) => (
              <TaulaArticlesFactusol dades={llista} situacio={situacio} enllacPagina={(numero) => enllac("articles", numero)} />
            )}
          />
        ) : albarans ? (
          <SeccioResultats
            credencials={Boolean(credencials)}
            panell={albarans}
            descripcio={
              <>
                Els albarans de venda de <TaulaErp nom="F_ALB" /> i les seves línies de <TaulaErp nom="F_LAL" />, d&apos;aquest
                exercici i del passat, que surten a la pestanya Facturació de cada client. Només es copien els dels clients
                que surten al CRM: els de baixa no. Cada línia apunta al seu article si és un dels actius. Un albarà que
                desapareix de FactuSol no s&apos;esborra: queda marcat com a absent i deixa de sortir. La primera càrrega de
                línies es fa a tongades de 20.000 per passada; el registre diu quantes en queden.
              </>
            }
            titolPortal="Albarans creats al portal"
            notaPortal="No estan lligats a cap albarà de FactuSol."
            taula={(llista, situacio) => (
              <TaulaAlbaransFactusol dades={llista} situacio={situacio} enllacPagina={(numero) => enllac("albarans", numero)} />
            )}
          />
        ) : pestanya === "valors" ? (
          <SeccioValorsCrm />
        ) : (
          <SeccioConnexio credencials={credencials} />
        )}
      </div>
    </div>
  );
}

/** Quants articles de F_ART són actius i quants històrics (per quina marca), i quants actius tenen foto. */
function RecompteArticlesErp({ recompte }: { recompte: RecompteArticles }) {
  const marques = recompte.perMarca.filter((marca) => marca.quants > 0).map((marca) => `${marca.quants} ${marca.plural}`);
  return (
    <>
      {" "}Ara mateix, de {recompte.total} articles a <TaulaErp nom="F_ART" />, n&apos;hi ha {recompte.actius} d&apos;actius i{" "}
      {recompte.total - recompte.actius} d&apos;històrics{marques.length > 0 ? ` (${marques.join(" i ")})` : ""}; es copien tots, els
      històrics marcats i sense foto, i {recompte.ambFoto} dels actius tenen foto.
    </>
  );
}

/** El nom d'una taula de FactuSol, sempre igual. */
function TaulaErp({ nom }: { nom: string }) {
  return <span className="font-mono text-[13px]">{nom}</span>;
}

/** Directus encara no té (tot) el model de la sincronització: què cal fer. */
function AvisModel({ titol, text, detall }: { titol: string; text: React.ReactNode; detall?: string | null }) {
  return (
    <div className="card border-wine/30 p-5">
      <p className="text-[14px] font-medium text-wine-deep">{titol}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{text}</p>
      {detall ? <p className="mt-2 rounded-lg bg-parchment px-3.5 py-2.5 font-mono text-[12.5px] text-ink">{detall}</p> : null}
    </div>
  );
}

const SCRIPT = <span className="font-mono text-[13px]">scripts/crm-directus.mjs</span>;

/**
 * La pestanya global: engegar el que es vulgui, programar-ho i veure les
 * darreres passades de totes les taules.
 */
function SeccioGlobal({ panell, credencials, preseleccio }: { panell: PanellGlobal; credencials: boolean; preseleccio: Taula[] }) {
  const taules: TaulaPerTriar[] = panell.taules.map((resum) => ({
    taula: resum.taula,
    enCurs: resum.enCurs,
    propera: resum.programacio.activa ? resum.propera : null,
    darrera: resum.darrera
      ? {
          estat: resum.darrera.estat,
          inici: resum.darrera.inici,
          fi: resum.darrera.fi,
          resum:
            resum.darrera.estat === "error" || resum.darrera.estat === "en_curs"
              ? ""
              : resumComptadors({
                  llegits: resum.darrera.llegits ?? 0,
                  creats: resum.darrera.creats ?? 0,
                  actualitzats: resum.darrera.actualitzats ?? 0,
                  absents: resum.darrera.absents ?? 0,
                  iguals: resum.darrera.iguals ?? 0,
                  fallits: resum.darrera.fallits ?? 0,
                  pendents: resum.darrera.pendents ?? 0,
                }),
        }
      : null,
  }));
  const programacions = Object.fromEntries(panell.taules.map((resum) => [resum.taula, resum.programacio])) as Parameters<
    typeof FormulariProgramacions
  >[0]["inicials"];
  const properes = Object.fromEntries(panell.taules.map((resum) => [resum.taula, resum.propera])) as Record<Taula, string | null>;

  const motiu = !credencials
    ? "Cal definir les credencials de FactuSol a l'entorn del servei per poder sincronitzar."
    : panell.avisDirectus
      ? "Directus encara no té el model de la sincronització."
      : undefined;

  return (
    <div className="space-y-4">
      {panell.avisDirectus ? (
        <AvisModel
          titol="Directus encara no té el model de la sincronització."
          text={
            <>
              Executa {SCRIPT} i <span className="font-mono text-[13px]">scripts/crm-acces.mjs</span> amb credencials
              d&apos;administrador. Detall:
            </>
          }
          detall={panell.avisDirectus}
        />
      ) : !panell.registreAmpliat ? (
        <AvisModel
          titol="El registre de sincronitzacions encara no té els camps del seguiment."
          text={
            <>
              Les passades funcionen igual, però si es recarrega la pàgina no es veurà on són, i les fitxes que Directus no
              accepti només es comptaran al missatge. Executa {SCRIPT} amb credencials d&apos;administrador per afegir-hi la
              fase, el progrés i la llista d&apos;errors.
            </>
          }
        />
      ) : null}

      <PanellSincronitzaAra taules={taules} preseleccio={preseleccio} potSincronitzar={credencials && !panell.avisDirectus} motiu={motiu} />

      <Seccio titol="Programació">
        <p className="text-[14px] leading-relaxed text-muted">
          El portal fa les passades sol amb la periodicitat triada per a cada taula. Les diàries i setmanals es fan a l&apos;hora
          indicada, en hora local de la bodega; si una passada és en marxa quan toca la següent, s&apos;espera.
        </p>
        <div className="mt-3">
          {panell.avisDirectus ? (
            <p className="text-[13px] text-muted">Sense el model a Directus no hi ha on desar la programació.</p>
          ) : (
            <FormulariProgramacions inicials={programacions} properes={properes} />
          )}
        </div>
      </Seccio>

      <Seccio titol="Darreres passades">
        <HistorialPassades execucions={panell.historial} ambTaula />
      </Seccio>
    </div>
  );
}

/**
 * Una pestanya de resultats: com ha anat la darrera passada d'aquesta taula,
 * què faria la propera, les fitxes que només són al portal, l'historial i la
 * taula de l'ERP en cru. És la mateixa per a totes les taules; només canvien
 * els textos i les columnes. Per engegar-ne una, s'envia a la pestanya global.
 */
function SeccioResultats<F>({
  credencials,
  panell,
  descripcio,
  titolPortal,
  notaPortal,
  enllacFitxa,
  taula,
}: {
  credencials: boolean;
  panell: PanellSincronitzacio<F>;
  descripcio: React.ReactNode;
  titolPortal: string;
  notaPortal: string;
  /** On porta una fitxa creada al portal, si té pantalla pròpia. */
  enllacFitxa?: (id: string) => string;
  taula: (
    llista: NonNullable<PanellSincronitzacio<F>["llista"]>,
    situacio: PanellSincronitzacio<F>["situacio"],
  ) => React.ReactNode;
}) {
  const { avisDirectus, programacio, darrera, propera, enCurs, historial, llista, situacio, resum, nomesPortal, fallada } = panell;
  const fitxa = FITXA_TAULA[panell.taula];
  const pendents = resum ? resum.nous + resum.canviats + resum.absentsPendents : 0;
  const capASincronitzar = `/configuracio?${new URLSearchParams({ t: "sincronitzacio", taules: panell.taula })}`;
  const enllacSincronitza = (
    <Link href={capASincronitzar} className="text-[12.5px] font-medium text-wine underline-offset-2 hover:underline">
      Sincronitza {fitxa.plural} →
    </Link>
  );

  return (
    <div className="space-y-4">
      {avisDirectus ? (
        <AvisModel
          titol="Directus encara no té el model de la sincronització."
          text={
            <>
              Executa {SCRIPT} i <span className="font-mono text-[13px]">scripts/crm-acces.mjs</span> amb credencials
              d&apos;administrador. Detall:
            </>
          }
          detall={avisDirectus}
        />
      ) : null}

      <Seccio titol="Què es copia" accions={credencials && !avisDirectus && !enCurs ? enllacSincronitza : null}>
        <p className="text-[14px] leading-relaxed text-muted">{descripcio}</p>
      </Seccio>

      {enCurs ? (
        <Seccio titol="Passada en curs">
          <SeguimentAdjunt taula={panell.taula} />
        </Seccio>
      ) : null}

      <Seccio titol="Darrera passada">
        {darrera && (!enCurs || darrera.estat !== "en_curs") ? (
          <ResultatPassada execucio={darrera} />
        ) : !enCurs ? (
          <p className="text-[14px] text-muted">Encara no se n&apos;ha fet cap.</p>
        ) : (
          <p className="text-[14px] text-muted">És la que corre ara mateix.</p>
        )}
        <p className="mt-4 border-t border-line pt-3 text-[13px] text-muted">
          {programacio.activa
            ? propera
              ? `Propera passada programada: ${dataHoraCurta(propera)}.`
              : "Propera passada programada: pendent de calcular."
            : "Sincronització automàtica aturada."}{" "}
          <Link href="/configuracio?t=sincronitzacio" className="text-wine underline-offset-2 hover:underline">
            Canvia la programació
          </Link>
          .
        </p>
      </Seccio>

      {resum ? (
        <Plafo titol="Què faria la propera passada">
          <p className="text-[13.5px] text-muted">
            {pendents === 0
              ? "Directus ja està al dia amb FactuSol."
              : `${pendents} ${pendents === 1 ? "canvi pendent" : "canvis pendents"} d'aplicar. La columna «Directus» de la taula de sota diu què li passarà a cada fitxa.`}
          </p>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Dada etiqueta="Per crear" valor={String(resum.nous)} />
            <Dada etiqueta="Per actualitzar" valor={String(resum.canviats)} />
            <Dada etiqueta="Al dia" valor={String(resum.iguals)} />
            <Dada
              etiqueta="Absents de l'ERP"
              valor={`${resum.absentsMarcats} ${resum.absentsMarcats === 1 ? "marcat" : "marcats"}${resum.absentsPendents ? `, ${resum.absentsPendents} per marcar` : ""}`}
            />
            {resum.duplicats ? <Dada etiqueta="Codis repetits a Directus" valor={String(resum.duplicats)} /> : null}
          </div>
        </Plafo>
      ) : null}

      {nomesPortal.length > 0 ? (
        <Seccio titol={`${titolPortal} (${nomesPortal.length})`}>
          <p className="text-[14px] leading-relaxed text-muted">{notaPortal}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {nomesPortal.map((fitxaPortal) => (
              <li key={fitxaPortal.id}>
                {enllacFitxa ? (
                  <Link
                    href={enllacFitxa(fitxaPortal.id)}
                    className="inline-flex rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px] transition hover:border-ink"
                  >
                    {fitxaPortal.nom}
                  </Link>
                ) : (
                  <span className="inline-flex rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px]">{fitxaPortal.nom}</span>
                )}
              </li>
            ))}
          </ul>
        </Seccio>
      ) : null}

      {historial.length > 0 ? (
        <Seccio titol="Historial de passades">
          <HistorialPassades execucions={historial} />
        </Seccio>
      ) : null}

      <div>
        <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          {fitxa.etiqueta} a FactuSol
        </h2>
        {!credencials ? (
          <EstatBuit
            titol="Sense credencials"
            text={`Defineix les variables api_* a l'entorn del servei per llegir la taula ${panell.origen} de FactuSol.`}
          />
        ) : fallada ? (
          <AvisConnexio error={fallada} />
        ) : !llista || llista.files.length === 0 ? (
          <EstatBuit titol="Cap fitxa" text={`La taula ${panell.origen} d'aquest exercici no retorna cap fitxa.`} />
        ) : (
          <>
            <p className="mb-3 text-[13.5px] text-muted">
              {llista.total} {llista.total === 1 ? "fitxa" : "fitxes"} a <TaulaErp nom={panell.origen} /> · exercici{" "}
              {llista.exercici}. La columna «Directus» diu què li passarà a cada fitxa a la propera passada.
            </p>
            {taula(llista, situacio)}
          </>
        )}
      </div>
    </div>
  );
}

/** Els valors que governen el CRM: les franges de la categoria i els tipus d'activitat. Un no s'endú l'altre si falla. */
function SeccioValorsCrm() {
  return (
    <div className="max-w-[820px] space-y-4">
      <PlafoCategoria />
      <PlafoTipusActivitat />
    </div>
  );
}

async function PlafoCategoria() {
  let franges;
  let quants: Record<string, number> = {};
  try {
    [franges, quants] = await Promise.all([frangesDeCategoria(), clientsPerCategoria()]);
  } catch (error) {
    return <EstatBuit titol="No s'han pogut llegir els valors del CRM" text={(error as Error).message} />;
  }

  return (
    <Plafo titol="Categoria dels clients">
      <p className="text-[14px] leading-relaxed text-muted">
        La categoria de cada client es calcula sola amb la facturació de l&apos;exercici passat sencer (base imposable,
        sense IVA): li toca la lletra de la franja on cau. Es posa al dia a cada sincronització de clients i, en desar
        aquí, es recalcula a tots els clients de cop. La columna «Clients» compta els que surten al CRM: ni els de
        baixa ni els d&apos;altres tipus que no siguin restaurant, botiga especialitzada, distribuïdor o catering. El
        potencial és una altra cosa: la mateixa escala, però la posa a mà qui porta el compte, a la fitxa del client.
      </p>
      <div className="mt-4">
        <FormulariCategoria franges={franges} quants={quants} />
      </div>
    </Plafo>
  );
}

/** La taula dels tipus d'activitat. Sense la taula a Directus, el CRM fa servir els de partida i aquí es diu què cal fer. */
async function PlafoTipusActivitat() {
  let tipus;
  let usos: Record<string, number> = {};
  let detall: string | null = null;
  try {
    [tipus, usos] = await Promise.all([llistaTipusActivitat(), usosDelsTipus()]);
  } catch (error) {
    detall = (error as Error).message;
  }

  if (!tipus || tipus.length === 0) {
    return (
      <AvisModel
        titol="Directus encara no té la taula dels tipus d'activitat."
        text={
          <>
            Mentrestant, el CRM fa servir els tipus de sempre. Per poder-ne crear de nous, executa{" "}
            <span className="font-mono text-[13px]">scripts/crm-tipus-activitat.mjs</span> amb credencials d&apos;administrador.
          </>
        }
        detall={detall}
      />
    );
  }

  return (
    <Plafo titol="Tipus d'activitat">
      <p className="text-[14px] leading-relaxed text-muted">
        Els tipus que es trien en crear una activitat. Canviar-ne el nom no toca cap activitat: les que ja hi ha surten
        amb el nom nou. Només es poden esborrar els creats aquí que encara no tenen cap activitat. Portar diversos
        clients o cellers a la mateixa visita és propi de les visites de client/s a celler i de cellers a client: en un
        tipus nou, no es pot.
      </p>
      <dl className="mt-3 grid gap-x-2 gap-y-1 text-[13px] leading-relaxed text-muted sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="font-medium text-ink-soft">Compta com a visita</dt>
        <dd className="mb-1 sm:mb-0">Les activitats d&apos;aquest tipus sumen a les visites del tauler.</dd>
        <dt className="font-medium text-ink-soft">Demana vins</dt>
        <dd className="mb-1 sm:mb-0">El formulari de l&apos;activitat mostra el camp dels vins presentats o tastats.</dd>
        <dt className="font-medium text-ink-soft">Demana celler</dt>
        <dd className="mb-1 sm:mb-0">El formulari de l&apos;activitat mostra el camp del celler.</dd>
        <dt className="font-medium text-ink-soft">Es pot triar</dt>
        <dd className="mb-1 sm:mb-0">Surt en crear una activitat. Si el desmarques, les que ja el tenen el conserven.</dd>
        <dt className="font-medium text-ink-soft">Núm. d&apos;activitats</dt>
        <dd>Quantes activitats d&apos;aquest tipus hi ha ara mateix.</dd>
      </dl>
      <div className="mt-4">
        <FormulariTipusActivitat tipus={tipus} usos={usos} />
      </div>
    </Plafo>
  );
}

function SeccioConnexio({ credencials }: { credencials: ReturnType<typeof credencialsActives> }) {
  return (
    <div className="max-w-[820px] space-y-4">
      <Plafo titol="Estat">
        {credencials ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Dada etiqueta="Base de dades" valor={credencials.baseDades} />
            <Dada etiqueta="Exercici" valor={credencials.exercici} />
            <Dada etiqueta="Codi de fabricant" valor={String(credencials.codiFabricant)} />
            <Dada etiqueta="Codi de client" valor={String(credencials.codiClient)} />
            <Dada etiqueta="URL de l'API" valor={credencials.urlApi} />
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-muted">
            El servei no té cap credencial de FactuSol. Defineix-les com a variables d&apos;entorn i
            torna a desplegar; el portal no les desa enlloc.
          </p>
        )}
      </Plafo>

      <Plafo titol="Variables del servei">
        <p className="text-[14px] leading-relaxed text-muted">
          La configuració es llegeix de l&apos;entorn, no d&apos;una base de dades del portal. Això la
          fa estable entre desplegaments i evita guardar la contrasenya en cap fitxer.{" "}
          <span className="font-mono text-[13px]">api_ejercicio</span> admet{" "}
          <span className="font-mono text-[13px]">&lt;year&gt;</span> per agafar l&apos;any en curs.
        </p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {VARIABLES.map((variable) => (
            <li key={variable} className="font-mono text-[12.5px] text-ink-soft">
              {variable}
            </li>
          ))}
        </ul>
      </Plafo>

      <Plafo titol="Comprovació">
        <p className="text-[14px] leading-relaxed text-muted">
          Llança una consulta real contra <span className="font-mono text-[13px]">F_CLI</span> i informa
          del que respon l&apos;API.
        </p>
        <div className="mt-3">
          <BotoProva />
        </div>
      </Plafo>
    </div>
  );
}
