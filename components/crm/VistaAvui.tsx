import Link from "next/link";

import { EstatActivitat, descriuEstat } from "@/components/crm/EstatActivitat";
import { ICONES } from "@/components/Icones";
import { MiniFacturacio, fonsDeTendencia } from "@/components/crm/MiniFacturacio";
import { Lletres } from "@/components/crm/Lletres";
import { EstatBuit } from "@/components/UI";
import { properaHora, type ActeAgenda, type Agenda, type TascaAgenda } from "@/domini/crm-avui";
import { agendaDavui } from "@/serveis/crm-avui";
import { MarquesClient } from "@/components/crm/MarquesClient";

/** Els paràmetres que situen l'agenda, per no perdre-la en obrir una fitxa. */
const enllacFitxa = (id: string) => `/crm?v=avui&r=${id}`;
const enllacNova = (dia: string, hora: string) => `/crm?v=avui&r=nou&pre=data:${dia}T${hora}`;

/**
 * L'avís que toca segons l'horari comercial del compte. Un compte sense horari
 * informat no diu res: callar no és el mateix que dir que està obert.
 */
const AVIS: Record<string, { text: string; to: string } | null> = {
  obert: null,
  sense_horari: null,
  tancat: { text: "fora d'horari", to: "bg-amber-50 text-amber-800" },
  bloquejat: { text: "dia bloquejat", to: "bg-marca-clar text-marca-fosc" },
};

/** Un to per prioritat de tasca: el mateix semàfor que a la base de dades. */
const TO_PRIORITAT: Record<string, string> = {
  alta: "bg-marca",
  normal: "bg-sky-500",
  baixa: "bg-muted/50",
};

function Marca({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <span className={`shrink-0 rounded px-1.5 py-px text-[11px] font-medium ${to}`}>{children}</span>
  );
}

/**
 * Una visita del dia. La targeta no és tota un enllaç: el telèfon també ho és,
 * i un enllaç dins d'un altre no es pot fer. Així, a més, al mòbil marcar el
 * número no obre la fitxa sense voler.
 */
