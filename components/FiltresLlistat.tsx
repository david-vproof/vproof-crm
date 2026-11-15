import Link from "next/link";

import { ICONES } from "@/components/Icones";

/** Cercador i filtres d'estat, compartits pels llistats de documents. */
export function CercadorLlistat({
  accio,
  valor,
  marcador,
  ocults = {},
}: {
  accio: string;
  valor: string;
  marcador: string;
  ocults?: Record<string, string>;
}) {
  const Cerca = ICONES.cerca;

  return (
    <form action={accio} className="relative w-full sm:w-auto">
      {Object.entries(ocults).map(([nom, contingut]) =>
        contingut ? <input key={nom} type="hidden" name={nom} value={contingut} /> : null,
      )}
      <Cerca className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        defaultValue={valor}
        placeholder={marcador}
        aria-label={marcador}
        className="field !py-2 pl-9 sm:w-[300px]"
      />
    </form>
  );
}

export function FiltresEstat({
  opcions,
  actiu,
  enllac,
}: {
  opcions: { valor: string; etiqueta: string; total: number }[];
  actiu: string;
  enllac: (valor: string) => string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-1.5">
      {opcions.map((opcio) => (
        <Link
          key={opcio.valor}
          href={enllac(opcio.valor)}
          className={`rounded-full px-3 py-1.5 text-[12.5px] transition ${
            actiu === opcio.valor
              ? "bg-ink text-cream"
              : "border border-line bg-white text-muted hover:border-ink hover:text-ink"
          }`}
        >
          {opcio.etiqueta} ({opcio.total})
        </Link>
      ))}
    </div>
  );
}
