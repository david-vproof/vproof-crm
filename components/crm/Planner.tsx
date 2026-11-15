import Link from "next/link";

import {
  SENYAL_OBERTA,
  SENYAL_TANCADA,
  descriuEstat,
  senyalActivitat,
} from "@/components/crm/EstatActivitat";
import { EstatBuit } from "@/components/UI";
import {
  DIES_SETMANA,
  DIES_SETMANA_LLARG,
  dillunsDe,
  type DiaPlanner,
  type Esdeveniment,
  type GrupSegment,
} from "@/domini/crm-planner";
import { TriaComercial, type OpcioAgenda } from "@/components/crm/TriaComercial";
import { calendariDelPlanner, setmanaDelPlanner, type SegmentPintat } from "@/serveis/crm-planner";
import { agentsDelPortal } from "@/serveis/usuaris";

/** Els paràmetres que situen el calendari, per no perdre'ls en obrir una fitxa. */
const enllacFitxa = (id: string, on: string) => `/crm?v=planner&${on}&r=${id}`;
const enllacAlta = (dia: string, on: string) => `/crm?v=planner&${on}&r=nou&pre=data:${dia}T09:00`;

/** Quantes visites caben en una casella del mes abans de resumir la resta. */
const MAXIM_PER_DIA = 4;

const posicioSetmana = (clau: string) => (new Date(`${clau}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Una visita: l'hora, qui es visita i les seves lletres (categoria i potencial), del color del segment. */
function Visita({
  acte,
  on,
  gran = false,
  embolcalla = false,
}: {
  acte: Esdeveniment;
  on: string;
  gran?: boolean;
  /** A la setmana hi ha alçada: val més el nom sencer en dues línies que retallat. */
  embolcalla?: boolean;
}) {
  return (
    <Link
      href={enllacFitxa(acte.id, on)}
      title={
        `${acte.hora} · ${acte.compte || acte.titol}` +
        (acte.categoria ? ` · categoria ${acte.categoria}` : "") +
        (acte.potencial ? ` · potencial ${acte.potencial}` : "") +
        ` · ${acte.tipus} · ${acte.segment}` +
        ` · ${descriuEstat(acte.tancada, acte.resultat)}\n${acte.titol}`
      }
      style={{ backgroundColor: `${acte.color}14`, borderLeftColor: acte.color }}
      className={`flex items-baseline gap-1 rounded-r-md border-l-[3px] py-1 pl-1.5 pr-0.5 transition hover:brightness-95 ${
        gran ? "text-[13px]" : "text-[11.5px]"
      } ${acte.tancada ? "text-muted" : "text-ink-soft"}`}
    >
      {/* Tancada o oberta, d'un cop d'ull: en una casella de mes no hi cap res
          més llarg que un caràcter, i saber què queda per fer és el que es ve
          a buscar en un calendari de ruta. */}
      <span
        aria-hidden
        className={`shrink-0 ${gran ? "text-[11px]" : "text-[9.5px]"} ${acte.tancada ? "opacity-90" : "opacity-45"}`}
        style={{ color: acte.color }}
      >
        {senyalActivitat(acte.tancada)}
      </span>
      {/* L'hora, més menuda: en una casella qui es visita val més que el rellotge. */}
      <span
        className={`shrink-0 tabular-nums ${gran ? "text-[12px]" : "text-[10.5px]"} ${
          acte.tancada ? "font-normal opacity-70" : "font-semibold"
        }`}
        style={{ color: acte.color }}
      >
        {acte.hora}
      </span>
      <span className={embolcalla ? "line-clamp-2 leading-snug" : "truncate"}>{acte.compte || acte.titol}</span>

      {/* Les lletres van al final i no empenyen el nom: són un qualificador, no el títol.
          Primer la categoria i després el potencial; la que falta és un punt, perquè es llegeixen per posició. */}
      {acte.categoria || acte.potencial ? (
        <span
          className={`ml-auto shrink-0 rounded bg-white/70 px-1 font-bold tracking-wide ${gran ? "text-[11px]" : "text-[9.5px]"}`}
          style={{ color: acte.color }}
          title={`Categoria ${acte.categoria ?? "–"} · Potencial ${acte.potencial ?? "–"}`}
        >
          {acte.categoria ?? "·"}
          {acte.potencial ?? "·"}
        </span>
      ) : null}
    </Link>
  );
}

/** El rètol d'un segment dins d'un dia. */
function RetolSegment({ grup, gran = false }: { grup: GrupSegment; gran?: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 pt-0.5 font-semibold uppercase tracking-[0.08em] ${
        gran ? "text-[11px]" : "text-[9.5px]"
      }`}
      style={{ color: grup.color }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: grup.color }} />
      <span className="truncate">{grup.segment}</span>
    </span>
  );
}

