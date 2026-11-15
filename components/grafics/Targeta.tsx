import type { ReactNode } from "react";

/** Targeta contenidora d'un gràfic, amb títol i peu opcional. */
export function TargetaGrafic({
  titol,
  subtitol,
  ample = false,
  children,
}: {
  titol: string;
  subtitol?: string;
  ample?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`card p-5 ${ample ? "xl:col-span-2" : ""}`}>
      <header className="mb-4">
        <h2 className="text-[14.5px] font-medium">{titol}</h2>
        {subtitol ? <p className="mt-0.5 text-[12.5px] text-muted">{subtitol}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Indicador numèric destacat. */
export function Kpi({
  etiqueta,
  valor,
  detall,
  variacio,
}: {
  etiqueta: string;
  valor: string;
  detall?: string;
  variacio?: number | null;
}) {
  const puja = typeof variacio === "number" && variacio >= 0;

  return (
    <div className="card p-4">
      <p className="text-[11.5px] uppercase tracking-[0.1em] text-muted">{etiqueta}</p>
      {/* Xifres en Inter i tabulars: la serif dels títols, a aquesta mida, es llegeix com a negreta. */}
      <p className="mt-2 text-[26px] font-medium leading-none tracking-[-0.02em] tabular-nums">{valor}</p>
      <div className="mt-2 flex items-center gap-2 text-[12.5px]">
        {typeof variacio === "number" ? (
          <span className={`tabular-nums ${puja ? "text-emerald-700" : "text-wine"}`}>
            {puja ? "↑" : "↓"} {Math.abs(variacio).toFixed(1).replace(".", ",")} %
          </span>
        ) : null}
        {detall ? <span className="text-muted">{detall}</span> : null}
      </div>
    </div>
  );
}
