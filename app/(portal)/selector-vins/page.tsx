import { SelectorVinsRecordat } from "@/components/crm/SelectorVinsRecordat";
import { EstatBuit } from "@/components/UI";
import { catalegDeVins } from "@/serveis/crm-vins";

export const metadata = { title: "Selector de vins · Wine Backend" };

/**
 * El selector de vins: una cistella que s'omple del catàleg amb criteris de
 * selecció i que es desa com a plantilla. El catàleg es llegeix aquí, al
 * servidor, i el navegador hi filtra (vegeu `domini/cistella-vins.ts`). El
 * mateix configurador s'obre en modal des del formulari d'una activitat.
 */
export default async function PaginaSelectorVins() {
  let cataleg = null;
  let fallada: string | null = null;
  try {
    cataleg = await catalegDeVins();
  } catch (error) {
    fallada = (error as Error).message;
  }

  return (
    <div className="flex h-full min-h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-4 pb-4 pt-5 sm:px-5 sm:pt-6">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight">Selector de vins</h1>
          <p className="mt-0.5 text-[13.5px] text-muted">Tria vins per criteris, omple la cistella i desa-la com a plantilla.</p>
        </div>
      </div>

      {cataleg ? (
        <div className="min-h-0 flex-1">
          <SelectorVinsRecordat catalegInicial={cataleg} />
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <EstatBuit titol="No s'ha pogut llegir el catàleg" text={fallada ?? ""} />
        </div>
      )}
    </div>
  );
}
