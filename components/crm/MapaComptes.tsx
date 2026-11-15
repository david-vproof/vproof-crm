"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { CercaAlMapa } from "@/components/crm/CercaAlMapa";
import { ModalRegio } from "@/components/crm/ModalRegio";
import { puntDinsRegio, quantsClients, type PuntCompte, type PuntDestacat, type Regio } from "@/domini/crm-mapa";
import { SENSE_SEGMENT } from "@/domini/crm-planner";
import type { SegmentDelMapa } from "@/serveis/crm-mapa";

/**
 * Leaflet toca `window` en importar-se, així que només es carrega al navegador.
 * El contenidor reserva l'alçada perquè no hi hagi salt mentre arriba.
 */
const MapaIntern = dynamic(() => import("./MapaIntern"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-parchment/70" />,
});

/** El valor del filtre d'agent per als clients que no en tenen cap. */
const SENSE_AGENT = "cap";

/**
 * El mapa amb el filtre d'agent, el selector de segments i l'eina de regions a sobre.
 *
 * La tria es queda al navegador: canviar de segment o d'agent no torna a
 * demanar res al servidor, només repinta el que ja hi ha. El segment només
 * apaga els altres punts; l'agent, en canvi, treu del mapa els que no són seus. Les regions es dibuixen resseguint
 * el contorn, i els clients que hi cauen s'obren en un modal per planificar-los
 * o desar-los com a segment per ubicació. La cerca porta a un client del mapa
 * o a una adreça, que es marca amb una xinxeta.
 */
