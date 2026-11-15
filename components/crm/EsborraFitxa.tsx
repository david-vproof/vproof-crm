"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { esborraDeLaFitxaAccio, type EstatEsborrat } from "@/app/(portal)/crm/accions";
import type { DespresDeDesar } from "@/components/crm/EdicioFitxa";
import { useTancaFitxa } from "@/components/crm/FonsCrm";
import { FITXES, type ClauFitxa } from "@/domini/crm-fitxes";

/**
 * Esborrar, a la fitxa d'un client: al peu del que s'esborra, en vermell. És
 * l'única acció sense marxa enrere: es demana dues vegades, i la segona al
 * mateix lloc que la primera.
 */
export function EsborraFitxa({
  entitat,
  id,
  nom,
  despres,
}: {
  entitat: ClauFitxa;
  id: string;
  nom: string;
  /** Esborrat el client, la fitxa es tanca; esborrat el que en penja, es torna a la seva pestanya. */
  despres: DespresDeDesar;
}) {
  const [confirmant, setConfirmant] = useState(false);
  const [estat, accio, enviant] = useActionState<EstatEsborrat, FormData>(esborraDeLaFitxaAccio, {});
  const tanca = useTancaFitxa();
  const router = useRouter();
  const jaFet = useRef<EstatEsborrat | null>(null);
  const { singular, article } = FITXES[entitat];
  const que = `${article === "nou" ? "aquest" : "aquesta"} ${singular.toLowerCase()}`;

  useEffect(() => {
    if (!estat.esborrat || jaFet.current === estat) return;
    jaFet.current = estat;
    if (despres.mena === "tanca") tanca();
    else router.replace(despres.href, { scroll: false });
  }, [estat, despres, tanca, router]);

  return (
    <div className="mt-8 border-t border-line pt-4">
      {confirmant ? (
        <form
          action={accio}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-marca/30 bg-marca-clar px-4 py-3"
        >
          <input type="hidden" name="entitat" value={entitat} />
          <input type="hidden" name="id" value={id} />
          <p className="text-[13px] text-marca-fosc">Segur que vols esborrar «{nom}»? No es pot desfer.</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setConfirmant(false)} className="text-[13px] text-muted hover:text-ink">
              Cancel·la
            </button>
            <button
              type="submit"
              disabled={enviant}
              className="rounded-lg bg-marca px-3 py-1.5 text-[13px] font-medium text-cream transition hover:bg-marca-fosc disabled:opacity-60"
            >
              {enviant ? "Esborrant…" : "Sí, esborra"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmant(true)}
          className="inline-flex items-center rounded-lg bg-marca px-3 py-1.5 text-[13px] font-medium text-cream transition hover:bg-marca-fosc"
        >
          Esborra {que}
        </button>
      )}
      {estat.error ? (
        <p role="alert" className="mt-2 text-[12.5px] text-marca">
          {estat.error}
        </p>
      ) : null}
    </div>
  );
}
