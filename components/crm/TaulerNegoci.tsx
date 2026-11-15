import Link from "next/link";

import { TriaComercial } from "@/components/crm/TriaComercial";
import { GraficCategories, GraficMensual, GraficRanquing } from "@/components/grafics/GraficsTauler";
import { Kpi, TargetaGrafic } from "@/components/grafics/Targeta";
import { EstatBuit } from "@/components/UI";
import {
  bonsClientsSenseVisita, clientsQuePerden, leadsSenseMoure, oportunitatsATancar, perAgent, perCategoria, perClau, resumMacro,
  seriesMensuals, toDosVencuts, productesDestacats, visitesDeLaSetmana, type ClientDAtencio,
} from "@/domini/crm-tauler";
import { NOM_MES } from "@/domini/facturacio";
import { dataCurta, euros } from "@/lib/format";
import { rutaDelClient } from "@/lib/navegacio";
import { dadesDelTauler, type DadesTauler } from "@/serveis/crm-tauler";

const nombre = (valor: number, decimals = 0) => new Intl.NumberFormat("ca-ES", { maximumFractionDigits: decimals }).format(valor);
const percent = (valor: number) => `${valor.toFixed(0)} %`;

/**
 * El tauler de negoci: la casa (macro), l'equip, el territori i el catàleg
 * (meso), i el que toca fer avui (micro). Qui ho veu tot pot triar un agent;
 * un comercial hi veu la seva cartera i prou. Els càlculs són a
 * `domini/crm-tauler.ts`; les lectures, a `serveis/crm-tauler.ts`.
 */
