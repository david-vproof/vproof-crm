/**
 * La marca del portal: vproof CRM. L'emblema és una creu sanitària dins d'un
 * escut arrodonit, en un quadrat de 24; el fan servir també les icones de l'app.
 */
export const CREU = {
  /** L'escut, ple. */
  escut: "M12 2.2 4 5.2v6.1c0 4.9 3.4 9.1 8 10.5 4.6-1.4 8-5.6 8-10.5V5.2l-8-3Z",
  /** La creu, buidada sobre l'escut. */
  creu: "M10.4 7.5h3.2v3h3v3.2h-3v3h-3.2v-3h-3v-3.2h3v-3Z",
};

/** L'emblema sol, en el color del text. La creu queda del color del fons. */
export function Emblema({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d={CREU.escut} fill="currentColor" />
      <path d={CREU.creu} fill="var(--color-cream)" />
    </svg>
  );
}

/**
 * La marca. En fons clar (login, capçalera del mòbil) va en tinta fosca; en
 * fons fosc (barra lateral) va en crema. Compacta, només l'emblema: és el que
 * cap a la barra plegada.
 */
export function Marca({
  clar = false,
  compacta = false,
}: {
  clar?: boolean;
  /** Només l'emblema, per a la barra plegada. */
  compacta?: boolean;
}) {
  const color = clar ? "text-cream" : "text-ink";

  if (compacta) {
    return (
      <span title="vproof CRM" className={`block size-9 shrink-0 ${clar ? "text-cream" : "text-marca"}`}>
        <svg viewBox="0 0 24 24" role="img" aria-label="vproof CRM" className="size-full">
          <path d={CREU.escut} fill="currentColor" />
          <path d={CREU.creu} fill={clar ? "var(--color-marca-fosc)" : "var(--color-cream)"} />
        </svg>
      </span>
    );
  }

  return (
    <span className={`flex min-w-0 shrink items-center gap-2 ${color}`} aria-label="vproof CRM" role="img">
      <svg viewBox="0 0 24 24" aria-hidden className={`size-[26px] shrink-0 ${clar ? "text-cream" : "text-marca"}`}>
        <path d={CREU.escut} fill="currentColor" />
        <path d={CREU.creu} fill={clar ? "var(--color-marca-fosc)" : "var(--color-cream)"} />
      </svg>
      <span className="truncate text-[21px] leading-none tracking-[-0.02em]">
        <span className="font-semibold">vproof</span> <span className="font-light opacity-80">CRM</span>
      </span>
    </span>
  );
}
