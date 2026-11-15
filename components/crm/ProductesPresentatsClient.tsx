import Link from "next/link";

import { FotoArticle } from "@/components/FotoArticle";
import { FITXES, esVisiblePer } from "@/domini/crm-fitxes";
import { dataCurta } from "@/lib/format";
import type { ActivitatDelPresentacio, ProductePresentat } from "@/serveis/crm-productes";

/**
 * Els productes que ha presentat un client o un lead, a la seva fitxa: del més recent
 * al més antic, amb quantes vegades i a quines activitats. Cada activitat porta
 * a la seva fitxa si és de qui mira (les dels altres comercials es veuen, però
 * no s'obren). A la fitxa d'un client, les de quan encara era lead ho diuen.
 * Una llista i no una taula: al telèfon cada producte s'apila sense haver de rascar
 * de costat.
 */
export function ProductesPresentatsClient({
  productes,
  comercial,
  enllacActivitat,
  qui = "client",
}: {
  productes: ProductePresentat[];
  /** Qui mira: decideix quines activitats s'obren. */
  comercial: string | null;
  enllacActivitat: (activitat: ActivitatDelPresentacio) => string;
  /** De qui és la fitxa. */
  qui?: "client" | "lead";
}) {
  if (productes.length === 0) {
    return <p className="text-[13px] text-muted">Aquest {qui} encara no ha presentat cap producte: s&apos;hi apunten des de les activitats.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        {productes.length} {productes.length === 1 ? "producte presentat" : "productes presentats"}
      </p>
      <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white/60">
        {productes.map((producte) => (
          <li key={producte.id} className="flex items-start gap-3 px-3 py-2.5">
            <FotoArticle petita={producte.foto} gran={null} nom={producte.nom} className="size-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-ink [overflow-wrap:anywhere]">{producte.nom}</p>
              {producte.detall ? <p className="text-[12px] text-muted [overflow-wrap:anywhere]">{producte.detall}</p> : null}
              <p className="mt-1 text-[12px] text-muted">
                {producte.vegades === 1 ? "Presentat una vegada" : `Presentat ${producte.vegades} vegades`}
                {producte.darrera ? `, la darrera el ${dataCurta(producte.darrera)}` : ""}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {producte.activitats.map((activitat) => {
                  const text = [
                    dataCurta(activitat.data ?? undefined) || "Sense data",
                    activitat.assumpte?.trim(),
                    qui === "client" && activitat.delLead ? "quan era lead" : null,
                  ].filter(Boolean).join(" · ");
                  const classe = "rounded bg-parchment px-1.5 py-px text-[11px]";
                  return (
                    <li key={activitat.id}>
                      {esVisiblePer(FITXES.activitats, { comercial: activitat.comercial }, comercial) ? (
                        <Link href={enllacActivitat(activitat)} replace scroll={false} className={`${classe} text-marca transition hover:bg-marca-clar`}>
                          {text}
                        </Link>
                      ) : (
                        <span className={`${classe} text-muted`}>{text}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
