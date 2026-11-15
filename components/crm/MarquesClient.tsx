import { BotoAtributs } from "@/components/crm/Atributs";
import { BotoDeures } from "@/components/crm/BotoDeures";
import type { MarquesClient as Marques } from "@/domini/marques-client";

/**
 * Les marques del costat del nom d'un client a les llistes: la «!» si té To-Do
 * pendents, que és el que més crida, i la «A» si té atributs. Cadascuna obre el
 * seu modal. Van sempre fora de l'enllaç de la fila.
 */
export function MarquesClient({ marques, nom, mida = "petita" }: { marques?: Marques | null; nom: string; mida?: "petita" | "gran" }) {
  if (!marques) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {marques.deures ? <BotoDeures client={marques.id} nom={nom} mida={mida} /> : null}
      {marques.atributs ? <BotoAtributs client={marques.id} nom={nom} mida={mida} /> : null}
    </span>
  );
}
