import { CREU, Marca } from "@/components/Marca";

import { FormulariLogin } from "./FormulariLogin";

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ des?: string }> }) {
  const { des = "" } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Columna esquerra: accés */}
      <div className="flex flex-col justify-between px-6 py-10 sm:px-12 lg:px-16">
        <Marca />

        <div className="mx-auto w-full max-w-[360px] py-16">
          <h1 className="font-display text-[40px] leading-[1.1] tracking-[-0.01em]">Benvingut de nou</h1>
          <p className="mt-2 text-[15px] text-muted">Accedeix al portal de gestió comercial de producte sanitari veterinari.</p>

          <FormulariLogin des={des} ambCorreu />

        </div>

        <p className="text-[12px] text-muted">© {new Date().getFullYear()} vproof CRM · Portal de gestió comercial</p>
      </div>

      {/* Columna dreta: el color de la marca, amb l'emblema en gran com a filigrana */}
      <div className="relative hidden overflow-hidden bg-marca-fosc lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.14),transparent_55%),radial-gradient(circle_at_85%_80%,rgba(13,148,136,0.55),transparent_60%)]" />
        <svg viewBox="0 0 24 24" aria-hidden className="absolute -right-24 top-1/2 size-[640px] -translate-y-1/2 text-cream/[0.07]">
          <path d={CREU.escut} fill="currentColor" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-[26ch] font-display text-[32px] leading-[1.2] text-cream">
            La relació amb les clíniques i les explotacions, en un sol lloc.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <span className="h-px w-10 bg-cream/40" />
            <span className="text-[11px] tracking-[0.18em] uppercase text-cream/60">by Techrinnovations</span>
          </div>
        </div>
      </div>
    </main>
  );
}
