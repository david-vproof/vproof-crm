import Link from "next/link";

/** Paginació anterior/següent, compartida per tots els llistats. */
export function Paginacio({
  pagina,
  pagines,
  enllac,
  className = "mt-5",
}: {
  pagina: number;
  pagines: number;
  enllac: (numero: number) => string;
  /** El marge, o el que calgui per encaixar-la al costat d'altres coses. */
  className?: string;
}) {
  if (pagines <= 1) return null;

  return (
    // Si no hi cap, els botons baixen a sota del text: mai no ha de sortir pel costat.
    <nav className={`flex flex-wrap items-center justify-between gap-y-2 text-[13.5px] ${className}`} aria-label="Paginació">
      <span className="whitespace-nowrap text-muted">
        Pàgina {pagina} de {pagines}
      </span>
      <span className="flex gap-2">
        <Pas href={enllac(pagina - 1)} actiu={pagina > 1}>
          Anterior
        </Pas>
        <Pas href={enllac(pagina + 1)} actiu={pagina < pagines}>
          Següent
        </Pas>
      </span>
    </nav>
  );
}

function Pas({ href, actiu, children }: { href: string; actiu: boolean; children: React.ReactNode }) {
  if (!actiu) {
    return <span className="rounded-lg border border-line px-3 py-1.5 text-muted/40">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-lg border border-line bg-white px-3 py-1.5 transition hover:border-ink">
      {children}
    </Link>
  );
}
