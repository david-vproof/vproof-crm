/**
 * Els establiments dels clients: les direccions d'entrega de FactuSol (F_OBR,
 * que el programa anomena «obras»). A la casa, cada adreça on es porta el vi és
 * un establiment del client: un restaurant amb tres locals en té tres.
 *
 * Aquí hi ha la lògica pura: com es diu cada establiment a Directus i quins
 * camps s'hi copien. Qui llegeix i escriu és `serveis/sincronitzacio.ts`; qui
 * els ensenya, `serveis/establiments.ts` i el mapa.
 */
import { nomDePais, type ValorsErp } from "./sincronitzacio";

/** Una fila de F_OBR. La clau és el client i el número de l'adreça dins seu. */
export type EstablimentErp = {
  CLIOBR: number; // Client (CODCLI)
  CODOBR: number; // Número de l'adreça dins del client: 1, 2, 3…
  NOMOBR: string; // Nom de l'establiment
  DIROBR: string; // Domicili
  POBOBR: string; // Població
  CPOOBR: string; // Codi postal
  PROOBR: string; // Província
  PAIOBR: string; // País (codi ISO numèric)
  TELOBR: string; // Telèfon; a vegades també hi ha l'horari
  PCOOBR: string; // Persona de contacte; a vegades també hi ha l'horari
  EMAOBR: string; // Correu
  /**
   * «Dirección de entrega por defecto para la impresión de partes de
   * reparación» (0/1). A la casa marca les adreces que no són cap punt
   * d'entrega de vi: al mapa no hi surten.
   */
  REPOBR: number;
};

/** Camps de crm_establiments que té l'ERP com a amo, en l'ordre que fa l'empremta. */
export const CAMPS_ERP_ESTABLIMENT = [
  "codi_erp", "client", "erp_client", "erp_codi", "nom", "adreca", "codi_postal", "poblacio", "provincia", "pais",
  "telefon", "persona_contacte", "correu", "per_reparacions",
] as const;

/** «123-2»: el client i el número de l'adreça. És el codi_erp de l'establiment a Directus. */
export function codiEstabliment(client: unknown, codi: unknown) {
  return `${Number(client)}-${Number(codi)}`;
}

function net(valor: unknown) {
  const text = String(valor ?? "").trim();
  return text === "" ? null : text;
}

/**
 * Els camps que rep Directus d'una fila de F_OBR, o null si és d'un client que
 * no surt al CRM (de baixa o que ja no és a l'ERP): aquests no es porten.
 * `clients` va de CODCLI a l'id de la fitxa del client.
 */
export function valorsEstablimentDesDeErp(fila: EstablimentErp, clients: Record<string, string>): ValorsErp | null {
  const codiClient = Number(fila.CLIOBR);
  const client = clients[String(codiClient)];
  if (!client) return null;
  const numero = Number(fila.CODOBR);
  return {
    codi_erp: codiEstabliment(codiClient, numero),
    client,
    erp_client: codiClient,
    erp_codi: numero,
    nom: net(fila.NOMOBR) ?? `Establiment ${numero}`,
    adreca: net(fila.DIROBR),
    codi_postal: net(fila.CPOOBR),
    poblacio: net(fila.POBOBR),
    provincia: net(fila.PROOBR),
    // FactuSol hi posa 0 quan no se n'ha triat cap.
    pais: Number(fila.PAIOBR) === 0 ? null : nomDePais(fila.PAIOBR),
    telefon: net(fila.TELOBR),
    persona_contacte: net(fila.PCOOBR),
    correu: net(fila.EMAOBR)?.toLowerCase() ?? null,
    per_reparacions: Number(fila.REPOBR) === 1,
  };
}

/** Si un establiment té prou adreça per situar-lo al mapa: com a mínim el carrer o la població. */
export function esUbicable(establiment: { adreca?: string | null; poblacio?: string | null }) {
  return Boolean((establiment.adreca ?? "").trim() || (establiment.poblacio ?? "").trim());
}