export function MapaComptes({
  punts: totsElsPunts,
  segments,
  inicial = "",
  opcionsTipus,
}: {
  punts: PuntCompte[];
  segments: SegmentDelMapa[];
  /** El segment que ve a l'adreça, perquè sobrevisqui a una recàrrega. */
  inicial?: string;
  /** Els tipus d'activitat que es poden triar en planificar una regió. */
  opcionsTipus: [string, string][];
}) {
  const [triat, setTriat] = useState(inicial);
  const [agent, setAgent] = useState("");
  const [regions, setRegions] = useState<Regio[]>([]);
  const [dibuixant, setDibuixant] = useState(false);
  const [modal, setModal] = useState(false);
  const [destacat, setDestacat] = useState<PuntDestacat | null>(null);

  // Els agents que tenen algun client situat, amb quants, per al desplegable.
  // Es compten clients, no punts: un client amb tres establiments és un client.
  const agents = useMemo(() => {
    const perId = new Map<string, { nom: string; clients: Set<string> }>();
    for (const punt of totsElsPunts) {
      if (!punt.agentId) continue;
      const actual = perId.get(punt.agentId);
      if (actual) actual.clients.add(punt.clientId);
      else perId.set(punt.agentId, { nom: punt.agent, clients: new Set([punt.clientId]) });
    }
    return [...perId.entries()]
      .map(([id, { nom, clients }]) => ({ id, nom, quants: clients.size }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  }, [totsElsPunts]);
  const senseAgent = quantsClients(totsElsPunts.filter((punt) => !punt.agentId));

  // Tot el que ve després (segments, regions i el mapa) treballa amb els clients de l'agent triat.
  const punts = useMemo(
    () =>
      agent === ""
        ? totsElsPunts
        : totsElsPunts.filter((punt) => (agent === SENSE_AGENT ? !punt.agentId : punt.agentId === agent)),
    [totsElsPunts, agent],
  );
  const quantsPerSegment = useMemo(() => {
    const clients = new Map<string, Set<string>>();
    for (const punt of punts) {
      const seus = clients.get(punt.segmentId);
      if (seus) seus.add(punt.clientId);
      else clients.set(punt.segmentId, new Set([punt.clientId]));
    }
    return new Map([...clients].map(([segment, seus]) => [segment, seus.size]));
  }, [punts]);
  const senseSegment = quantsPerSegment.get("") ?? 0;

  // Qui cau dins d'alguna regió, de tots els clients situats: la tria de segment només pinta.
  // N'hi ha prou que un dels seus establiments hi caigui; cada client, un cop.
  const dins = useMemo(
    () => [
      ...new Set(
        punts
          .filter((punt) => regions.some((regio) => puntDinsRegio(punt.latitud, punt.longitud, regio)))
          .map((punt) => punt.clientId),
      ),
    ],
    [punts, regions],
  );

  const pastilla = (activa: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] transition ${
      activa ? "border-ink bg-ink text-cream" : "border-line bg-white text-ink-soft hover:border-ink"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* El selector: què s'il·lumina i què queda apagat. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {agents.length > 0 ? (
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              aria-label="Agent comercial"
              className={`field-compacte !w-auto max-w-full !rounded-full !py-1 !text-[12.5px] ${agent ? "!border-ink" : ""}`}
            >
              <option value="">Tots els agents</option>
              {agents.map((opcio) => (
                <option key={opcio.id} value={opcio.id}>
                  {opcio.nom} ({opcio.quants})
                </option>
              ))}
              {senseAgent > 0 ? <option value={SENSE_AGENT}>Sense agent ({senseAgent})</option> : null}
            </select>
          ) : null}

          <button type="button" onClick={() => setTriat("")} className={pastilla(triat === "")}>
            Tots
            <span className="tabular-nums opacity-60">{quantsClients(punts)}</span>
          </button>

          {/* Amb un agent triat, només els segments on en té algun. */}
          {segments.filter((segment) => !agent || quantsPerSegment.has(segment.id)).map((segment) => (
            <button
              key={segment.id}
              type="button"
              onClick={() => setTriat(triat === segment.id ? "" : segment.id)}
              aria-pressed={triat === segment.id}
              className={pastilla(triat === segment.id)}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.nom}
              <span className="tabular-nums opacity-60">{agent ? quantsPerSegment.get(segment.id) : segment.quants}</span>
            </button>
          ))}

          {senseSegment > 0 ? (
            <span className="ml-1 text-[12px] text-muted">
              {senseSegment} {senseSegment === 1 ? "client" : "clients"} {SENSE_SEGMENT.toLowerCase()}
            </span>
          ) : null}
        </div>

        {/* La cerca i l'eina de regions d'interès. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <CercaAlMapa punts={punts} alDestacar={setDestacat} />
          {dibuixant ? (
            <span className="text-[12.5px] text-marca-fosc">Arrossega sobre el mapa per resseguir el contorn</span>
          ) : null}
          <button type="button" onClick={() => setDibuixant(!dibuixant)} aria-pressed={dibuixant} className={pastilla(dibuixant)}>
            {dibuixant ? "Cancel·la" : regions.length > 0 ? "+ Afegeix una regió" : "Dibuixa una regió"}
          </button>
          {regions.length > 0 && !dibuixant ? (
            <>
              <button type="button" onClick={() => setRegions([])} className={pastilla(false)}>
                {regions.length === 1 ? "Esborra la regió" : `Esborra les ${regions.length} regions`}
              </button>
              <button type="button" onClick={() => setModal(true)} disabled={dins.length === 0} className="btn-compacte">
                {dins.length === 0 ? "Cap client a dins" : `Veure ${dins.length} ${dins.length === 1 ? "client" : "clients"}`}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* isolate: els z-index interns de Leaflet (fins a 1000) no han de passar per sobre del panell de la fitxa. */}
      <div className={`isolate min-h-0 flex-1 overflow-hidden rounded-xl border ${dibuixant ? "border-marca" : "border-line"}`}>
        <MapaIntern
          punts={punts}
          segmentTriat={triat}
          regions={regions}
          dibuixant={dibuixant}
          destacat={destacat}
          alAfegirRegio={(regio) => {
            setRegions((previes) => [...previes, regio]);
            // Una regió cada vegada: per afegir-ne una altra es torna a prémer.
            setDibuixant(false);
          }}
        />
      </div>

      <ModalRegio obert={modal} alTancar={() => setModal(false)} ids={dins} regions={regions} opcionsTipus={opcionsTipus} />
    </div>
  );
}
