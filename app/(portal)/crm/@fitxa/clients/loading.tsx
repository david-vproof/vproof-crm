import { BotoTanca, ID_TITOL_FITXA } from "@/components/crm/CapaFitxa";

/**
 * Mentre arriba la fitxa, la capa ja hi és, amb el «Tanca». Només surt en
 * obrir un client: canviar de secció deixa la que hi ha fins que arriba la nova.
 */
export default function CarregantFitxa() {
  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-line px-4 pb-4 pt-3.5 sm:px-6 sm:pt-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted">Client</p>
          <h2 id={ID_TITOL_FITXA} className="sr-only">
            Obrint la fitxa…
          </h2>
          <div className="mt-1.5 h-7 w-[min(320px,70%)] animate-pulse rounded-md bg-parchment" />
          <div className="mt-2.5 h-4 w-[min(240px,50%)] animate-pulse rounded bg-parchment/70" />
        </div>
        <BotoTanca />
      </header>
      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 border-b border-line px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r lg:px-5">
          <div className="h-4 w-24 animate-pulse rounded bg-parchment" />
          <div className="h-16 animate-pulse rounded-xl bg-parchment/60" />
        </div>
        <div className="space-y-4 px-4 py-5 sm:px-6">
          <div className="h-8 w-[min(420px,90%)] animate-pulse rounded-lg bg-parchment/70" />
          <div className="h-48 animate-pulse rounded-xl bg-parchment/50" />
        </div>
      </div>
    </>
  );
}
