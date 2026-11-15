import { TRAMS_VISITA, type TramVisita } from "@/domini/crm-visites";

/**
 * El fons d'una fila de client, segons quant fa que no s'hi va: del verd de qui
 * s'ha vist fa poc al granat de qui fa més de nou mesos que no es visita, o no
 * s'ha visitat mai. Molt pàl·lid, perquè el text s'hi llegeixi igual. Les
 * classes van senceres perquè Tailwind les trobi.
 */
export const FONS_VISITA: Record<TramVisita, string> = {
  0: "bg-emerald-50/80",
  1: "bg-amber-50/70",
  2: "bg-orange-100/60",
  3: "bg-wine-tint/45",
};

/** Els mateixos colors, sense transparència, perquè a la mostra de la llegenda es vegin. */
const MOSTRA_VISITA: Record<TramVisita, string> = {
  0: "bg-emerald-100",
  1: "bg-amber-100",
  2: "bg-orange-200",
  3: "bg-wine-tint",
};

/** Què vol dir cada color de fons de la llista de clients. */
export function LlegendaVisites() {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted" aria-label="Color de fons segons la darrera activitat">
      <span className="whitespace-nowrap">Darrera activitat:</span>
      {TRAMS_VISITA.map(({ tram, etiqueta }) => (
        <span key={tram} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden className={`size-2.5 rounded-sm border border-black/10 ${MOSTRA_VISITA[tram]}`} />
          {etiqueta}
        </span>
      ))}
    </span>
  );
}
