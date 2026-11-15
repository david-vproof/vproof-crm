import type { ReactNode } from "react";

export function Capcalera({
  titol,
  descripcio,
  accions,
}: {
  titol: string;
  descripcio?: ReactNode;
  accions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <h1 className="font-display text-[34px] leading-none tracking-[-0.01em]">{titol}</h1>
        {descripcio ? <p className="mt-2 text-[14px] text-muted">{descripcio}</p> : null}
      </div>
      {accions}
    </div>
  );
}

export function Etiqueta({
  children,
  to = "neutre",
}: {
  children: ReactNode;
  to?: "neutre" | "marca" | "verd" | "ambre" | "blau";
}) {
  const tons = {
    neutre: "bg-parchment text-muted",
    marca: "bg-marca-clar text-marca-fosc",
    verd: "bg-emerald-50 text-emerald-700",
    // Ha acabat, però no del tot bé: alguna fila s'ha quedat sense copiar.
    ambre: "bg-amber-50 text-amber-800",
    // En marxa.
    blau: "bg-sky-50 text-sky-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${tons[to]}`}>
      {children}
    </span>
  );
}

export function Plafo({ titol, children }: { titol: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{titol}</h2>
      <dl className="mt-4 space-y-3">{children}</dl>
    </section>
  );
}

/** Com `Plafo`, però per a contingut lliure (llistes, formularis) i no per a parelles etiqueta/valor. */
export function Seccio({ titol, accions, children }: { titol: ReactNode; accions?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{titol}</h2>
        {accions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Fila etiqueta/valor. S'omet del tot si no hi ha cap valor a mostrar. */
export function Dada({ etiqueta, valor }: { etiqueta: string; valor?: ReactNode }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 text-[14px]">
      <dt className="text-muted">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-ink">{valor}</dd>
    </div>
  );
}

export function EstatBuit({ titol, text }: { titol: string; text: string }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <p className="font-display text-[22px]">{titol}</p>
      <p className="mt-1.5 max-w-[42ch] text-[14px] text-muted">{text}</p>
    </div>
  );
}
