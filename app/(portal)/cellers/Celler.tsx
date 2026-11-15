import { Etiqueta } from "@/components/UI";
import { FITXES } from "@/domini/crm-fitxes";

/** L'etiqueta d'una opció de la fitxa de cellers: «Actiu», «Celler o proveïdor». */
function etiquetaDe(camp: string, valor: string | null) {
  if (!valor) return "";
  const opcions = FITXES.proveidors.camps.find((c) => c.nom === camp)?.opcions ?? [];
  return opcions.find(([v]) => v === valor)?.[1] ?? valor;
}

/** L'estat del celler, amb el mateix to que l'estat d'un client. */
export function EstatCeller({ estat }: { estat: string | null }) {
  if (!estat) return null;
  const to = estat === "actiu" ? "verd" : estat === "baixa" ? "vi" : "neutre";
  return <Etiqueta to={to}>{etiquetaDe("estat", estat)}</Etiqueta>;
}

export function tipusCeller(tipus: string | null) {
  return etiquetaDe("tipus", tipus);
}

/** El codi de FactuSol, a quatre xifres com el dels clients. */
export function codiCeller(codi: number | null) {
  return codi === null || codi === undefined ? "—" : String(codi).padStart(4, "0");
}