function Acte({ acte }: { acte: ActeAgenda }) {
  const avis = AVIS[acte.quan];
  const Telefon = ICONES.telefon;

  return (
    <li className="flex gap-2.5 sm:gap-3">
      {/* L'hora, fora de la targeta: llegint només aquesta columna ja se sap el dia. */}
      <div className="w-[52px] shrink-0 pt-2.5 text-right sm:w-[58px]">
        <p className={`text-[14px] font-semibold tabular-nums ${acte.passada ? "text-muted" : "text-ink"}`}>
          {acte.hora}
        </p>
        {acte.fi ? <p className="text-[11px] tabular-nums text-muted/70">{acte.fi}</p> : null}
      </div>

      <div
        style={{ borderLeftColor: acte.color }}
        // El fons, del color de la tendència de facturació del client, com a la resta de llistats.
        className={`flex min-w-0 flex-1 items-start gap-3 rounded-r-xl rounded-l-md border border-l-[3px] border-line p-3 transition ${
          fonsDeTendencia(acte.facturacio ?? undefined) || "bg-white"
        } ${acte.passada ? "opacity-70" : ""}`}
      >
        <div className="min-w-0 flex-1">
          {/* Les marques del client (To-Do, atributs) van fora de l'enllaç, com el telèfon: no han d'obrir la visita. */}
          <div className="flex items-start gap-2">
            <Link
              href={enllacFitxa(acte.id)}
              title={descriuEstat(acte.tancada, acte.resultat, acte.passada)}
              className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
            >
              <span className="truncate text-[15px] font-medium text-ink group-hover:text-marca">
                {acte.compte || acte.assumpte}
              </span>
              {/* Les lletres del compte (categoria i potencial), com a la resta de llistes de clients. */}
              {acte.esLead ? (
                <Marca to="bg-parchment text-muted">Lead</Marca>
              ) : (
                <Lletres categoria={acte.categoria} potencial={acte.potencial} />
              )}
              {/* La facturació va amb el nom del client, com a la resta de llistes de clients. */}
              {acte.facturacio?.facturacio_tendencia ? (
                <span className="shrink-0 text-[12px]">
                  <MiniFacturacio dades={acte.facturacio} />
                </span>
              ) : null}
              <EstatActivitat tancada={acte.tancada} resultat={acte.resultat} passada={acte.passada} gran />
              {avis ? <Marca to={avis.to}>{avis.text}</Marca> : null}
            </Link>
            <MarquesClient marques={acte.marques} nom={acte.compte} />
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
            <span className="text-ink-soft">{acte.tipus}</span>
            {acte.ambProductes ? <span title="Cal endur-se mostres">· amb producte</span> : null}
            <span className="flex items-center gap-1.5">
              ·
              <span className="size-1.5 rounded-full" style={{ backgroundColor: acte.color }} />
              {acte.segment}
            </span>
            {acte.poblacio ? <span>· {acte.poblacio}</span> : null}
            {acte.contacte ? <span>· {acte.contacte}</span> : null}
          </p>

          <p className="mt-1 truncate text-[13px] text-ink-soft">{acte.assumpte}</p>

          {/* El desenllaç ja el diu l'etiqueta de dalt: aquí, què s'hi va a buscar. */}
          {acte.properPas ? (
            <p className="mt-1 text-[12.5px] text-muted">Proper pas: {acte.properPas}</p>
          ) : null}
        </div>

        {acte.telefon ? (
          <a
            href={`tel:${acte.telefon.replace(/\s+/g, "")}`}
            title={`Truca al ${acte.telefon}`}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-[12.5px] tabular-nums text-muted transition hover:border-ink hover:text-ink"
          >
            <Telefon className="size-4" />
            <span className="hidden sm:inline">{acte.telefon}</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}

/** La ratlla de l'ara: separa el que ja ha passat del que queda per fer. */
function Ara({ hora }: { hora: string }) {
  return (
    <li className="flex items-center gap-2.5 sm:gap-3" aria-hidden>
      <span className="w-[52px] shrink-0 text-right text-[12px] font-semibold tabular-nums text-marca sm:w-[58px]">
        {hora}
      </span>
      <span className="flex flex-1 items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-marca" />
        <span className="h-px flex-1 bg-marca/35" />
      </span>
    </li>
  );
}

function Tasques({ tasques }: { tasques: TascaAgenda[] }) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Tasques d&apos;avui</h2>
        {/* Aquí només les que vencen avui; la pantalla de To-Do té tot el que queda, amb d'on surt. */}
        <Link href="/crm?v=deures" className="text-[12.5px] text-muted transition hover:text-ink">
          Tots els To-Do →
        </Link>
      </div>

      {tasques.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted/70">Cap tasca amb venciment avui.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {tasques.map((tasca) => (
            <li key={tasca.id} className="flex items-start gap-2.5">
              <span
                title={`Prioritat ${tasca.prioritat}`}
                className={`mt-[7px] size-1.5 shrink-0 rounded-full ${TO_PRIORITAT[tasca.prioritat] ?? TO_PRIORITAT.normal}`}
              />
              <span className="min-w-0">
                {/* Les tasques encara no s'editen des del portal: aquí només s'hi recorden. */}
                <span
                  className={`block text-[13.5px] leading-snug ${
                    tasca.pendent ? "text-ink" : "text-muted line-through"
                  }`}
                >
                  {tasca.titol}
                </span>
                {tasca.compte ? <span className="block text-[12px] text-muted">{tasca.compte}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Capcalera({ agenda }: { agenda: Agenda }) {
  const { actes, passades, pendents, perTancar, tasques } = agenda;
  const queden = actes.length - passades;

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-[24px] leading-none tracking-[-0.01em]">{agenda.etiqueta}</h2>
        <p className="mt-1.5 text-[13px] text-muted">
          {actes.length} {actes.length === 1 ? "activitat" : "activitats"}
          {actes.length > 0 && queden > 0 ? ` · ${queden} per fer` : ""}
          {/* Les que ja han passat i ningú no ha tancat: és el deute del dia. */}
          {perTancar > 0 ? ` · ${perTancar} per tancar` : ""}
          {tasques.length > 0 ? ` · ${pendents} ${pendents === 1 ? "tasca pendent" : "tasques pendents"}` : ""}
          {/* Amb credencials locals no hi ha ningú a qui lligar l'agenda: val més dir-ho que fer veure que és teva. */}
          {agenda.meves ? "" : " · de tot l'equip"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/crm?v=planner"
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] text-muted transition hover:border-ink hover:text-ink"
        >
          Veure l&apos;Agenda
        </Link>
        <Link href={enllacNova(agenda.dia, properaHora(agenda.ara))} className="btn-compacte">
          + Nova activitat
        </Link>
      </div>
    </header>
  );
}

/**
 * L'agenda d'avui: què toca fer, per hores, i les tasques que vencen.
 *
 * És la mirada curta del Planner —allà es prepara la ruta d'un mes; aquí només
 * hi ha el dia d'avui— i, a diferència d'aquell, només ensenya el que porta qui
 * té la sessió oberta: és una agenda personal, no el calendari de la casa.
 */
export async function VistaAvui({ comercial }: { comercial: string | null }) {
  let agenda: Agenda;
  try {
    agenda = await agendaDavui(comercial);
  } catch (error) {
    return (
      <div className="p-5">
        <EstatBuit titol="No s'ha pogut llegir el CRM" text={(error as Error).message} />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <Capcalera agenda={agenda} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_296px]">
        {agenda.actes.length === 0 ? (
          <EstatBuit
            titol="Avui no hi ha res a l'agenda"
            text={
              agenda.meves
                ? "Cap activitat amb data d'avui a nom teu. A l'Agenda hi ha el calendari sencer."
                : "Cap activitat amb data d'avui. A l'Agenda hi ha el calendari sencer."
            }
          />
        ) : (
          <ul className="space-y-2">
            {agenda.actes.slice(0, agenda.passades).map((acte) => (
              <Acte key={acte.id} acte={acte} />
            ))}
            <Ara hora={agenda.ara} />
            {agenda.actes.slice(agenda.passades).map((acte) => (
              <Acte key={acte.id} acte={acte} />
            ))}
          </ul>
        )}

        <Tasques tasques={agenda.tasques} />
      </div>
    </div>
  );
}
