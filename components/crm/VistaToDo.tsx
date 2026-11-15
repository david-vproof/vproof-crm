import Link from "next/link";

import { CasellaToDo } from "@/components/crm/CasellaToDo";
import { EstatActivitat } from "@/components/crm/EstatActivitat";
import { Lletres } from "@/components/crm/Lletres";
import { MarquesClient } from "@/components/crm/MarquesClient";
import { MiniFacturacio } from "@/components/crm/MiniFacturacio";
import { TriaComercial, type OpcioAgenda } from "@/components/crm/TriaComercial";
import { ICONES } from "@/components/Icones";
import { EstatBuit } from "@/components/UI";
import {
  agrupaPerCompte,
  agrupaPerVenciment,
  diaCurt,
  etiquetaVenciment,
  llegeixAgrupament,
  resumToDos,
  terminiDe,
  type Agrupament,
  type GrupToDo,
  type Termini,
  type ToDo,
} from "@/domini/crm-todo";
import { marquesDe } from "@/domini/marques-client";
import { rutaDelClient } from "@/lib/navegacio";
import { toDosPerFer, type PantallaToDo } from "@/serveis/crm-deures";
import { clientsMarcats, type ClientsMarcats } from "@/serveis/marques-client";
import { comercialsDelPortal } from "@/serveis/usuaris";

/** El to de cada termini: el que ja ha vençut crida, el d'avui avisa, la resta espera. */
const TO_TERMINI: Record<Termini, string> = {
  vencut: "bg-marca-clar text-marca-fosc",
  avui: "bg-amber-50 text-amber-800",
  setmana: "bg-sky-50 text-sky-800",
  mes_endavant: "bg-parchment text-muted",
  sense: "bg-parchment text-muted",
};

function Marca({ children, to, titol }: { children: React.ReactNode; to: string; titol?: string }) {
  return (
    <span title={titol} className={`inline-flex shrink-0 items-center rounded px-1.5 py-px text-[11px] font-medium ${to}`}>
      {children}
    </span>
  );
}

/** On s'obre un compte: el client, a la seva fitxa; el lead, al panell de la llista de leads. */
function enllacCompte(compte: NonNullable<ToDo["compte"]>) {
  return compte.mena === "client" ? rutaDelClient(compte.id) : `/crm?${new URLSearchParams({ v: "leads", r: compte.id })}`;
}

/** Les marques del client sense la «!»: aquí ja som a la llista de To-Do, i tornar-los a obrir en un modal no diu res de nou. */
function nomesAtributs(compte: NonNullable<ToDo["compte"]>, marcats: ClientsMarcats) {
  if (compte.mena !== "client") return null;
  const marques = marquesDe(compte.id, marcats);
  return marques?.atributs ? { ...marques, deures: false } : null;
}

/**
 * De qui és el To-Do: el client amb el que es veu a la resta de llistes (les
 * lletres, la facturació, els atributs), la població i el telèfon per
 * trucar-hi des d'aquí. El telèfon va fora de l'enllaç: al mòbil marcar el
 * número no ha d'obrir la fitxa.
 */
function Compte({ compte, marcats, gran = false }: { compte: ToDo["compte"]; marcats: ClientsMarcats; gran?: boolean }) {
  const Telefon = ICONES.telefon;

  if (!compte) {
    return <span className="text-[12.5px] italic text-muted">Sense client</span>;
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <Link
        href={enllacCompte(compte)}
        className={`min-w-0 truncate font-medium text-ink transition hover:text-marca ${gran ? "text-[15px]" : "text-[13px]"}`}
      >
        {compte.nom}
      </Link>
      {compte.mena === "lead" ? (
        <Marca to="bg-parchment text-muted">Lead</Marca>
      ) : (
        <Lletres categoria={compte.categoria} potencial={compte.potencial} />
      )}
      {compte.facturacio?.facturacio_tendencia ? (
        <span className="shrink-0 text-[12px]">
          <MiniFacturacio dades={compte.facturacio} />
        </span>
      ) : null}
      <MarquesClient marques={nomesAtributs(compte, marcats)} nom={compte.nom} />
      {compte.poblacio ? <span className="text-[12.5px] text-muted">· {compte.poblacio}</span> : null}
      {compte.telefon ? (
        <a
          href={`tel:${compte.telefon.replace(/\s+/g, "")}`}
          title={`Truca al ${compte.telefon}`}
          className="inline-flex items-center gap-1 text-[12.5px] tabular-nums text-muted transition hover:text-ink"
        >
          <Telefon className="size-3.5" />
          {compte.telefon}
        </a>
      ) : null}
    </span>
  );
}

