import Link from "next/link";

import { FotoArticle } from "@/components/FotoArticle";
import { FITXES, esVisiblePer } from "@/domini/crm-fitxes";
import { dataCurta } from "@/lib/format";
import type { ActivitatDelTast, ViTastat } from "@/serveis/crm-vins";

/**
 * Els vins que ha tastat un client o un lead, a la seva fitxa: del més recent
 * al més antic, amb quantes vegades i a quines activitats. Cada activitat porta
 * a la seva fitxa si és de qui mira (les dels altres comercials es veuen, però
 * no s'obren). A la fitxa d'un client, les de quan encara era lead ho diuen.
 * Una llista i no una taula: al telèfon cada vi s'apila sense haver de rascar
 * de costat.
 */
export function VinsTastatsClient({
  vins,
  comercial,
  enllacActivitat,
  qui = "client",
}: {
  vins: ViTastat[];
  /** Qui mira: decideix quines activitats s'obren. */
  comercial: string | null;
  enllacActivitat: (activitat: ActivitatDelTast) => string;
  /** De qui és la fitxa. */
  qui?: "client" | "lead";
}) {
  if (vins.length === 0) {
    return <p className="text-[13px] text-muted">Aquest {qui} encara no ha tastat cap vi: s&apos;hi apunten des de les activitats.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted">
        {vins.length} {vins.length === 1 ? "vi tastat" : "vins tastats"}
      </p>
      <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white/60">
        {vins.map((vi) => (
          <li key={vi.id} className="flex items-start gap-3 px-3 py-2.5">
            <FotoArticle petita={vi.foto} gran={null} nom={vi.nom} className="size-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] text-ink [overflow-wrap:anywhere]">{vi.nom}</p>
              {vi.detall ? <p className="text-[12px] text-muted [overflow-wrap:anywhere]">{vi.detall}</p> : null}
              <p className="mt-1 text-[12px] text-muted">
                {vi.vegades === 1 ? "Tastat una vegada" : `Tastat ${vi.vegades} vegades`}
                {vi.darrera ? `, la darrera el ${dataCurta(vi.darrera)}` : ""}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {vi.activitats.map((activitat) => {
                  const text = [
                    dataCurta(activitat.data ?? undefined) || "Sense data",
                    activitat.assumpte?.trim(),
                    qui === "client" && activitat.delLead ? "quan era lead" : null,
                  ].filter(Boolean).join(" · ");
                  const classe = "rounded bg-parchment px-1.5 py-px text-[11px]";
                  return (
                    <li key={activitat.id}>
                      {esVisiblePer(FITXES.activitats, { comercial: activitat.comercial }, comercial) ? (
                        <Link href={enllacActivitat(activitat)} replace scroll={false} className={`${classe} text-wine transition hover:bg-wine-tint`}>
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
