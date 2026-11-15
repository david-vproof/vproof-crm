"use client";

import { useState } from "react";

import { ConstructorCriteris } from "@/components/crm/ConstructorCriteris";
import { BotonsContacte, type MenaContacte } from "@/components/crm/Contacte";
import { useEdicio } from "@/components/crm/EdicioFitxa";
import { CampDataHora } from "@/components/crm/CampDataHora";
import { CampFoto } from "@/components/crm/CampFoto";
import { MatriuHoraris } from "@/components/crm/MatriuHoraris";
import { SelectorCeller } from "@/components/crm/SelectorCeller";
import { SelectorClients } from "@/components/crm/SelectorClients";
import { SelectorVins } from "@/components/crm/SelectorVins";
import { TriaRelacio } from "@/components/crm/TriaRelacio";
import type { ClientOLead } from "@/domini/cistella-vins";
import { campVisible, esMultiple, filtreDeRelacio, idDeRelacio, veDeFactusol, type Camp, type Fitxa } from "@/domini/crm-fitxes";
import { SelectorUbicacio } from "@/components/crm/SelectorUbicacio";
import { momentLocal } from "@/domini/crm-planner";

type Opcions = Record<string, { id: string; text: string; detall?: string; foto?: string | null }[]>;

/**
 * Els camps que en governen d'altres: cal seguir-los per amagar i ensenyar
 * (`nomesSi`) i per escurçar el que ofereix un desplegable (`filtradaPer`).
 */
function campsGovernants(fitxa: Fitxa) {
  return [
    ...new Set([
      ...(fitxa.camps.map((c) => c.nomesSi?.camp).filter(Boolean) as string[]),
      ...(fitxa.camps.map((c) => c.multiple?.camp).filter(Boolean) as string[]),
      ...fitxa.camps.flatMap((c) => c.filtradaPer ?? []),
    ]),
  ];
}

/** «Cal triar abans «Compte» o «Lead»», amb les etiquetes dels camps que manen. */
function calTriarAbans(fitxa: Fitxa, camp: Camp) {
  const etiquetes = (camp.filtradaPer ?? [])
    .map((nom) => fitxa.camps.find((c) => c.nom === nom)?.etiqueta)
    .filter(Boolean)
    .map((etiqueta) => `«${etiqueta}»`);
  return etiquetes.length === 0 ? "Tria abans de qui és." : `Cal triar abans ${etiquetes.join(" o ")}.`;
}

function valorInicial(camp: Camp, valors: Record<string, unknown>) {
  const brut = valors[camp.nom];
  if (brut === null || brut === undefined) return "";
  if (camp.tipus === "datahora") {
    // Directus desa l'instant en UTC; el formulari treballa en hora d'aquí, com l'agenda.
    const moment = momentLocal(String(brut));
    return moment ? `${moment.dia}T${moment.hora}` : "";
  }
  if (camp.tipus === "data") return String(brut).slice(0, 10);
  return String(brut);
}

/** Els camps que ocupen tota l'amplada quan el formulari va a dues columnes. */
function esAmple(camp: Camp) {
  return camp.ample === "sencer" || Boolean(camp.parella) || ["area", "horari", "criteris", "vins", "foto"].includes(camp.tipus);
}

/**
 * Els grups del formulari, si la fitxa en té: els camps de cada secció en
 * l'ordre que diu, i els que no surten a cap secció, en un grup al final.
 */
function grupsDeCamps(fitxa: Fitxa) {
  if (!fitxa.seccions) return null;
  const posats = new Set(fitxa.seccions.flatMap((seccio) => seccio.camps));
  const grups = fitxa.seccions.map((seccio) => ({
    titol: seccio.titol,
    camps: seccio.camps.map((nom) => fitxa.camps.find((camp) => camp.nom === nom)).filter((camp): camp is Camp => Boolean(camp)),
  }));
  const resta = fitxa.camps.filter((camp) => !posats.has(camp.nom));
  return resta.length > 0 ? [...grups, { titol: "Altres", camps: resta }] : grups;
}

/**
 * Un telèfon o un correu que s'edita, amb els botons de trucar, WhatsApp o
 * escriure al costat. Segueixen el que hi ha escrit, no només el que hi havia desat.
 */