/**
 * D'on surt el To-Do: l'activitat que el va deixar, amb com va anar, i a quina
 * oportunitat va lligat. L'activitat s'obre a sobre d'aquesta mateixa pantalla.
 */
function Origen({
  todo,
  avui,
  enllacActivitat,
  ambResponsable,
}: {
  todo: ToDo;
  avui: string;
  enllacActivitat: (id: string) => string;
  /** Si es veuen els de tothom, cal dir de qui és cadascun. */
  ambResponsable: boolean;
}) {
  const { activitat, oportunitat } = todo;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
      {activitat ? (
        <Link
          href={enllacActivitat(activitat.id)}
          scroll={false}
          title="Obre l'activitat que va deixar aquest To-Do"
          className="inline-flex min-w-0 items-center gap-1.5 transition hover:text-ink"
        >
          <span aria-hidden className="text-muted/60">↳</span>
          <span className="min-w-0 truncate">
            <span className="text-ink-soft">{activitat.tipus}</span> · {activitat.assumpte}
            {activitat.dia ? ` · ${diaCurt(activitat.dia, avui)}` : ""}
          </span>
          <EstatActivitat tancada={activitat.tancada} resultat={activitat.resultat} />
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-muted/60">↳</span>
          Apuntat a mà{todo.creatEl ? ` el ${diaCurt(todo.creatEl, avui)}` : ""}, sense cap activitat al darrere
        </span>
      )}
      {oportunitat ? (
        <Link
          href={`/crm?${new URLSearchParams({ v: "oportunitats", r: oportunitat.id })}`}
          className="min-w-0 truncate transition hover:text-ink"
        >
          · Oportunitat: <span className="text-ink-soft">{oportunitat.titol}</span>
          {oportunitat.etapa ? ` (${oportunitat.etapa})` : ""}
        </Link>
      ) : null}
      {ambResponsable ? (
        <span>· {todo.responsable ? todo.responsable.nom : "Sense responsable"}</span>
      ) : null}
    </p>
  );
}

function Fila({
  todo,
  avui,
  ambCompte,
  marcats,
  enllacActivitat,
  ambResponsable,
}: {
  todo: ToDo;
  avui: string;
  /** Si cal dir de qui és: agrupats per client, ja ho diu la capçalera del grup. */
  ambCompte: boolean;
  marcats: ClientsMarcats;
  enllacActivitat: (id: string) => string;
  ambResponsable: boolean;
}) {
  const termini = terminiDe(todo.venciment, avui);

  const etiquetes = (
    <>
      {todo.prioritat === "alta" ? (
        <Marca to="bg-marca-clar text-marca-fosc" titol="Prioritat alta">Alta</Marca>
      ) : todo.prioritat === "baixa" ? (
        <Marca to="bg-parchment text-muted" titol="Prioritat baixa">Baixa</Marca>
      ) : null}
      {todo.fet ? (
        <Marca to="bg-parchment text-muted">
          {todo.estat === "cancellada" ? "Cancel·lat" : `Fet${todo.completadaEl ? ` el ${diaCurt(todo.completadaEl, avui)}` : ""}`}
        </Marca>
      ) : todo.venciment ? (
        <Marca to={TO_TERMINI[termini]} titol={`Venciment: ${diaCurt(todo.venciment)}`}>
          {etiquetaVenciment(todo.venciment, avui)}
        </Marca>
      ) : null}
    </>
  );

  return (
    <CasellaToDo id={todo.id} text={todo.text} fetInicial={todo.fet} etiquetes={etiquetes}>
      {ambCompte ? (
        <div className="mt-1">
          <Compte compte={todo.compte} marcats={marcats} />
        </div>
      ) : null}
      <Origen todo={todo} avui={avui} enllacActivitat={enllacActivitat} ambResponsable={ambResponsable} />
      {todo.descripcio ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-[12.5px] text-muted">{todo.descripcio}</p>
      ) : null}
    </CasellaToDo>
  );
}

