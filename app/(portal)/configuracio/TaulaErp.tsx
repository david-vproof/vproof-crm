import Link from "next/link";

import { Etiqueta } from "@/components/UI";
import { etiquetaEstatClient } from "@/domini/factusol-vocabulari";
import type { SituacioErp } from "@/domini/sincronitzacio";

/**
 * Les peces que comparteixen les taules en cru de FactuSol (clients i
 * proveïdors): capçaleres, cel·les, paginació i les dues etiquetes d'estat.
 * Cada taula només hi posa les seves columnes.
 */

/** Què li passarà a la fitxa a la propera passada. */
export function Situacio({ valor }: { valor?: SituacioErp }) {
  if (valor === "igual") return <Etiqueta to="verd">Al dia</Etiqueta>;
  if (valor === "canviat") return <Etiqueta to="vi">Canviat</Etiqueta>;
  if (valor === "nou") return <Etiqueta>Nou</Etiqueta>;
  return null;
}

/** ESTCLI amb el nom del desplegable de FactuSol. */
export function EstatClientFactusol({ codi }: { codi: number }) {
  const to = codi === 1 ? "verd" : codi === 3 ? "vi" : "neutre";
  return <Etiqueta to={to}>{etiquetaEstatClient(codi)}</Etiqueta>;
}

/**
 * ESTPRO: FactuSol hi desa més codis dels dos documentats (arriba a 3). Els
 * que no se saben es mostren en cru, no com a «actiu».
 */
export function EstatFactusol({ codi }: { codi: number }) {
  if (codi === 0) return <Etiqueta to="verd">Actiu</Etiqueta>;
  if (codi === 1) return <Etiqueta to="vi">Bloquejat</Etiqueta>;
  return <Etiqueta>Estat {codi}</Etiqueta>;
}

/** Les columnes «amples» només surten quan hi ha lloc de sobres. */
export function Th({ children, ampla, dreta }: { children: React.ReactNode; ampla?: boolean; dreta?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted ${
        ampla ? "hidden xl:table-cell" : ""
      } ${dreta ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  ampla,
  dreta,
  className = "",
}: {
  children: React.ReactNode;
  ampla?: boolean;
  dreta?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-3 py-[9px] align-middle ${ampla ? "hidden xl:table-cell" : ""} ${dreta ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}

export function PaginacioErp({
  pagina,
  pagines,
  enllacPagina,
}: {
  pagina: number;
  pagines: number;
  enllacPagina: (p: number) => string;
}) {
  if (pagines <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between text-[13.5px]" aria-label="Paginació">
      <span className="text-muted">
        Pàgina {pagina} de {pagines}
      </span>
      <span className="flex gap-2">
        <PasPagina href={enllacPagina(pagina - 1)} actiu={pagina > 1}>Anterior</PasPagina>
        <PasPagina href={enllacPagina(pagina + 1)} actiu={pagina < pagines}>Següent</PasPagina>
      </span>
    </nav>
  );
}

function PasPagina({ href, actiu, children }: { href: string; actiu: boolean; children: React.ReactNode }) {
  if (!actiu) {
    return <span className="rounded-lg border border-line px-3 py-1.5 text-muted/40">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-lg border border-line bg-white px-3 py-1.5 transition hover:border-ink">
      {children}
    </Link>
  );
}
