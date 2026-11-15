/**
 * Els establiments dels clients: les adreces d'entrega. Una clínica amb tres
 * centres en té tres. Qui els ensenya és `serveis/establiments.ts` i el mapa.
 */

/** Si un establiment té prou adreça per situar-lo al mapa: com a mínim el carrer o la població. */
export function esUbicable(establiment: { adreca?: string | null; poblacio?: string | null }) {
  return Boolean((establiment.adreca ?? "").trim() || (establiment.poblacio ?? "").trim());
}