function Grup({
  grup,
  avui,
  agrupament,
  marcats,
  enllacActivitat,
  ambResponsable,
}: {
  grup: GrupToDo;
  avui: string;
  agrupament: Agrupament;
  marcats: ClientsMarcats;
  enllacActivitat: (id: string) => string;
  ambResponsable: boolean;
}) {
  const perCompte = agrupament === "compte";

  return (
    <section id={grup.clau} className="scroll-mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1">
        {perCompte && grup.compte ? (
          <h3 className="min-w-0">
            <Compte compte={grup.compte} marcats={marcats} gran />
          </h3>
        ) : (
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{grup.titol}</h3>
        )}
        <span className="rounded bg-parchment px-1.5 py-px text-[11px] tabular-nums text-muted">{grup.todos.length}</span>
        {grup.nota ? <span className="text-[12px] text-muted/80">{grup.nota}</span> : null}
      </div>
      <ul className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-white">
        {grup.todos.map((todo) => (
          <Fila
            key={todo.id}
            todo={todo}
            avui={avui}
            ambCompte={!perCompte}
            marcats={marcats}
            enllacActivitat={enllacActivitat}
            ambResponsable={ambResponsable}
          />
        ))}
      </ul>
    </section>
  );
}

/** Els To-Do de qui es poden mirar, per a qui els veu tots: primer els de tothom, després els propis i els de cadascú. */
async function opcionsDeResponsable(propi: string | null): Promise<OpcioAgenda[]> {
  let equip: { id: string; nom: string }[] = [];
  try {
    equip = await comercialsDelPortal();
  } catch {
    // Sense l'equip, encara es pot triar entre els de tothom i els propis.
  }
  return [
    { valor: "", etiqueta: "Tot l'equip" },
    ...(propi ? [{ valor: propi, etiqueta: "Els meus" }] : []),
    ...equip.filter((persona) => persona.id !== propi).map((persona) => ({ valor: persona.id, etiqueta: persona.nom })),
  ];
}

/** Un tros del resum de la capçalera, que porta al seu grup si la pantalla va per venciment. */
function Tros({ text, ancora, to = "" }: { text: string; ancora: string | null; to?: string }) {
  if (!ancora) return <span className={to}>{text}</span>;
  return (
    <a href={`#${ancora}`} className={`underline decoration-line underline-offset-2 transition hover:text-ink ${to}`}>
      {text}
    </a>
  );
}

