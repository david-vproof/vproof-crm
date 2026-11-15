import Image from "next/image";

import { Marca } from "@/components/Marca";

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
          <p className="mt-2 text-[15px] text-muted">Accedeix al portal de gestió comercial.</p>

          <FormulariLogin des={des} ambCorreu />

        </div>

        <p className="text-[12px] text-muted">© {new Date().getFullYear()} Wine Backend · Portal de gestió comercial</p>
      </div>

      {/* Columna dreta: fotografia */}
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/vineyard.jpg"
          alt="Vinya al capvespre amb la boira cobrint la vall"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 0px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-[26ch] font-display text-[32px] leading-[1.2] text-cream">
            Wine Backend.
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