function CampContacte({ comu, mena }: { comu: React.InputHTMLAttributes<HTMLInputElement>; mena: MenaContacte }) {
  const [valor, setValor] = useState(String(comu.defaultValue ?? ""));
  return (
    <div className="flex items-center gap-1.5">
      <input
        {...comu}
        type="text"
        // El teclat que toca al telèfon: el de números o el de l'arrova.
        inputMode={mena === "correu" ? "email" : "tel"}
        autoComplete="off"
        className={`${comu.className ?? ""} min-w-0 flex-1`}
        onChange={(e) => setValor(e.target.value)}
      />
      <BotonsContacte mena={mena} valor={valor} />
    </div>
  );
}

/**
 * L'embolcall d'un camp que es pot desactivar sense desmuntar-lo: `inert` no
 * deixa ni tocar-lo ni arribar-hi amb el tabulador. Els que no en tenen mai
 * cap necessitat no porten embolcall.
 */
function Desactivable({ actiu, desactivat, children }: { actiu: boolean; desactivat: boolean; children: React.ReactNode }) {
  if (!actiu) return <>{children}</>;
  return (
    <div inert={desactivat} aria-disabled={desactivat || undefined} className={desactivat ? "opacity-50" : undefined}>
      {children}
    </div>
  );
}

/**
 * Només els camps: els botons de desar, cancel·lar i esborrar són a la
 * capçalera del panell (a la fitxa d'un client, a la filera de seccions i al
 * peu), i el de desar arriba fins aquí per l'id del formulari.
 */
