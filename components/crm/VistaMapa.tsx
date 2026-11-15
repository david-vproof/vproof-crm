import Link from "next/link";

import { MapaComptes } from "@/components/crm/MapaComptes";
import { BotoReprenUbicacio, UbicacioAutomatica } from "@/components/crm/UbicacioAutomatica";
import { EstatBuit } from "@/components/UI";
import { opcionsDeTipus } from "@/domini/crm-tipus-activitat";
import { rutaDelClient } from "@/lib/navegacio";
import { comptesDelMapa } from "@/serveis/crm-mapa";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

/**
 * On és cada compte, pintat pel segment on encaixa: un punt per establiment, o
 * l'adreça del client si no en té cap.
 *
 * El mapa s'estira a tot l'espai que queda: el que va al voltant és una fila de
 * pastilles a dalt i, si cal, una línia desplegable a baix amb el que falta per
 * ubicar. Tota la resta és mapa.
 */
export async function VistaMapa({ segmentInicial = "" }: { segmentInicial?: string }) {
  let dades;
  let definicions;
  try {
    [dades, definicions] = await Promise.all([comptesDelMapa(), tipusActivitat()]);
  } catch (error) {
    return (
      <div className="p-5">
        <EstatBuit titol="No s'ha pogut llegir el CRM" text={(error as Error).message} />
      </div>
    );
  }

  const { punts, segments, pendents, total, situats, perProvar } = dades;
  const senseAdreca = pendents.filter((compte) => !compte.ubicable);
  const provatsSenseSort = pendents.filter((compte) => compte.ubicable && compte.provat);
  const aRepassar = [...provatsSenseSort, ...senseAdreca];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-4 py-3 sm:px-5">
      {/* En obrir el mapa, els que no tenen coordenades es van ubicant sols. */}
      <UbicacioAutomatica perProvar={perProvar} />

      {punts.length === 0 ? (
        <EstatBuit
          titol={perProvar > 0 ? "Situant els clients al mapa" : "Encara no hi ha cap client al mapa"}
          text={
            perProvar > 0
              ? "S'estan calculant les coordenades de les adreces. Els punts aniran apareixent sols."
              : "Posa la població o l'adreça als clients i tornaran a sortir aquí."
          }
        />
      ) : (
        <div className="min-h-0 flex-1">
          <MapaComptes punts={punts} segments={segments} inicial={segmentInicial} opcionsTipus={opcionsDeTipus(definicions)} />
        </div>
      )}

      {/* A baix, plegat: el mapa és el que ha de tenir l'espai. */}
      {aRepassar.length > 0 ? (
        <details className="group shrink-0 rounded-lg border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-[12.5px] text-muted transition hover:text-ink">
            <span className="text-[10px] leading-none transition-transform group-open:rotate-90">▶</span>
            <span>
              {situats} de {total} clients al mapa ·{" "}
              <span className="font-medium text-ink">{aRepassar.length} per repassar</span>
            </span>
          </summary>

          <div className="border-t border-line px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
              <span>
                {provatsSenseSort.length > 0
                  ? "OpenStreetMap no ha trobat aquestes adreces. Repassa la població i el país a la fitxa (els establiments, a l'ERP), o posa les coordenades del client a mà."
                  : "Aquests clients no tenen ni població ni adreça, així que no es poden situar."}
              </span>
              {provatsSenseSort.length > 0 ? <BotoReprenUbicacio etiqueta={`Torna a provar els ${provatsSenseSort.length}`} /> : null}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {aRepassar.map((compte) => (
                <li key={compte.id}>
                  <Link
                    href={rutaDelClient(compte.clientId, compte.establiment ? { t: "establiments" } : {})}
                    scroll={false}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-parchment px-2 py-1 text-[12.5px] text-ink-soft transition hover:bg-parchment/60"
                  >
                    {compte.nom}
                    <span className="text-muted">{compte.poblacio || "sense població"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  );
}