function Capcalera({
  pantalla,
  agrupament,
  fets,
  deTothom,
  opcions,
  tria,
  enllac,
}: {
  pantalla: PantallaToDo;
  agrupament: Agrupament;
  fets: boolean;
  /** Si es veuen els de tot l'equip. */
  deTothom: boolean;
  opcions: OpcioAgenda[] | null;
  /** El que surt triat al desplegable. */
  tria: string;
  enllac: (canvis: Record<string, string>) => string;
}) {
  const resum = resumToDos(pantalla.pendents, pantalla.avui);
  const ancora = (clau: Termini) => (agrupament === "venciment" ? clau : null);
  const boto = (actiu: boolean) =>
    `rounded-md px-2.5 py-1 transition ${actiu ? "bg-ink text-cream" : "text-muted hover:text-ink"}`;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[24px] leading-none tracking-[-0.01em]">
          {resum.pendents === 0 ? "Tot al dia" : `${resum.pendents} To-Do per fer`}
        </h2>
        <p className="mt-1.5 flex flex-wrap gap-x-1.5 text-[13px] text-muted">
          {resum.vencuts > 0 ? <Tros text={`${resum.vencuts} ${resum.vencuts === 1 ? "vençut" : "vençuts"}`} ancora={ancora("vencut")} to="font-medium text-marca-fosc" /> : null}
          {resum.avui > 0 ? <Tros text={`${resum.vencuts > 0 ? "· " : ""}${resum.avui} avui`} ancora={ancora("avui")} to="font-medium text-amber-800" /> : null}
          {resum.setmana > 0 ? <Tros text={`${resum.vencuts + resum.avui > 0 ? "· " : ""}${resum.setmana} aquesta setmana`} ancora={ancora("setmana")} /> : null}
          {resum.sense > 0 ? <Tros text={`${resum.pendents - resum.sense > 0 ? "· " : ""}${resum.sense} sense venciment`} ancora={ancora("sense")} /> : null}
          {resum.alta > 0 ? <span>· {resum.alta} de prioritat alta</span> : null}
          {resum.comptes > 0 ? <span>· {resum.comptes === 1 ? "d'un client" : `de ${resum.comptes} clients`}</span> : null}
          {/* Amb credencials locals o mirant tot l'equip no són d'un sol: val més dir-ho. */}
          {deTothom ? <span>· de tot l&apos;equip</span> : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {opcions ? <TriaComercial etiqueta="To-Do de" valor={tria} opcions={opcions} base={enllac({ c: "" })} /> : null}
        <nav aria-label="Agrupa els To-Do" className="flex rounded-lg border border-line bg-white p-0.5 text-[12.5px]">
          <Link href={enllac({ g: "" })} aria-current={agrupament === "venciment" ? "page" : undefined} className={boto(agrupament === "venciment")}>
            Per venciment
          </Link>
          <Link href={enllac({ g: "compte" })} aria-current={agrupament === "compte" ? "page" : undefined} className={boto(agrupament === "compte")}>
            Per client
          </Link>
        </nav>
        <Link
          href={enllac({ fets: fets ? "" : "1" })}
          className={`rounded-lg border px-3 py-1.5 text-[13px] transition ${
            fets ? "border-ink bg-ink text-cream hover:bg-ink-soft" : "border-line bg-white text-muted hover:border-ink hover:text-ink"
          }`}
        >
          {fets ? "Amaga els fets" : "Mostra els fets"}
        </Link>
      </div>
    </header>
  );
}

/** El valor antic de `c` per a «els de tothom»: els enllaços desats encara el poden portar. */
const DE_TOTHOM = "tots";

/**
 * De qui són els To-Do que es miren. Qui només veu els clients del seu agent
 * té els d'aquells clients, els hagi apuntat qui els hagi apuntat: l'abast de
 * la sessió ja els limita, i el paràmetre `c` no hi pinta res. Qui ho veu tot
 * té per defecte els de tothom, i amb `c` l'id d'un usuari del portal, els
 * d'aquell, per `responsable` (l'usuari que va tancar l'activitat).
 */
export function responsableDelsToDo(c: string, propi: string | null, totes: boolean): string | null {
  if (!totes) return null;
  return c === "" || c === DE_TOTHOM ? null : c;
}

/**
 * La pantalla de To-Do: tot el que queda per fer, de tots els clients, amb
 * d'on surt (l'activitat), de qui és (el client, amb el que es veu a les
 * llistes) i quan toca. Per venciment, que és com es prioritza, o per client,
 * que és com es despatxa a la carretera. Qui només veu les seves activitats hi
 * té els seus To-Do i els que no té ningú; qui ho veu tot pot triar de qui.
 */