export function FormulariFitxa({
  fitxa,
  valors,
  opcions,
  id,
  retorn,
  fixats = [],
}: {
  fitxa: Fitxa;
  valors: Record<string, unknown>;
  opcions: Opcions;
  id: string | null;
  /** On tornar en desar. Sense això, al llistat de la seva pròpia fitxa. */
  retorn?: string;
  /**
   * Els camps que ja vénen decidits pel lloc d'on s'obre, encara que la fitxa
   * sigui nova: una activitat creada des d'un client és d'aquell client.
   */
  fixats?: string[];
}) {
  const { estat, accio, idFormulari, senseRedireccio } = useEdicio();
  // Els ids dels camps porten el del formulari: a la pàgina n'hi pot haver dos
  // (la fitxa d'un client oberta a sobre d'una activitat), i una etiqueta
  // apuntaria al camp de l'altre.
  const idCamp = (nom: string) => `${idFormulari}-${nom}`;
  // Les relacions arriben com a id, però podrien arribar desplegades: es
  // normalitzen perquè el filtre no acabi comparant contra «[object Object]».
  const [govern, setGovern] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      campsGovernants(fitxa).map((nom) => {
        const camp = fitxa.camps.find((c) => c.nom === nom);
        return [nom, camp?.tipus === "relacio" ? idDeRelacio(valors[nom]) : String(valors[nom] ?? "")];
      }),
    ),
  );

  // Una fitxa que ve de l'ERP no deixa tocar el que l'ERP tornaria a posar; si
  // la taula sencera és de l'ERP, no s'hi toca res de res.
  const deErp = fitxa.nomesLectura || veDeFactusol(fitxa, valors);
  // Els camps que van de parella (la longitud amb la latitud) els pinta el primer.
  const deParella = new Set(fitxa.camps.map((camp) => camp.parella).filter(Boolean));
  const text = (nom: string) => String(valors[nom] ?? "").trim();
  const adrecaDeLaFitxa = [text("adreca"), text("codi_postal"), text("poblacio"), text("provincia")].filter(Boolean).join(", ");
  const governa = (nom: string) => campsGovernants(fitxa).includes(nom);
  const anota = (nom: string, valor: string) => setGovern((previ) => ({ ...previ, [nom]: valor }));
  // Quins camps excloents tenen alguna cosa triada: el client i el lead d'una
  // activitat. Mentre un en té, l'altre es veu desactivat.
  const [plens, setPlens] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(fitxa.camps.filter((c) => c.excloent).map((c) => [c.nom, Boolean(valorInicial(c, valors))])),
  );
  const marcaPle = (nom: string, ple: boolean) =>
    setPlens((previ) => (previ[nom] === ple ? previ : { ...previ, [nom]: ple }));
  // El client (o clients) de l'activitat, amb el nom: el configurador de vins
  // s'obre amb ell posat, per dir de seguida què ja ha tastat o comprat.
  const [clientsTriats, setClientsTriats] = useState<{ id: string; text: string }[]>(() => {
    const camp = fitxa.camps.find((c) => c.nom === "client" && c.tipus === "relacio");
    const inicial = camp ? valorInicial(camp, valors) : "";
    if (!camp || !inicial) return [];
    return [{ id: inicial, text: (opcions[camp.nom] ?? opcions[camp.relacio!] ?? []).find((o) => o.id === inicial)?.text ?? "Client de l'activitat" }];
  });
  // O el lead, si encara no és client: el configurador també s'hi obre amb ell posat.
  const [leadTriat, setLeadTriat] = useState<ClientOLead | null>(() => {
    const camp = fitxa.camps.find((c) => c.nom === "lead" && c.tipus === "relacio");
    const inicial = camp ? valorInicial(camp, valors) : "";
    if (!camp || !inicial) return null;
    return { id: inicial, text: (opcions[camp.nom] ?? opcions[camp.relacio!] ?? []).find((o) => o.id === inicial)?.text ?? "Lead de l'activitat", lead: true };
  });
  /** El que cal saber quan canvia una relació: si governa altres camps, si és excloent i si és el lead dels vins. */
  const seguidor = (camp: Camp) =>
    governa(camp.nom) || camp.excloent
      ? (id: string, text: string) => {
          if (governa(camp.nom)) anota(camp.nom, id);
          if (camp.excloent) marcaPle(camp.nom, Boolean(id));
          if (camp.nom === "lead") setLeadTriat(id ? { id, text, lead: true } : null);
        }
      : undefined;

  /** Un camp del formulari, o res si no li toca sortir. */
  const pintaCamp = (camp: Camp) => {
    // Els camps amb amo propi els pinta qui els governa, no el formulari.
    if (camp.extern || camp.heretatDe || deParella.has(camp.nom) || !campVisible(camp, govern)) return null;
    const inicial = valorInicial(camp, valors);
    // Un camp d'abans només surt on hi ha alguna cosa, i ja no s'edita.
    if (camp.antic && !inicial) return null;
    // Amb l'altre camp excloent fixat, aquest no es podrà omplir mai: l'avís de «treu-lo» no tindria sentit.
    if (camp.excloent && fixats.includes(camp.excloent.camp)) return null;
    // De qui és, un cop desada, no es toca: es veu, però no es tria.
    const fixat = Boolean(inicial && (fixats.includes(camp.nom) || (id && camp.fixEnEditar)));
    if ((deErp && (camp.deErp || fitxa.nomesLectura)) || camp.calculat || camp.antic) {
      const text =
        camp.tipus === "tria" || camp.tipus === "periodicitat"
          ? (camp.opcions?.find(([valor]) => valor === inicial)?.[1] ?? inicial)
          : camp.tipus === "relacio"
            ? ((opcions[camp.nom] ?? opcions[camp.relacio!] ?? []).find((o) => o.id === inicial)?.text ?? inicial)
            : inicial;
      return (
        <div key={camp.nom} className={`space-y-1.5 ${esAmple(camp) ? "@xl:col-span-2" : ""}`}>
          <label htmlFor={idCamp(camp.nom)} className="block text-[12px] font-medium uppercase tracking-[0.04em] text-muted">
            {camp.etiqueta}
          </label>
          <div className="flex items-center gap-1.5">
            <div
              id={idCamp(camp.nom)}
              aria-readonly
              className="field-compacte min-h-[34px] min-w-0 flex-1 cursor-default bg-parchment/60 [overflow-wrap:anywhere] text-ink-soft"
            >
              {text || "—"}
            </div>
            {camp.contacte ? <BotonsContacte mena={camp.contacte} valor={inicial} /> : null}
          </div>
          {/* Igual als clients que als cellers: el que ve de l'ERP ho diu camp per camp. */}
          {camp.calculat || camp.antic ? (
            <p className="text-[12px] text-muted">{camp.nota}</p>
          ) : camp.deErp ? (
            <p className="text-[12px] text-muted">Ve de FactuSol: es canvia a l&apos;ERP.</p>
          ) : null}
        </div>
      );
    }
    // Buit mentre l'altre camp excloent té valor: es veu, però no es pot triar.
    const exclos = Boolean(camp.excloent && plens[camp.excloent.camp] && !plens[camp.nom]);
    const comu = {
      id: idCamp(camp.nom),
      name: camp.nom,
      defaultValue: inicial,
      className: "field-compacte",
      ...(camp.obligatori ? { required: true } : {}),
    };
    return (
      <div key={camp.nom} className={`space-y-1.5 ${esAmple(camp) ? "@xl:col-span-2" : ""}`}>
        <label htmlFor={idCamp(camp.nom)} className="block text-[12px] font-medium uppercase tracking-[0.04em] text-muted">
          {camp.etiqueta}
          {camp.obligatori ? <span className="text-wine"> *</span> : null}
        </label>

        {/* Els excloents sempre van dins d'aquest embolcall, per no desmuntar-los
            (i perdre el que tenen) quan es desactiven i es tornen a activar. */}
        <Desactivable actiu={Boolean(camp.excloent)} desactivat={exclos}>
        {camp.parella ? (
          <SelectorUbicacio
            id={idCamp(camp.nom)}
            nomLatitud={camp.nom}
            nomLongitud={camp.parella}
            latitudInicial={inicial}
            longitudInicial={String(valors[camp.parella] ?? "")}
            cercaInicial={adrecaDeLaFitxa}
          />
        ) : camp.tipus === "area" ? (
          <textarea {...comu} rows={3} />
        ) : camp.tipus === "tria" || camp.tipus === "periodicitat" ? (
          <select {...comu} onChange={(e) => (governa(camp.nom) ? anota(camp.nom, e.target.value) : undefined)}>
            <option value="">—</option>
            {/* Una opció retirada només surt a la fitxa que ja la té: si no, desar-la la perdria. */}
            {camp.opcions
              ?.filter(([valor]) => valor === inicial || !camp.opcionsRetirades?.includes(valor))
              .map(([valor, text]) => (
                <option key={valor} value={valor}>
                  {text}
                </option>
              ))}
          </select>
        ) : fixat && camp.tipus === "relacio" ? (
          <>
            <input type="hidden" name={camp.nom} value={inicial} />
            <div
              id={idCamp(camp.nom)}
              aria-readonly
              className="field-compacte flex cursor-default items-center gap-1.5 bg-parchment/60 text-ink-soft"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-muted/50" />
              <span className="truncate">
                {(opcions[camp.nom] ?? opcions[camp.relacio!] ?? []).find((o) => o.id === inicial)?.text ?? inicial}
              </span>
            </div>
          </>
        ) : camp.tipus === "relacio" && camp.relacio === "clients" ? (
          // Els clients es trien sempre amb el mateix modal, a tot el CRM.
          <SelectorClients
            nom={camp.nom}
            multiple={!id && esMultiple(camp, govern)}
            triatsInicials={
              inicial
                ? [{ id: inicial, text: (opcions[camp.nom] ?? opcions[camp.relacio] ?? []).find((o) => o.id === inicial)?.text ?? "Client triat" }]
                : []
            }
            marcador={`Tria ${camp.etiqueta.toLowerCase()}…`}
            alCanviar={governa(camp.nom) ? (triat) => anota(camp.nom, triat) : undefined}
            alCanviarQuants={camp.excloent ? (quants) => marcaPle(camp.nom, quants > 0) : undefined}
            alCanviarTriats={camp.nom === "client" ? setClientsTriats : undefined}
          />
        ) : camp.tipus === "relacio" && camp.relacio === "proveidors" ? (
          // Els cellers són centenars i vénen de l'ERP: es trien amb una
          // finestra de cerca, no amb un desplegable.
          <SelectorCeller
            nom={camp.nom}
            multiple={!id && esMultiple(camp, govern)}
            valorInicial={inicial || null}
            textInicial={(opcions[camp.nom] ?? opcions[camp.relacio] ?? []).find((o) => o.id === inicial)?.text}
            marcador={`Tria ${camp.etiqueta.toLowerCase()}…`}
          />
        ) : camp.tipus === "relacio" ? (
          <TriaRelacio
            nom={camp.nom}
            fitxa={camp.relacio!}
            // Les filtrades porten les seves opcions amb la clau del camp:
            // dos camps cap a la mateixa fitxa poden no oferir el mateix.
            opcions={opcions[camp.nom] ?? opcions[camp.relacio!] ?? []}
            valorInicial={inicial || null}
            marcador={`Cerca ${camp.etiqueta.toLowerCase()}…`}
            filtrada={Boolean(camp.filtradaPer)}
            filtre={camp.filtradaPer ? filtreDeRelacio(camp, govern) : null}
            senseFiltre={calTriarAbans(fitxa, camp)}
            alCanviar={seguidor(camp)}
          />
        ) : camp.tipus === "criteris" ? (
          <ConstructorCriteris nom={camp.nom} inicial={valors[camp.nom]} opcionsRelacio={opcions} />
        ) : camp.tipus === "horari" ? (
          <MatriuHoraris nom={camp.nom} inicial={valors[camp.nom]} />
        ) : camp.tipus === "datahora" ? (
          <CampDataHora id={idCamp(camp.nom)} nom={camp.nom} inicial={inicial} obligatori={camp.obligatori} />
        ) : camp.contacte ? (
          <CampContacte comu={comu} mena={camp.contacte} />
        ) : camp.tipus === "vins" ? (
          <SelectorVins
            nom={camp.nom}
            triatsInicials={opcions[camp.nom] ?? []}
            activitat={fitxa.clau === "activitats" ? id : null}
            // La d'un lead convertit porta tots dos: mana el client, que ja n'ha heretat els tastos.
            clients={clientsTriats.length > 0 ? clientsTriats : leadTriat ? [leadTriat] : []}
          />
        ) : camp.tipus === "foto" ? (
          <CampFoto id={idCamp(camp.nom)} nom={camp.nom} activitat={id} fitxerInicial={inicial || null} />
        ) : camp.tipus === "booleà" ? (
          <label className="flex items-center gap-2 text-[13.5px] text-muted">
            <input type="checkbox" name={camp.nom} defaultChecked={valors[camp.nom] === true} className="size-4 accent-wine" />
            Sí
          </label>
        ) : (
          <input
            {...comu}
            type={
              camp.tipus === "data"
                ? "date"
                : camp.tipus === "nombre" || camp.tipus === "import" || camp.tipus === "decimal"
                    ? "number"
                    : "text"
            }
            {...(camp.tipus === "import" ? { step: "0.01" } : {})}
            {...(camp.tipus === "decimal" ? { step: "any" } : {})}
          />
        )}
        </Desactivable>

        {exclos && camp.excloent ? (
          <p className="text-[12px] text-muted">{camp.excloent.avis}</p>
        ) : camp.nota ? (
          <p className="text-[12px] text-muted">{camp.nota}</p>
        ) : null}
      </div>
    );
  };

  const grups = grupsDeCamps(fitxa);

  return (
    <form id={idFormulari} action={accio} className="space-y-4">
      <input type="hidden" name="entitat" value={fitxa.clau} />
      <input type="hidden" name="id" value={id ?? ""} />
      {retorn ? <input type="hidden" name="retorn" value={retorn} /> : null}
      {senseRedireccio ? <input type="hidden" name="sense_redireccio" value="1" /> : null}

      {fitxa.nomesLectura ? (
        <p className="rounded-lg bg-parchment px-3.5 py-2.5 text-[13px] text-muted">
          Aquesta fitxa la manté FactuSol. Des del portal es consulta; els canvis es fan a l&apos;ERP i arriben amb la
          propera sincronització.
        </p>
      ) : null}

      {/* L'error va a dalt, a tocar del botó que l'ha provocat. */}
      {estat.error ? (
        <p role="alert" className="rounded-lg bg-wine-tint px-3.5 py-2.5 text-[13px] text-wine-deep">
          {estat.error}
        </p>
      ) : null}

      {grups ? (
        // Amb espai (la fitxa d'un client), els camps van agrupats, i a dues columnes quan hi caben.
        <div className="@container space-y-4">
          {grups.map((grup) => {
            const camps = grup.camps.map(pintaCamp).filter(Boolean);
            if (camps.length === 0) return null;
            return (
              <section key={grup.titol} className="rounded-xl border border-line bg-white/60 p-4">
                <h3 className="mb-3 text-[12.5px] font-medium text-ink-soft">{grup.titol}</h3>
                <div className="grid grid-cols-1 gap-3.5 @xl:grid-cols-2">{camps}</div>
              </section>
            );
          })}
        </div>
      ) : (
        // Una sola columna que no creix més que el panell: un correu llarg es parteix, no l'eixampla.
        <div className="grid grid-cols-1 gap-3.5">{fitxa.camps.map(pintaCamp)}</div>
      )}
    </form>
  );
}
