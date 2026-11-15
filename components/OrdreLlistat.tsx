import Link from "next/link";

import type { Ordre } from "@/domini/ordre-llistat";

/**
 * Una capçalera de columna que ordena: ascendent, descendent i després res,
 * com a les taules del CRM. El triangle diu per on va l'ordre; a les columnes
 * sense ordre hi és molt fluix, perquè es vegi que s'hi pot clicar.
 */
export function EnllacOrdre({
  camp,
  etiqueta,
  ordre,
  enllac,
  className = "",
}: {
  camp: string;
  etiqueta: string;
  ordre: Ordre | null;
  /** L'adreça que ordena per aquesta columna (el pas següent del cicle). */
  enllac: string;
  className?: string;
}) {
  const activa = ordre?.camp === camp;
  return (
    <Link
      href={enllac}
      aria-sort={activa ? (ordre?.descendent ? "descending" : "ascending") : undefined}
      title={`${etiqueta}: ${activa ? (ordre?.descendent ? "treu l'ordre" : "ordena descendent") : "ordena ascendent"}`}
      className={`inline-flex items-center gap-1 underline-offset-2 transition hover:text-ink hover:underline ${activa ? "text-ink" : ""} ${className}`}
    >
      {etiqueta}
      <span className={`text-[9px] ${activa ? "text-marca" : "text-line"}`} aria-hidden>
        {activa && ordre?.descendent ? "▼" : "▲"}
      </span>
    </Link>
  );
}