/**
 * Els segments d'un dia. Es talla per visites i no per grups: el que importa
 * és quantes en caben. Sense màxim —a la setmana hi ha alçada— no es talla res.
 */
function SegmentsDelDia({
  dia,
  on,
  maxim,
  gran = false,
  embolcalla = false,
  obreDia,
}: {
  dia: DiaPlanner;
  on: string;
  maxim?: number;
  gran?: boolean;
  embolcalla?: boolean;
  /** On porta el «+n més» quan no hi caben totes: la setmana del dia, que no en talla cap. */
  obreDia?: string;
}) {
  const visibles: GrupSegment[] = [];
  let mostrades = 0;

  for (const grup of dia.grups) {
    if (maxim !== undefined && mostrades >= maxim) break;
    const cabuda = maxim === undefined ? grup.esdeveniments : grup.esdeveniments.slice(0, maxim - mostrades);
    visibles.push({ ...grup, esdeveniments: cabuda });
    mostrades += cabuda.length;
  }

  const resta = dia.total - mostrades;

  return (
    <div className={`flex flex-col ${gran ? "gap-2" : "gap-[3px]"}`}>
      {visibles.map((grup) => (
        <div key={grup.segmentId || "cap"} className={`flex flex-col ${gran ? "gap-1" : "gap-[2px]"}`}>
          <RetolSegment grup={grup} gran={gran} />
          {grup.esdeveniments.map((acte) => (
            <Visita key={acte.id} acte={acte} on={on} gran={gran} embolcalla={embolcalla} />
          ))}
        </div>
      ))}

      {resta > 0 ? (
        // Les que no hi caben, en passar-hi per sobre; en clicar, el dia sencer a la vista de setmana.
        <Link
          href={obreDia ?? `/crm?v=planner&pv=setmana&s=${dia.clau}`}
          className="self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted transition hover:bg-parchment hover:text-ink"
          title={dia.grups
            .flatMap((grup) => grup.esdeveniments.map((a) => `${a.hora} ${a.compte || a.titol} · ${grup.segment}`))
            .join("\n")}
          aria-label={`Obre les ${dia.total} activitats del dia ${dia.numero}`}
        >
          +{resta} més
        </Link>
      ) : null}
    </div>
  );
}

/** El botó discret d'alta que porta cada dia, també els passats: s'hi apunta el que ja s'ha fet. */
function BotoAlta({ dia, on }: { dia: DiaPlanner; on: string }) {
  return (
    <Link
      href={enllacAlta(dia.clau, on)}
      aria-label={`Nova activitat el ${dia.numero}`}
      className="grid size-5 place-items-center rounded-md text-[15px] leading-none text-muted opacity-0 transition hover:bg-parchment hover:text-ink focus-visible:opacity-100 group-hover/dia:opacity-100"
    >
      +
    </Link>
  );
}

function NumeroDia({ dia }: { dia: DiaPlanner }) {
  return (
    <span
      className={`grid size-6 place-items-center rounded-full text-[12px] tabular-nums ${
        dia.avui ? "bg-marca font-semibold text-cream" : dia.delMes ? "font-medium text-ink" : "text-muted/50"
      }`}
    >
      {dia.numero}
    </span>
  );
}

