/**
 * El que es marca al costat del nom d'un client a les llistes: una «A» si té
 * atributs i una «!» si té To-Do pendents. Cadascuna obre un modal.
 */
export type MarquesClient = { id: string; atributs: boolean; deures: boolean };

/** Les marques d'un client, o res si no en té cap: així les llistes només les porten quan cal. */
export function marquesDe(
  id: string | null | undefined,
  { atributs, deures }: { atributs: Set<string>; deures: Set<string> },
): MarquesClient | undefined {
  if (!id) return undefined;
  const marques = { id, atributs: atributs.has(id), deures: deures.has(id) };
  return marques.atributs || marques.deures ? marques : undefined;
}
