import { BotonsContacte, teContacte } from "@/components/crm/Contacte";
import { MapaEstabliment } from "@/components/crm/MapaEstabliment";
import { nomDeLloc } from "@/lib/format";
import type { Establiment } from "@/serveis/establiments";

/** On porta «Com arribar-hi»: el punt del mapa si en té, i si no, l'adreça escrita. */
function enllacRuta(establiment: Establiment) {
  const latitud = Number(establiment.latitud);
  const longitud = Number(establiment.longitud);
  const desti =
    establiment.latitud !== null && establiment.longitud !== null && Number.isFinite(latitud) && Number.isFinite(longitud)
      ? `${latitud},${longitud}`
      : [establiment.adreca, establiment.codi_postal, establiment.poblacio, establiment.provincia].filter(Boolean).join(", ");
  return desti ? `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({ destination: desti })}` : null;
}

/** El punt d'un establiment com a números, o cap si no en té o no és vàlid. */
function puntDe(establiment: Establiment): { latitud: number; longitud: number } | null {
  if (establiment.latitud === null || establiment.longitud === null) return null;
  const latitud = Number(establiment.latitud);
  const longitud = Number(establiment.longitud);
  return Number.isFinite(latitud) && Number.isFinite(longitud) ? { latitud, longitud } : null;
}

/**
 * Els establiments d'un client: les direccions d'entrega de FactuSol. Les
 * dades les manté l'ERP; el que és del portal és el punt del mapa, que surt
 * en petit a cada caixa i es pot situar o moure des d'aquí. De cadascun,
 * l'adreça, qui hi ha i com arribar-hi, que és el que es busca quan s'és a la carretera.
 */
export function PanellEstabliments({ establiments }: { establiments: Establiment[] }) {
  if (establiments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
        Aquest client no té cap direcció d&apos;entrega a FactuSol: al mapa surt a la seva adreça fiscal.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        Les direccions d&apos;entrega de FactuSol: es canvien a l&apos;ERP i arriben amb la sincronització de clients. El punt del
        mapa sí que es pot situar o moure des d&apos;aquí.
      </p>

      <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white">
        {establiments.map((establiment) => {
          const lloc = [establiment.codi_postal, nomDeLloc(establiment.poblacio)].filter(Boolean).join(" ");
          const regio = [nomDeLloc(establiment.provincia), establiment.pais !== "Espanya" ? establiment.pais : null]
            .filter(Boolean)
            .join(" · ");
          const ruta = enllacRuta(establiment);
          const ambTelefon = teContacte("telefon", establiment.telefon);
          const ambCorreu = teContacte("correu", establiment.correu);
          const punt = puntDe(establiment);
          const adrecaEscrita = [establiment.adreca, establiment.codi_postal, establiment.poblacio, establiment.provincia].filter(Boolean).join(", ");

          return (
            <li key={establiment.id} className="flex flex-col gap-3 px-3.5 py-3 sm:flex-row sm:flex-wrap sm:items-start">
              {/* El mapa en petit, al costat de l'adreça: en una ullada se sap on cau. */}
              <MapaEstabliment id={establiment.id} latitud={punt?.latitud ?? null} longitud={punt?.longitud ?? null} adreca={adrecaEscrita} />
              <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium text-ink">
                  {establiment.nom ?? "Sense nom"}
                  {establiment.per_reparacions ? (
                    // La marca de FactuSol per a parts de reparació: l'adreça es veu aquí, però no és un punt d'entrega ni surt al mapa.
                    <span
                      title="A FactuSol és la direcció d'entrega per a la impressió de parts de reparació: no surt al mapa."
                      className="rounded-full bg-parchment px-2 py-0.5 text-[11px] font-medium text-muted"
                    >
                      Parts de reparació · fora del mapa
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  {establiment.adreca ?? <span className="text-muted">Sense adreça</span>}
                  {lloc ? <span className="block">{lloc}</span> : null}
                  {regio ? <span className="block text-muted">{regio}</span> : null}
                </p>
                {/* A FactuSol, el telèfon i la persona de contacte porten sovint l'horari: es mostren tal qual. */}
                {establiment.telefon || establiment.persona_contacte || establiment.correu ? (
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
                    {establiment.persona_contacte ? <span>{establiment.persona_contacte}</span> : null}
                    {establiment.telefon ? <span>{establiment.telefon}</span> : null}
                    {establiment.correu ? <span>{establiment.correu}</span> : null}
                  </p>
                ) : null}
                {ruta ? (
                  <a
                    href={ruta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block text-[12.5px] text-wine transition hover:underline"
                  >
                    Com arribar-hi →
                  </a>
                ) : null}
              </div>

              {ambTelefon || ambCorreu ? (
                <div className="flex max-w-[45%] shrink-0 flex-wrap justify-end gap-1.5">
                  {ambTelefon ? <BotonsContacte mena="telefon" valor={establiment.telefon} /> : null}
                  {ambCorreu ? <BotonsContacte mena="correu" valor={establiment.correu} /> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
