/**
 * Com es diu, a tot el CRM, que una activitat és oberta o tancada.
 *
 * Viu en un sol lloc perquè el Planner, l'agenda d'avui i la fitxa han de dir
 * el mateix amb els mateixos colors: si cada pantalla s'ho pintés a la seva
 * manera, el mateix desenllaç semblaria una cosa diferent segons on es miri.
 */

/** El to de cada desenllaç, amb vora: per als botons del tancament. */
export const TO_RESULTAT: Record<string, string> = {
  Positiu: "border-emerald-300 bg-emerald-50 text-emerald-800",
  Neutre: "border-sky-300 bg-sky-50 text-sky-800",
  Negatiu: "border-marca/40 bg-marca-clar text-marca-fosc",
  "Sense resposta": "border-amber-300 bg-amber-50 text-amber-800",
};

/** El mateix semàfor sense vora, per a les etiquetes dels llistats. */
export const TO_RESULTAT_PLA: Record<string, string> = {
  Positiu: "bg-emerald-50 text-emerald-700",
  Neutre: "bg-sky-50 text-sky-700",
  Negatiu: "bg-marca-clar text-marca-fosc",
  "Sense resposta": "bg-amber-50 text-amber-700",
};

/**
 * El senyal curt, d'un sol caràcter, per al calendari: allà una etiqueta no hi
 * cabria i el que cal és poder-ho llegir d'un cop d'ull sobre tot un mes.
 */
export const SENYAL_TANCADA = "✓";
export const SENYAL_OBERTA = "○";

export function senyalActivitat(tancada: boolean) {
  return tancada ? SENYAL_TANCADA : SENYAL_OBERTA;
}

export function descriuEstat(tancada: boolean, resultat: string, passada = false) {
  if (tancada) return `Tancada · ${resultat}`;
  return passada ? "Oberta, encara per tancar" : "Oberta";
}

/**
 * L'estat d'una activitat com a etiqueta.
 *
 * Es diu sempre, tancada o no: en un calendari el que es vol saber és què
 * queda per fer. Una activitat que ja ha passat i segueix oberta es marca a
 * part, perquè no és el mateix una visita de demà que una d'ahir sense tancar.
 */
export function EstatActivitat({
  tancada,
  resultat,
  passada = false,
  gran = false,
}: {
  tancada: boolean;
  resultat: string;
  /** Si l'hora ja ha passat. */
  passada?: boolean;
  gran?: boolean;
}) {
  const base = `inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px font-medium ${
    gran ? "text-[11.5px]" : "text-[11px]"
  }`;

  if (tancada) {
    return (
      <span className={`${base} ${TO_RESULTAT_PLA[resultat] ?? "bg-parchment text-muted"}`}>
        {SENYAL_TANCADA} {resultat || "Tancada"}
      </span>
    );
  }

  if (passada) {
    return <span className={`${base} bg-amber-50 text-amber-800`}>Per tancar</span>;
  }

  return <span className={`${base} bg-parchment text-muted`}>Oberta</span>;
}
