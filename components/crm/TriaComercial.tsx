"use client";

import { useRouter } from "next/navigation";

export type OpcioAgenda = { valor: string; etiqueta: string };

/**
 * De qui és l'agenda que es mira al Planner: la pròpia, la de tothom o la
 * d'un comercial concret. Canviar-ho navega, com les pestanyes: així la tria
 * queda a l'adreça i es conserva en obrir una fitxa i tornar.
 */
export function TriaComercial({
  valor,
  opcions,
  base,
  etiqueta = "Agenda de",
}: {
  valor: string;
  opcions: OpcioAgenda[];
  base: string;
  /** El que diu el rètol: «Agenda de», «To-Do de». */
  etiqueta?: string;
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      <span className="hidden sm:inline">{etiqueta}</span>
      <select
        value={valor}
        aria-label={etiqueta}
        onChange={(e) => router.push(e.target.value ? `${base}&c=${encodeURIComponent(e.target.value)}` : base)}
        className="field-compacte w-auto max-w-[200px] text-ink"
      >
        {opcions.map((opcio) => (
          <option key={opcio.valor} value={opcio.valor}>
            {opcio.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
