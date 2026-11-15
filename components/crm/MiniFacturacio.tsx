import { nomPeriode } from "@/domini/facturacio";
import { TENDENCIES } from "@/domini/facturacio-tendencia";

const EUROS = new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** El to de cada tendència: l'etiqueta i la barra d'enguany van del mateix color. */
const TO: Record<string, { etiqueta: string; barra: string }> = {
  creix: { etiqueta: "bg-emerald-50 text-emerald-700", barra: "bg-emerald-600" },
  estable: { etiqueta: "bg-amber-50 text-amber-700", barra: "bg-amber-500" },
  baixa: { etiqueta: "bg-wine-tint text-wine-deep", barra: "bg-wine" },
  nou: { etiqueta: "bg-sky-50 text-sky-700", barra: "bg-sky-600" },
  perdut: { etiqueta: "bg-parchment text-wine-deep", barra: "bg-wine" },
  sense: { etiqueta: "bg-parchment text-muted", barra: "bg-muted" },
};

/**
 * El fons d'una fila de client, del color de la seva tendència però molt més
 * pàl·lid: la llista es llegeix d'un cop d'ull sense haver d'anar a la columna.
 * Qui no té facturació no porta cap fons.
 */
const FONS_TENDENCIA: Record<string, string> = {
  creix: "bg-emerald-50/80",
  estable: "bg-amber-50/70",
  baixa: "bg-wine-tint/45",
  nou: "bg-sky-50/80",
  perdut: "bg-parchment/70",
  sense: "",
};

export function fonsDeTendencia(dades: Record<string, unknown> | undefined) {
  const tendencia = dades?.facturacio_tendencia;
  return tendencia ? (FONS_TENDENCIA[String(tendencia)] ?? "") : "";
}

const numero = (valor: unknown) => Number(valor ?? 0) || 0;

/** «▲ +18%», «▼ −31%», «≈ +3%», o el nom de la tendència si no hi ha variació a dir. */
function textEtiqueta(tendencia: string, variacio: number | null) {
  if (variacio !== null && (tendencia === "creix" || tendencia === "baixa" || tendencia === "estable")) {
    const signe = variacio > 0 ? "+" : variacio < 0 ? "−" : "";
    const fletxa = tendencia === "creix" ? "▲" : tendencia === "baixa" ? "▼" : "≈";
    return `${fletxa} ${signe}${Math.abs(Math.round(variacio))}%`;
  }
  return tendencia === "sense" ? "Sense" : (TENDENCIES.find(([valor]) => valor === tendencia)?.[1] ?? tendencia);
}

/**
 * La facturació d'un client en una fila de llista: tres barres del mateix
 * període —gener fins al mes passat— de fa dos anys, de l'any passat i
 * d'enguany; l'acumulat d'enguany, i una etiqueta de tendència. Les xifres
 * exactes, amb els anys sencers, surten en passar-hi per sobre.
 */
export function MiniFacturacio({ dades, compacte = false }: { dades: Record<string, unknown>; compacte?: boolean }) {
  const tendencia = dades.facturacio_tendencia ? String(dades.facturacio_tendencia) : null;
  if (!tendencia) return <span className="text-line">—</span>;

  const exercici = numero(dades.facturacio_exercici);
  const periodes = [numero(dades.facturacio_periode_2), numero(dades.facturacio_periode_1), numero(dades.facturacio_periode)];
  const maxim = Math.max(...periodes, 0);
  const variacio = dades.facturacio_variacio === null || dades.facturacio_variacio === undefined ? null : numero(dades.facturacio_variacio);
  const to = TO[tendencia] ?? TO.sense;
  const periode = nomPeriode(numero(dades.facturacio_fins_mes)) ?? "Enguany";

  const detall =
    `${periode[0].toUpperCase()}${periode.slice(1)}: ` +
    periodes.map((valor, i) => `${exercici - 2 + i} ${EUROS.format(valor)}`).join(", ") +
    `. Exercicis sencers: ${exercici - 2} ${EUROS.format(numero(dades.facturacio_any_2))}, ` +
    `${exercici - 1} ${EUROS.format(numero(dades.facturacio_any_1))}.`;

  return (
    <span className="inline-flex max-w-full items-center gap-2" title={detall}>
      <span className="sr-only">{detall}</span>
      {compacte ? null : (
        <span aria-hidden className="flex h-5 shrink-0 items-end gap-[3px]">
          {periodes.map((valor, i) => (
            <span
              key={i}
              className={`w-[5px] rounded-[1px] ${valor > 0 ? (i === 2 ? to.barra : "bg-ink/25") : "bg-line"}`}
              // Relatives al client: el que es llegeix és la forma, no l'escala.
              style={{ height: valor > 0 && maxim > 0 ? `${Math.max(18, (valor / maxim) * 100)}%` : "2px" }}
            />
          ))}
        </span>
      )}
      {/* Amplada fixa i a la dreta: fila a fila, les xifres i les etiquetes queden en columna. */}
      <span aria-hidden className="min-w-[4.5rem] shrink-0 text-right tabular-nums text-ink-soft">
        {EUROS.format(periodes[2])}
      </span>
      <span aria-hidden className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${to.etiqueta}`}>
        {textEtiqueta(tendencia, variacio)}
      </span>
    </span>
  );
}
