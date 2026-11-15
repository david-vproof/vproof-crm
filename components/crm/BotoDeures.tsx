"use client";

import { BotoModal, useDemanda } from "@/components/crm/BotoModal";
import type { Deure } from "@/domini/crm-deures";
import { rutaDelClient } from "@/lib/navegacio";

/** «12/10», per dir quan venç un To-Do. */
function venc(dia: string) {
  const trossos = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  return trossos ? `${Number(trossos[3])}/${Number(trossos[2])}` : "";
}

/** Els To-Do pendents d'un client, demanats en obrir el modal. Es marquen a la pestanya de la fitxa. */
function DeuresDelModal({ client }: { client: string }) {
  const dades = useDemanda<{ deures: Deure[] }>(`/api/crm/deures?${new URLSearchParams({ client })}`);
  if (!dades) return <p className="text-[13px] text-muted">Un moment…</p>;
  if (dades.error) return <p className="text-[13px] text-marca">{dades.error}</p>;
  const deures = dades.valor?.deures ?? [];
  if (deures.length === 0) return <p className="text-[13px] text-muted">Aquest client ja no té cap To-Do pendent.</p>;
  return (
    <ul className="divide-y divide-line/60">
      {deures.map((deure) => (
        <li key={deure.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
          <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-amber-500" />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-[13.5px] leading-snug text-ink">{deure.text}</span>
            <span className="mt-0.5 block break-words text-[11.5px] text-muted">
              {deure.origen}
              {deure.venciment ? ` · venç el ${venc(deure.venciment)}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** La «!» del costat del nom d'un client que té To-Do pendents, a les llistes. */
export function BotoDeures({ client, nom, mida = "petita" }: { client: string; nom: string; mida?: "petita" | "gran" }) {
  return (
    <BotoModal
      marca="!"
      etiqueta={`To-Do pendents de ${nom}`}
      apartat="To-Do pendents"
      nom={nom}
      to="bg-amber-100 text-amber-800 hover:bg-amber-500 hover:text-white"
      mida={mida}
      enllac={{ href: rutaDelClient(client), text: "Obre la fitxa del client" }}
    >
      <DeuresDelModal client={client} />
    </BotoModal>
  );
}
