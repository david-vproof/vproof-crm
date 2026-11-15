"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { creaActivitatsAccio, type EstatAccions } from "@/app/(portal)/crm/accions";
import { MiniFacturacio, fonsDeTendencia } from "@/components/crm/MiniFacturacio";
import { Pastilla } from "@/components/crm/Pastilla";
import { Lletres } from "@/components/crm/Lletres";
import { Notes } from "@/components/crm/Notes";
import { rutaDelClient } from "@/lib/navegacio";

/** Un client triat per a la ronda: una franja granat al marge, perquè el fons ja és el de la tendència. */
const MARCA_TRIAT = "shadow-[inset_3px_0_0_0_#8c2f45]";
import { disponibilitat, posicioDeData } from "@/domini/crm-horaris";
import { ZONA } from "@/domini/crm-planner";
import { dataCurta } from "@/lib/format";
import type { CompteDelSegment } from "@/serveis/crm-segments";
import { MarquesClient } from "@/components/crm/MarquesClient";

/** Per a una ronda, el punt de partida natural és una visita. */
const TIPUS_PER_DEFECTE = "visita_sense_vi";

function avuiAqui() {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
}

/** «09:00» més 45 minuts és «09:45». Es queda dins del dia. */
function sumaMinuts(hora: string, minuts: number) {
  const [h, m] = hora.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, (h || 0) * 60 + (m || 0) + minuts));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const HORA_INICIAL = "09:00";
const INTERVAL_INICIAL = 60;

/** L'avís que toca segons si el compte està obert a aquella hora. */
const AVIS: Record<string, { text: string; to: string } | null> = {
  obert: null,
  sense_horari: null,
  tancat: { text: "fora d'horari", to: "bg-amber-50 text-amber-800" },
  bloquejat: { text: "dia bloquejat", to: "bg-wine-tint text-wine-deep" },
};

/**
 * Els comptes d'un segment, per triar-los i registrar-los l'activitat de cop.
 *
 * Es tria amb caselles perquè el cas real és «tots menys un parell»: la casella
 * de la capçalera els marca tots i després se n'exclouen els que calgui.
 */