export async function TaulerNegoci({ totes, agent }: { totes: boolean; agent: string }) {
  let dades: DadesTauler;
  try {
    dades = await dadesDelTauler(totes && agent ? agent : null);
  } catch (error) {
    return (
      <div className="p-6">
        <EstatBuit titol="No s'ha pogut llegir el tauler" text={(error as Error).message} />
      </div>
    );
  }

  const { avui, clients, activitats, oportunitats, tasques, leads, mesos, productes, agents, fetesEnguany, darreraActivitat } = dades;
  const macro = resumMacro(clients, oportunitats, fetesEnguany, avui);
  const mensual = seriesMensuals(mesos, macro.exercici);
  const categories = perCategoria(clients);
  const equip = perAgent(clients, activitats, oportunitats, agents, avui);
  const comarques = perClau(clients, (c) => c.comarca);
  const tipus = perClau(clients, (c) => c.tipus, 6);
  const { servits, presentatsSenseCompra } = productesDestacats(productes);
  const perden = clientsQuePerden(clients, darreraActivitat, avui);
  const refredats = bonsClientsSenseVisita(clients, darreraActivitat, avui);
  const aTancar = oportunitatsATancar(oportunitats, avui);
  const leadsQuiets = leadsSenseMoure(leads, activitats, avui);
  const vencuts = toDosVencuts(tasques, avui);
  const setmana = visitesDeLaSetmana(activitats, avui);
  const periode = macro.finsMes > 0 ? `gener–${NOM_MES[macro.finsMes - 1].toLowerCase()} ${macro.exercici}` : `${macro.exercici}, cap mes tancat`;
  const agentTriat = agents.find((a) => a.id === agent);

  return (
    <div className="space-y-8 p-4 sm:p-6">
      {/* ------------------------------------------------------------ macro */}
      <section className="space-y-3">
        <Capcalera
          titol={agentTriat ? `La cartera de ${agentTriat.nom}` : "La casa"}
          nota={`Facturació sense IVA de l'ERP, ${periode}, contra el mateix període de l'any passat. Enguany hi compten els albarans encara no facturats.`}
          dreta={
            totes ? (
              <TriaComercial
                etiqueta="Cartera de"
                valor={agent}
                opcions={[{ valor: "", etiqueta: "Tota la casa" }, ...agents.map((a) => ({ valor: a.id, etiqueta: a.nom }))]}
                base="/crm?v=tauler"
              />
            ) : null
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Kpi etiqueta="Facturació del període" valor={euros(macro.facturacio)} variacio={macro.variacio} detall={`${euros(macro.facturacio1)} l'any passat`} />
          <Kpi etiqueta="Clients que compren" valor={nombre(macro.compren)} detall={`de ${nombre(macro.clients)} a la cartera · ${percent(macro.clients ? (macro.compren / macro.clients) * 100 : 0)}`} />
          <Kpi etiqueta="Clients nous" valor={nombre(macro.nous)} detall={`donats d'alta el ${macro.exercici}`} />
          <Kpi etiqueta="Clients que perden" valor={nombre(macro.enRisc)} detall="facturen menys que l'any passat" />
          <Kpi etiqueta="Pipeline obert" valor={euros(macro.pipeline)} detall={`${euros(macro.ponderat)} ponderat · ${macro.obertes} oportunitats`} />
          <Kpi
            etiqueta="Visites al dia"
            valor={macro.ambPeriodicitat ? percent((macro.alDia / macro.ambPeriodicitat) * 100) : "—"}
            detall={macro.ambPeriodicitat ? `${macro.alDia} de ${macro.ambPeriodicitat} clients amb periodicitat` : "cap client amb periodicitat"}
          />
        </div>
        <div className="grid gap-3 xl:grid-cols-3">
          <TargetaGrafic titol="Facturació mes a mes" subtitol={`${macro.exercici} en columnes, ${macro.exercici - 1} en línia`} ample>
            <GraficMensual actual={mensual.actual} anterior={mensual.anterior} exercici={macro.exercici} finsMes={macro.finsMes} />
          </TargetaGrafic>
          <TargetaGrafic titol="Categories A–E" subtitol="Quina part de la facturació fa cada categoria">
            <GraficCategories files={categories} />
          </TargetaGrafic>
        </div>
      </section>

      {/* ------------------------------------------------------------- meso */}
      <section className="space-y-3">
        <Capcalera titol="Equip, territori i catàleg" nota="On es ven, qui ho ven i què es ven. Visites dels darrers 90 dies." />
        <TargetaGrafic titol="Per agent comercial" subtitol="La cartera de cadascú: clients, facturació del període i pipeline" ample>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-[0.06em] text-muted">
                  <th className="py-1.5 pr-3 font-medium">Agent</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Clients</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Compren</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Facturació</th>
                  <th className="py-1.5 pr-3 text-right font-medium">vs any passat</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Visites 90 d</th>
                  <th className="py-1.5 text-right font-medium">Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {equip.map((fila) => (
                  <tr key={fila.id ?? "sense"} className={fila.id ? "" : "text-muted"}>
                    <td className="py-2 pr-3 font-medium">
                      {totes && fila.id ? <Link href={`/crm?v=tauler&c=${fila.id}`} className="hover:text-marca">{fila.nom}</Link> : fila.nom}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nombre(fila.clients)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nombre(fila.compren)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{euros(fila.facturacio)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums"><Variacio valor={fila.variacio} /></td>
                    <td className="py-2 pr-3 text-right tabular-nums">{nombre(fila.visites90)}</td>
                    <td className="py-2 text-right tabular-nums">{euros(fila.pipeline)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {equip.some((f) => f.id === null) ? (
            <p className="mt-2 text-[12.5px] text-muted">
              Els clients sense agent no els veu cap comercial al portal: val la pena assignar-los a l&apos;ERP.
            </p>
          ) : null}
        </TargetaGrafic>
        <div className="grid gap-3 xl:grid-cols-2">
          <TargetaGrafic titol="Per comarca" subtitol="Les vuit que més facturen, i la resta agrupada">
            <GraficRanquing files={comarques} />
          </TargetaGrafic>
          <TargetaGrafic titol="Per tipus de client" subtitol="Clíniques, botigues, explotacions…">
            <GraficRanquing files={tipus} />
          </TargetaGrafic>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <TargetaGrafic titol="Productes més servits" subtitol={`Línies d'albarà del ${macro.exercici}`}>
            <Ranquing files={servits.map((producte) => ({ id: producte.id, nom: producte.nom, valor: producte.linies, etiqueta: `${nombre(producte.linies)} línies` }))} buit="Cap albarà enguany." />
          </TargetaGrafic>
          <TargetaGrafic titol="Presentats i encara no servits" subtitol="Han sortit en activitats però no en cap albarà enguany: oportunitat de vendre">
            <Ranquing files={presentatsSenseCompra.map((producte) => ({ id: producte.id, nom: producte.nom, valor: producte.presentacions, etiqueta: `${nombre(producte.presentacions)} ${producte.presentacions === 1 ? "presentació" : "presentacions"}` }))} buit="Tot el que s'ha presentat ja s'ha servit." />
          </TargetaGrafic>
        </div>
      </section>

      {/* ------------------------------------------------------------ micro */}
      <section className="space-y-3">
        <Capcalera
          titol="Què toca fer"
          nota={`Setmana: ${setmana.total} ${setmana.total === 1 ? "visita" : "visites"}, ${setmana.fetes} fetes, ${setmana.avui} avui.`}
          dreta={<Link href="/crm?v=avui" className="btn-compacte">Obre Avui</Link>}
        />
        <div className="grid gap-3 xl:grid-cols-2">
          <LlistaClients
            titol="Clients que perden"
            subtitol="Els que més facturació deixen respecte de l'any passat. Primer aquests."
            files={perden}
            buit="Cap client factura menys que l'any passat."
          />
          <LlistaClients
            titol="Bons clients sense visita"
            subtitol="Categoria A o B i més de tres mesos sense cap activitat."
            files={refredats}
            buit="Tots els clients A i B tenen activitat recent."
          />
          <TargetaGrafic titol="Oportunitats a tancar" subtitol="Tancament previst en dues setmanes o ja passat">
            {aTancar.length === 0 ? (
              <Buit text="Cap oportunitat amb tancament a la vista." />
            ) : (
              <ul className="divide-y divide-line/70 text-[13px]">
                {aTancar.slice(0, 8).map((o) => (
                  <li key={o.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link href={`/crm?v=oportunitats&r=${o.id}`} className="font-medium hover:text-marca">{o.titol ?? "Sense títol"}</Link>
                      <span className="block text-[12.5px] text-muted">{o.client?.nom ?? o.lead?.nom ?? ""} · {o.etapa ?? "sense etapa"}</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      {euros(o.valor)}
                      <span className={`block text-[12px] ${(o.tancamentPrevist ?? "") < avui ? "text-marca" : "text-muted"}`}>{dataCurta(o.tancamentPrevist ?? undefined)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TargetaGrafic>
          <TargetaGrafic titol="Leads sense moure" subtitol="Entrats els darrers 30 dies i encara sense cap activitat">
            {leadsQuiets.length === 0 ? (
              <Buit text="Tots els leads recents tenen alguna activitat." />
            ) : (
              <ul className="divide-y divide-line/70 text-[13px]">
                {leadsQuiets.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-3 py-2">
                    <Link href={`/crm?v=leads&r=${l.id}`} className="min-w-0 font-medium hover:text-marca">{l.nom ?? "Sense nom"}</Link>
                    <span className="shrink-0 text-[12.5px] text-muted">{l.poblacio ?? ""} · {dataCurta(l.dataAlta ?? undefined)}</span>
                  </li>
                ))}
              </ul>
            )}
          </TargetaGrafic>
          <TargetaGrafic titol="To-Do vençuts" subtitol={`${vencuts.length} ${vencuts.length === 1 ? "pendent" : "pendents"} amb la data passada`} ample>
            {vencuts.length === 0 ? (
              <Buit text="Cap To-Do vençut." />
            ) : (
              <ul className="grid gap-x-6 text-[13px] sm:grid-cols-2">
                {vencuts.slice(0, 10).map((t) => (
                  <li key={t.id} className="flex items-baseline justify-between gap-3 border-b border-line/70 py-2">
                    <span className="min-w-0">
                      <Link href="/crm?v=deures" className="font-medium hover:text-marca">{t.titol ?? "Sense títol"}</Link>
                      <span className="block text-[12.5px] text-muted">{t.client?.nom ?? t.lead?.nom ?? ""}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-marca">{dataCurta(t.venciment ?? undefined)}</span>
                  </li>
                ))}
              </ul>
            )}
          </TargetaGrafic>
        </div>
      </section>
    </div>
  );
}

function Capcalera({ titol, nota, dreta }: { titol: string; nota: string; dreta?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-[22px] leading-tight">{titol}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">{nota}</p>
      </div>
      {dreta}
    </div>
  );
}

function Variacio({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-muted">—</span>;
  return <span className={`tabular-nums ${valor >= 0 ? "text-emerald-700" : "text-marca"}`}>{valor >= 0 ? "↑" : "↓"} {Math.abs(valor).toFixed(1).replace(".", ",")} %</span>;
}

function Buit({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-muted">{text}</p>;
}

/** Una llista amb barres proporcionals: productes, bàsicament. */
function Ranquing({ files, buit }: { files: { id: string; nom: string; valor: number; etiqueta: string }[]; buit: string }) {
  if (files.length === 0) return <Buit text={buit} />;
  const maxim = Math.max(...files.map((f) => f.valor), 1);
  return (
    <ol className="space-y-1.5 text-[13px]">
      {files.map((fila, i) => (
        <li key={fila.id} className="grid grid-cols-[1.5ch_1fr_auto] items-center gap-x-2">
          <span className="text-[12px] tabular-nums text-muted">{i + 1}</span>
          <span className="relative min-w-0 truncate py-0.5">
            <span className="absolute inset-y-0 left-0 rounded bg-marca-clar" style={{ width: `${(fila.valor / maxim) * 100}%` }} />
            <span className="relative pl-1.5">{fila.nom}</span>
          </span>
          <span className="text-[12.5px] tabular-nums text-muted">{fila.etiqueta}</span>
        </li>
      ))}
    </ol>
  );
}

function LlistaClients({ titol, subtitol, files, buit }: { titol: string; subtitol: string; files: ClientDAtencio[]; buit: string }) {
  return (
    <TargetaGrafic titol={titol} subtitol={subtitol}>
      {files.length === 0 ? (
        <Buit text={buit} />
      ) : (
        <ul className="divide-y divide-line/70 text-[13px]">
          {files.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <Link href={rutaDelClient(c.id)} className="font-medium hover:text-marca">{c.nom}</Link>
                <span className="block text-[12.5px] text-muted">
                  {c.categoria ? `Categoria ${c.categoria} · ` : ""}
                  {c.diesSenseVisita === null ? "cap activitat registrada" : `darrera activitat fa ${c.diesSenseVisita} dies`}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                {euros(c.periode)}
                <span className="block text-[12px]"><Variacio valor={c.variacio} /></span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </TargetaGrafic>
  );
}