export async function VistaToDo({
  propi = null,
  totes = false,
  c = "",
  g = "",
  fets = false,
}: {
  /** L'id de qui té la sessió oberta, si en té. */
  propi?: string | null;
  /** Si veu les activitats de tothom: només llavors es pot triar de qui són els To-Do. */
  totes?: boolean;
  /** De qui, tal com va a l'adreça. */
  c?: string;
  /** Com s'agrupen, tal com va a l'adreça. */
  g?: string;
  /** Si també s'ensenyen els darrers fets. */
  fets?: boolean;
}) {
  const responsable = responsableDelsToDo(c, propi, totes);
  const agrupament = llegeixAgrupament(g);
  const tria = c === DE_TOTHOM ? "" : c;

  // L'adreça d'aquesta vista tal com és, amb els canvis que es demanin: els
  // enllaços de la capçalera en canvien una cosa i conserven la resta.
  const enllac = (canvis: Record<string, string> = {}) => {
    const params: Record<string, string> = {
      v: "deures",
      ...(totes && tria ? { c: tria } : {}),
      ...(agrupament === "compte" ? { g: "compte" } : {}),
      ...(fets ? { fets: "1" } : {}),
      ...canvis,
    };
    return `/crm?${new URLSearchParams(Object.entries(params).filter(([, valor]) => valor !== ""))}`;
  };
  const enllacActivitat = (id: string) => enllac({ r: id });

  let pantalla: PantallaToDo;
  let marcats: ClientsMarcats;
  let opcions: OpcioAgenda[] | null;
  try {
    [pantalla, marcats, opcions] = await Promise.all([
      toDosPerFer(responsable, { ambFets: fets }),
      clientsMarcats(),
      totes ? opcionsDeResponsable(propi) : Promise.resolve(null),
    ]);
  } catch (error) {
    return (
      <div className="p-5">
        <EstatBuit titol="No s'ha pogut llegir el CRM" text={(error as Error).message} />
      </div>
    );
  }

  const { avui, pendents } = pantalla;
  const deTothom = responsable === null;
  const grups = agrupament === "compte" ? agrupaPerCompte(pendents, avui) : agrupaPerVenciment(pendents, avui);

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5">
      <Capcalera
        pantalla={pantalla}
        agrupament={agrupament}
        fets={fets}
        deTothom={deTothom}
        opcions={opcions}
        tria={tria}
        enllac={enllac}
      />

      {pendents.length === 0 ? (
        <EstatBuit
          titol="Tot al dia"
          text={
            deTothom
              ? "No queda cap To-Do pendent a tot l'equip. Surten en tancar una activitat o s'apunten a la fitxa del client."
              : "No queda cap To-Do pendent. Surten en tancar una activitat o s'apunten a la fitxa del client."
          }
        />
      ) : (
        grups.map((grup) => (
          <Grup
            key={grup.clau}
            grup={grup}
            avui={avui}
            agrupament={agrupament}
            marcats={marcats}
            enllacActivitat={enllacActivitat}
            ambResponsable={deTothom}
          />
        ))
      )}

      {fets ? (
        <section id="fets" className="scroll-mt-4 space-y-2 border-t border-line pt-5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Fets darrerament</h3>
            <span className="rounded bg-parchment px-1.5 py-px text-[11px] tabular-nums text-muted">{pantalla.fets.length}</span>
            <span className="text-[12px] text-muted/80">Els darrers tancats, el més recent primer. Desmarcar-ne un el torna a la llista.</span>
          </div>
          {pantalla.fets.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-muted">Encara no se n&apos;ha tancat cap.</p>
          ) : (
            <ul className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-white">
              {pantalla.fets.map((todo) => (
                <Fila
                  key={todo.id}
                  todo={todo}
                  avui={avui}
                  ambCompte
                  marcats={marcats}
                  enllacActivitat={enllacActivitat}
                  ambResponsable={deTothom}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
