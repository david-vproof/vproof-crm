import { PERIODICITATS, type Seguiment } from "@/domini/crm-periodicitat";

const DECIMAL = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 1 });

/** El to de cada estat: l'etiqueta i la barra van del mateix color, com a la facturació. */
const TO: Record<string, { etiqueta: string; barra: string }> = {
  complert: { etiqueta: "bg-emerald-100 text-emerald-800", barra: "bg-emerald-600" },
  al_dia: { etiqueta: "bg-emerald-50 text-emerald-700", barra: "bg-emerald-600" },
  a_prop: { etiqueta: "bg-amber-50 text-amber-700", barra: "bg-amber-500" },
  endarrerit: { etiqueta: "bg-wine-tint text-wine-deep", barra: "bg-wine" },
};

function llegeix(dades: Record<string, unknown> | undefined): Seguiment | null {
  if (!dades || typeof dades.objectiu !== "number" || typeof dades.fetes !== "number") return null;
  return dades as Seguiment;
}

/**
 * «✓ Complert», «▲ +1» si se n'han fet més de les que tocaven, «≈ Al dia», o
 * «▼ −2» amb les que falten per posar-s'hi.
 */
function textEtiqueta({ estat, fetes, esperades, falten }: Seguiment) {
  if (estat === "complert") return "✓ Complert";
  if (falten > 0) return `▼ −${falten}`;
  const avancades = fetes - Math.ceil(esperades);
  return avancades > 0 ? `▲ +${avancades}` : "≈ Al dia";
}

/**
 * Com va un client respecte de la seva periodicitat, en una fila de llista:
 * una barra amb les fetes sobre l'objectiu de l'any i una marca on s'hauria de
 * ser avui, el recompte i una etiqueta amb la tendència. El detall surt en
 * passar-hi per sobre.
 */
export function MiniSeguiment({
  dades,
  text = "—",
  compacte = false,
}: {
  dades: Record<string, unknown> | undefined;
  /** El que es mostra si no hi ha seguiment: el nom de la periodicitat. */
  text?: string;
  compacte?: boolean;
}) {
  const seguiment = llegeix(dades);
  if (!seguiment) return <span className="text-muted">{text}</span>;

  const { objectiu, fetes, esperades } = seguiment;
  const to = TO[seguiment.estat] ?? TO.al_dia;
  const nom = PERIODICITATS.find(([valor]) => Number(valor) === objectiu)?.[1].split(" (")[0] ?? `${objectiu} l'any`;
  const detall =
    `${nom}: ${objectiu} ${objectiu === 1 ? "activitat" : "activitats"} l'any. ` +
    `Enguany ${fetes === 1 ? "se n'ha fet 1" : `se n'han fet ${fetes}`}; a dia d'avui en tocaven ${DECIMAL.format(esperades)}.`;

  return (
    <span className="inline-flex max-w-full items-center gap-2" title={detall}>
      <span className="sr-only">{detall}</span>
      {compacte ? null : (
        // Només a pantalla ampla: a la tauleta la taula ja va justa d'amplada.
        <span aria-hidden className="relative hidden h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-line/70 xl:block">
          <span className={`absolute inset-y-0 left-0 rounded-full ${to.barra}`} style={{ width: `${Math.min(100, (fetes / objectiu) * 100)}%` }} />
          <span className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${Math.min(97, (esperades / objectiu) * 100)}%` }} />
        </span>
      )}
      <span aria-hidden className="shrink-0 tabular-nums text-ink-soft">
        {fetes}/{objectiu}
      </span>
      <span aria-hidden className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${to.etiqueta}`}>
        {textEtiqueta(seguiment)}
      </span>
    </span>
  );
}