function CasellaMes({ dia, on, amb }: { dia: DiaPlanner; on: string; amb: string }) {
  return (
    <div
      className={`group/dia flex min-h-[116px] flex-col gap-1 border-b border-r border-line/70 p-1.5 transition-colors ${
        dia.delMes ? (dia.capDeSetmana ? "bg-parchment/25" : "bg-white") : "bg-parchment/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <NumeroDia dia={dia} />
        {/* Discret fins que la mà hi passa per sobre: el calendari es llegeix
            molt més sovint del que s'hi escriu. */}
        <BotoAlta dia={dia} on={on} />
      </div>
      <SegmentsDelDia dia={dia} on={on} maxim={MAXIM_PER_DIA} obreDia={`/crm?v=planner&pv=setmana&s=${dia.clau}${amb}`} />
    </div>
  );
}

/** Columna d'un dia a la vista de setmana: hi ha alçada, així que no es talla res. */
function ColumnaSetmana({ dia, on }: { dia: DiaPlanner; on: string }) {
  return (
    <div
      className={`group/dia flex min-h-[380px] flex-col border-r border-line/70 last:border-r-0 ${
        dia.capDeSetmana ? "bg-parchment/25" : "bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-line/70 px-2 py-1.5">
        <span className="flex items-center gap-1.5">
          <NumeroDia dia={dia} />
          <span className="text-[11.5px] text-muted">{DIES_SETMANA_LLARG[posicioSetmana(dia.clau)]}</span>
        </span>
        <BotoAlta dia={dia} on={on} />
      </div>

      <div className="p-1.5">
        {dia.total === 0 ? (
          <p className="px-1 pt-1 text-[11.5px] text-muted/60">Lliure</p>
        ) : (
          <SegmentsDelDia dia={dia} on={on} embolcalla />
        )}
      </div>
    </div>
  );
}

/** L'agenda per dies, per a pantalles on set columnes no es llegeixen. */
function Agenda({ dies, on, buit }: { dies: DiaPlanner[]; on: string; buit: string }) {
  const ambActivitat = dies.filter((dia) => dia.delMes && dia.total > 0);
  if (ambActivitat.length === 0) return <EstatBuit titol="Cap activitat" text={buit} />;

  return (
    <div className="space-y-3">
      {ambActivitat.map((dia) => (
        <section key={dia.clau} className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line bg-cream/60 px-3 py-2">
            <span className="flex items-center gap-2 text-[13px]">
              <NumeroDia dia={dia} />
              <span className="text-muted">{DIES_SETMANA_LLARG[posicioSetmana(dia.clau)]}</span>
            </span>
            <Link href={enllacAlta(dia.clau, on)} className="text-[12.5px] text-muted hover:text-ink">
              + Nova
            </Link>
          </div>
          <div className="p-2.5">
            <SegmentsDelDia dia={dia} on={on} gran />
          </div>
        </section>
      ))}
    </div>
  );
}

function Capcalera({
  titol,
  total,
  perTancar,
  anterior,
  seguent,
  avui,
  aMes,
  aSetmana,
  setmanal,
  agenda,
}: {
  titol: string;
  total: number;
  perTancar: number;
  anterior: string;
  seguent: string;
  avui: string;
  aMes: string;
  aSetmana: string;
  setmanal: boolean;
  /** El selector de qui és l'agenda. */
  agenda: React.ReactNode;
}) {
  const pas =
    "grid size-8 place-items-center rounded-lg border border-line bg-white text-muted transition hover:border-ink hover:text-ink";
  const tria = (activa: boolean) =>
    `rounded-md px-2.5 py-1 text-[12.5px] transition ${
      activa ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="font-display text-[24px] leading-none tracking-[-0.01em]">{titol}</h2>
        <span className="text-[13px] text-muted">
          {total} {total === 1 ? "activitat" : "activitats"}
          {perTancar > 0 ? (
            <span className="ml-2 rounded bg-amber-50 px-1.5 py-px text-[12px] font-medium text-amber-800">
              {perTancar} per tancar
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {agenda}

        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-parchment/60 p-0.5">
          <Link href={aMes} className={tria(!setmanal)}>
            Mes
          </Link>
          <Link href={aSetmana} className={tria(setmanal)}>
            Setmana
          </Link>
        </div>

        <nav className="flex items-center gap-1" aria-label={setmanal ? "Canvi de setmana" : "Canvi de mes"}>
          <Link href={anterior} aria-label={setmanal ? "Setmana anterior" : "Mes anterior"} className={pas}>
            ‹
          </Link>
          <Link
            href={avui}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink"
          >
            Avui
          </Link>
          <Link href={seguent} aria-label={setmanal ? "Setmana següent" : "Mes següent"} className={pas}>
            ›
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Llegenda({ segments }: { segments: SegmentPintat[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted">
      {segments.map((segment) => (
        <li key={segment.id} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
          {segment.nom}
        </li>
      ))}
      {/* Què vol dir el senyal de davant de cada hora. */}
      <li className="flex items-center gap-1.5">
        <span aria-hidden>{SENYAL_OBERTA}</span> oberta
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden>{SENYAL_TANCADA}</span> tancada
      </li>
    </ul>
  );
}

function CapsaleraDies() {
  return (
    <div className="grid grid-cols-7 border-b border-line bg-cream/60">
      {DIES_SETMANA.map((dia) => (
        <span
          key={dia}
          className="px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted"
        >
          {dia}
        </span>
      ))}
    </div>
  );
}

/** El calendari d'activitats, per mes o per setmana, pintat per zones. */
/**
 * Els representants comercials que es poden triar: primer tots, després cada
 * agent de l'ERP pel seu nom. Són els agents de F_AGE (la còpia a
 * `crm_agents`), no els usuaris del portal: l'agenda es prepara per qui porta
 * la cartera a l'ERP, i és l'agent que l'activitat hereta del client o del lead.
 */
async function opcionsDAgent(): Promise<OpcioAgenda[]> {
  let agents: { id: string; nom: string }[] = [];
  try {
    agents = await agentsDelPortal();
  } catch {
    // Sense la llista, el calendari surt igualment amb tots els agents.
  }
  return [{ valor: "", etiqueta: "Tots els agents" }, ...agents.map((agent) => ({ valor: agent.id, etiqueta: agent.nom }))];
}

/**
 * De quin agent és el calendari: `c` és el seu id, tal com va a l'adreça. Un
 * valor que no és cap agent (els enllaços d'abans portaven «tots» o l'id d'un
 * usuari) compta com a tots: val més el calendari sencer que un de buit.
 */
export function agentDelPlanner(c: string, opcions: OpcioAgenda[]): string | null {
  return c && opcions.some((opcio) => opcio.valor === c) ? c : null;
}

/**
 * El calendari de ruta. Qui només veu els clients del seu agent hi té les
 * activitats d'aquells clients; qui ho veu tot (administrador, manager) hi té
 * les de tothom i, amb el desplegable, tria el **representant comercial**:
 * l'agent de l'ERP de qui es prepara la ruta. `c` és la tria tal com va a
 * l'adreça.
 */
export async function Planner({
  mes,
  dia,
  setmanal,
  totes = false,
  c = "",
}: {
  mes?: string;
  dia?: string;
  setmanal: boolean;
  /** Si veu els clients de tothom: només llavors es tria l'agent. */
  totes?: boolean;
  c?: string;
}) {
  // No es filtra per qui les porta: l'abast de la sessió ja limita el calendari
  // als clients del seu agent (vegeu `domini/abast.ts`), les faci qui les faci.
  const comercial: string | null = null;
  // Qui només veu els clients del seu agent no tria agent: el calendari ja és el seu, i «c» a l'adreça no compta.
  const opcions = totes ? await opcionsDAgent() : [];
  const agent = totes ? agentDelPlanner(c, opcions) : null;
  const tria = agent ?? "";
  // Tots els enllaços del calendari arrosseguen la tria, per no perdre-la en moure's.
  const amb = agent ? `&c=${encodeURIComponent(agent)}` : "";

  try {
    if (setmanal) {
      const { setmana, segments } = await setmanaDelPlanner(dia, comercial, agent);
      const on = `pv=setmana&s=${setmana.actual}${amb}`;

      return (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <Capcalera
            titol={setmana.etiqueta}
            total={setmana.total}
            perTancar={setmana.perTancar}
            setmanal
            anterior={`/crm?v=planner&pv=setmana&s=${setmana.anterior}${amb}`}
            seguent={`/crm?v=planner&pv=setmana&s=${setmana.seguent}${amb}`}
            avui={`/crm?v=planner&pv=setmana${amb}`}
            aMes={`/crm?v=planner&m=${setmana.actual.slice(0, 7)}${amb}`}
            aSetmana={`/crm?v=planner&pv=setmana&s=${setmana.actual}${amb}`}
            agenda={totes ? <TriaComercial valor={tria} opcions={opcions} base={`/crm?v=planner&pv=setmana&s=${setmana.actual}`} /> : null}
          />

          <div className="hidden overflow-hidden rounded-xl border border-line bg-white shadow-sm md:block">
            <div className="grid grid-cols-7">
              {setmana.dies.map((diaSetmana) => (
                <ColumnaSetmana key={diaSetmana.clau} dia={diaSetmana} on={on} />
              ))}
            </div>
          </div>

          <div className="md:hidden">
            <Agenda dies={setmana.dies} on={on} buit="Aquesta setmana no hi ha res registrat." />
          </div>

          <Llegenda segments={segments} />
        </div>
      );
    }

    const { mes: calendari, segments } = await calendariDelPlanner(mes, comercial, agent);
    const on = `m=${calendari.actual}${amb}`;
    // En passar a setmana, la del dia 1 del mes que s'està mirant.
    const primerDilluns = dillunsDe(`${calendari.actual}-01`);

    return (
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <Capcalera
          titol={calendari.etiqueta}
          total={calendari.total}
          perTancar={calendari.perTancar}
          setmanal={false}
          anterior={`/crm?v=planner&m=${calendari.anterior}${amb}`}
          seguent={`/crm?v=planner&m=${calendari.seguent}${amb}`}
          avui={`/crm?v=planner${amb}`}
          aMes={`/crm?v=planner&m=${calendari.actual}${amb}`}
          aSetmana={`/crm?v=planner&pv=setmana&s=${primerDilluns}${amb}`}
          agenda={totes ? <TriaComercial valor={tria} opcions={opcions} base={`/crm?v=planner&m=${calendari.actual}`} /> : null}
        />

        {/* Graella del mes: a partir de tauleta, on set columnes es poden llegir. */}
        <div className="hidden overflow-hidden rounded-xl border border-line bg-white shadow-sm md:block">
          <CapsaleraDies />
          <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
            {calendari.setmanes.flat().map((diaMes) => (
              <CasellaMes key={diaMes.clau} dia={diaMes} on={on} amb={amb} />
            ))}
          </div>
        </div>

        <div className="md:hidden">
          <Agenda
            dies={calendari.setmanes.flat()}
            on={on}
            buit="Canvia de mes o registra la primera amb el botó de cada dia."
          />
        </div>

        <Llegenda segments={segments} />
      </div>
    );
  } catch (error) {
    return (
      <div className="p-5">
        <EstatBuit titol="No s'ha pogut llegir el CRM" text={(error as Error).message} />
      </div>
    );
  }
}