export function AccionsSegment({
  comptes,
  nomSegment,
  opcionsTipus,
  triatsInicials = false,
}: {
  comptes: CompteDelSegment[];
  nomSegment: string;
  /** Els tipus d'activitat que es poden triar: [valor, nom]. */
  opcionsTipus: [string, string][];
  /** Tots marcats d'entrada, amb les hores encadenades: a una planificació ja s'han triat al modal. */
  triatsInicials?: boolean;
}) {
  // Cada compte triat porta la seva hora: una ruta no es fa tota de cop.
  const [hores, setHores] = useState<Map<string, string>>(() =>
    triatsInicials
      ? new Map(comptes.map((compte, posicio) => [compte.id, sumaMinuts(HORA_INICIAL, posicio * INTERVAL_INICIAL)]))
      : new Map(),
  );
  const [estat, accio, enviant] = useActionState<EstatAccions, FormData>(creaActivitatsAccio, {});
  // La data d'avui s'omple després de muntar: calculada al render, el servidor
  // i el navegador podrien no coincidir a tocar de mitjanit.
  const [dia, setDia] = useState("");
  const [desDe, setDesDe] = useState(HORA_INICIAL);
  const [interval, setInterval] = useState(INTERVAL_INICIAL);
  // El dia triat governa els avisos: el mateix compte pot estar obert dimarts i
  // tancat dissabte, i l'horari va per dia de la setmana.
  const [diaTriat, setDiaTriat] = useState("");

  useEffect(() => {
    const avui = avuiAqui();
    setDia(avui);
    setDiaTriat(avui);
  }, []);
  // Un cop creades, la selecció ja no vol dir res.
  useEffect(() => {
    if (estat.fet) setHores(new Map());
  }, [estat.fet]);

  // Sempre en l'ordre de la taula, que és l'ordre de la ruta, independentment
  // de l'ordre en què s'hagin anat marcant.
  const triades = comptes
    .filter((compte) => hores.has(compte.id))
    .map((compte) => ({ compte, hora: hores.get(compte.id) as string }));

  const totsTriats = comptes.length > 0 && hores.size === comptes.length;

  /** Encadena les hores de tots els triats a partir de l'hora d'inici. */
  function encadena(base = desDe, pas = interval, ids = triades.map((v) => v.compte.id)) {
    setHores(new Map(ids.map((id, posicio) => [id, sumaMinuts(base, posicio * pas)])));
  }

  function commuta(id: string) {
    setHores((previs) => {
      const nous = new Map(previs);
      if (nous.has(id)) {
        nous.delete(id);
        return nous;
      }
      // L'hora que es proposa continua la ronda: l'última més l'interval.
      const ultima = comptes
        .filter((compte) => previs.has(compte.id))
        .map((compte) => previs.get(compte.id) as string)
        .pop();
      nous.set(id, ultima ? sumaMinuts(ultima, interval) : desDe);
      return nous;
    });
  }

  /** El resum d'un compte en una línia, per a la fitxa del telèfon. */
  function situacio(compte: CompteDelSegment) {
    return [compte.poblacio, compte.comarca].filter(Boolean).join(" · ");
  }

  function recorregut(compte: CompteDelSegment) {
    const parts = [`${compte.activitats} ${compte.activitats === 1 ? "activitat" : "activitats"}`];
    const darrera = dataCurta(compte.darrera ?? undefined);
    if (darrera) parts.push(`darrera ${darrera}`);
    if (compte.oportunitats) parts.push(`${compte.oportunitats} oport. obertes`);
    return parts.join(" · ");
  }

  return (
    <div>
      {/* Al telèfon una taula de set columnes demanaria rascar cap al costat:
          es plega en fitxes, com als llistats. La casella i el nom són dues
          zones de toc distintes, perquè triar per a la ronda i obrir el compte
          són dues coses diferents. */}
      <ul className="divide-y divide-line/60 border-b border-line md:hidden">
        <li className="flex items-center gap-2.5 bg-parchment/40 px-3 py-2">
          <input
            type="checkbox"
            id="tots-mobil"
            aria-label="Selecciona tots els clients"
            checked={totsTriats}
            onChange={() =>
              totsTriats ? setHores(new Map()) : encadena(desDe, interval, comptes.map((c) => c.id))
            }
            className="size-4 shrink-0 accent-wine"
          />
          <label htmlFor="tots-mobil" className="text-[12.5px] text-muted">
            {totsTriats ? "Treu-los tots" : "Tria'ls tots"}
          </label>
        </li>

        {comptes.map((compte) => {
          const triat = hores.has(compte.id);
          const resum = situacio(compte);
          return (
            <li key={compte.id} className={`${fonsDeTendencia(compte.facturacio)} ${triat ? MARCA_TRIAT : ""}`}>
              <div className="flex items-start gap-2.5 px-3 py-2.5">
                <label className="-m-1.5 flex shrink-0 cursor-pointer p-1.5">
                  <input
                    type="checkbox"
                    checked={triat}
                    onChange={() => commuta(compte.id)}
                    className="mt-0.5 size-4 accent-wine"
                  />
                  <span className="sr-only">Selecciona {compte.nom}</span>
                </label>

                <Link href={rutaDelClient(compte.id)} scroll={false} className="min-w-0 flex-1">
                  {/* A dalt el nom; a sota, les lletres (categoria i potencial), el tipus i la facturació. */}
                  <span className="block break-words text-[14px] font-medium text-ink">{compte.nom}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Lletres categoria={compte.categoria} potencial={compte.potencial} />
                    <Pastilla text={compte.tipusClient} etiqueta="Tipus de client" />
                    <span className="shrink-0 text-[12px]">
                      <MiniFacturacio dades={compte.facturacio} compacte />
                    </span>
                  </span>
                  {resum ? <span className="mt-1 block break-words text-[12px] text-muted">{resum}</span> : null}
                  <span className="mt-0.5 block text-[12px] text-muted">{recorregut(compte)}</span>
                </Link>
                {/* Fora de l'enllaç, com les notes: obrir els atributs no ha d'obrir la fitxa. */}
                <MarquesClient marques={compte.marques} nom={compte.nom} mida="gran" />
              </div>
              {/* Fora de l'enllaç: obrir les notes no ha d'obrir la fitxa del client. */}
              <Notes text={compte.notes} className="px-3 pb-2.5 pl-[42px]" />
            </li>
          );
        })}
      </ul>

      <div className="hidden md:block">
        <table className="w-full min-w-[700px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line/70 text-left text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted">
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Selecciona tots els clients"
                  checked={totsTriats}
                  onChange={() =>
                    totsTriats ? setHores(new Map()) : encadena(desDe, interval, comptes.map((c) => c.id))
                  }
                  className="size-3.5 accent-wine"
                />
              </th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Població</th>
              <th className="px-3 py-2 text-right">Activitats</th>
              <th className="px-3 py-2">Darrera</th>
              <th className="px-3 py-2 text-right">Oport. obertes</th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((compte) => {
              const triat = hores.has(compte.id);
              return (
                <tr
                  key={compte.id}
                  className={`group border-b border-line/50 last:border-0 transition-colors hover:bg-parchment/40 ${fonsDeTendencia(compte.facturacio)}`}
                >
                  <td className={`px-3 py-2 ${triat ? MARCA_TRIAT : ""}`}>
                    <input
                      type="checkbox"
                      aria-label={`Selecciona ${compte.nom}`}
                      checked={triat}
                      onChange={() => commuta(compte.id)}
                      className="size-3.5 accent-wine"
                    />
                  </td>
                  {/* Les lletres, el tipus de client i la facturació van al costat del nom, sense columna pròpia. */}
                  {/* A dalt el nom; a sota, a caselles fixes perquè quedi en columna fila a fila, les lletres, el tipus i la facturació. */}
                  <td className="max-w-[380px] px-3 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Link
                        href={rutaDelClient(compte.id)}
                        scroll={false}
                        className="block min-w-0 truncate font-medium text-ink underline-offset-2 group-hover:text-wine group-hover:underline"
                      >
                        {compte.nom}
                      </Link>
                      <MarquesClient marques={compte.marques} nom={compte.nom} />
                    </span>
                    <span className="mt-1 flex min-w-0 items-center gap-2">
                      <span className="flex w-14 shrink-0">
                        <Lletres categoria={compte.categoria} potencial={compte.potencial} />
                      </span>
                      <span className="flex w-28 min-w-0 shrink-0">
                        <Pastilla text={compte.tipusClient} etiqueta="Tipus de client" />
                      </span>
                      <span className="flex w-44 shrink-0 text-[12.5px]">
                        <MiniFacturacio dades={compte.facturacio} />
                      </span>
                    </span>
                    <Notes text={compte.notes} className="mt-1" />
                  </td>
                  {/* La comarca va sota la població: així la taula no s'eixampla. */}
                  <td className="px-3 py-2 text-muted">
                    <span className="block">{compte.poblacio || "—"}</span>
                    {compte.comarca ? <span className="block text-[11.5px]">{compte.comarca}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{compte.activitats}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">
                    {dataCurta(compte.darrera ?? undefined) || "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                    {compte.oportunitats || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* La barra d'acció només surt amb algú triat: sense selecció no hi ha res a fer. */}
      {triades.length > 0 ? (
        <form action={accio} className="border-t border-line bg-parchment/40 px-3.5 py-3">
          <input
            type="hidden"
            name="visites"
            value={JSON.stringify(triades.map((v) => ({ compte: v.compte.id, hora: v.hora })))}
          />

          {/* El que és igual per a tota la ronda. */}
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
              Tipus
              <select name="tipus" defaultValue={TIPUS_PER_DEFECTE} className="field-compacte !w-auto min-w-[150px]">
                {opcionsTipus.map(([valor, text]) => (
                  <option key={valor} value={valor}>
                    {text}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
              Dia
              <input
                type="date"
                name="dia"
                defaultValue={dia}
                required
                onChange={(e) => setDiaTriat(e.target.value)}
                className="field-compacte !w-auto"
              />
            </label>

            <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
              Assumpte
              <input
                type="text"
                name="assumpte"
                defaultValue={`Ronda ${nomSegment}`}
                required
                className="field-compacte"
              />
            </label>
          </div>

          {/* I l'hora de cadascú, que és el que canvia. */}
          <ul className="mt-3 space-y-1.5">
            {triades.map(({ compte, hora }, posicio) => {
              const posicioDia = diaTriat ? posicioDeData(diaTriat) : null;
              const estat = posicioDia === null ? "sense_horari" : disponibilitat(compte.horariComercial, posicioDia, hora);
              const avis = AVIS[estat];
              const blocs = posicioDia === null ? [] : (compte.horariComercial[posicioDia]?.blocs ?? []);

              return (
              <li
                key={compte.id}
                className={`flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 ${fonsDeTendencia(compte.facturacio) || "bg-white"}`}
              >
                <span className="w-5 shrink-0 text-right text-[11.5px] tabular-nums text-muted">{posicio + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{compte.nom}</span>

                {/* Què diu el seu horari aquell dia, i si l'hora hi encaixa. */}
                {blocs.length > 0 ? (
                  <span className="hidden shrink-0 text-[11.5px] tabular-nums text-muted md:block">
                    {blocs.map((bloc) => `${bloc.de}-${bloc.a}`).join(" i ")}
                  </span>
                ) : null}
                {avis ? (
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${avis.to}`}>
                    {avis.text}
                  </span>
                ) : null}

                {compte.poblacio ? (
                  <span className="hidden shrink-0 text-[12px] text-muted md:block">{compte.poblacio}</span>
                ) : null}
                <input
                  type="time"
                  aria-label={`Hora de ${compte.nom}`}
                  value={hora}
                  required
                  onChange={(e) =>
                    setHores((previs) => new Map(previs).set(compte.id, e.target.value || HORA_INICIAL))
                  }
                  className="field-compacte !w-[104px] shrink-0"
                />
                <button
                  type="button"
                  aria-label={`Treu ${compte.nom} de la ronda`}
                  onClick={() => commuta(compte.id)}
                  className="grid size-6 shrink-0 place-items-center rounded-md text-[14px] leading-none text-muted transition hover:bg-wine-tint hover:text-wine"
                >
                  ×
                </button>
              </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
            {/* Omplir-les a mà una per una és feina: això les encadena de cop. */}
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
              <span>Des de</span>
              <input
                type="time"
                aria-label="Hora d'inici de la ronda"
                value={desDe}
                onChange={(e) => setDesDe(e.target.value || HORA_INICIAL)}
                className="field-compacte !w-[104px]"
              />
              <span>cada</span>
              <input
                type="number"
                aria-label="Minuts entre visites"
                value={interval}
                min={0}
                max={600}
                step={5}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="field-compacte !w-[76px]"
              />
              <span>min</span>
              <button
                type="button"
                onClick={() => encadena()}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] transition hover:border-ink"
              >
                Reomple les hores
              </button>
            </div>

            <button type="submit" disabled={enviant} className="btn-compacte">
              {enviant
                ? "Creant…"
                : `Crea ${triades.length} ${triades.length === 1 ? "activitat" : "activitats"}`}
            </button>
          </div>
        </form>
      ) : null}

      {estat.error ? (
        <p role="alert" className="border-t border-line bg-wine-tint px-3.5 py-2.5 text-[13px] text-wine-deep">
          {estat.error}
        </p>
      ) : null}
      {estat.fet ? (
        <p role="status" className="border-t border-line bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
          {estat.fet}
        </p>
      ) : null}
    </div>
  );
}
