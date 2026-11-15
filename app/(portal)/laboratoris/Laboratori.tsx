import { Etiqueta } from "@/components/UI";
import { FITXES } from "@/domini/crm-fitxes";

/** L'etiqueta d'una opció de la fitxa de laboratoris: «Actiu», «Laboratori o proveïdor». */
function etiquetaDe(camp: string, valor: string | null) {
  if (!valor) return "";
  const opcions = FITXES.proveidors.camps.find((c) => c.nom === camp)?.opcions ?? [];
  return opcions.find(([v]) => v === valor)?.[1] ?? valor;
}

/** L'estat del laboratori, amb el mateix to que l'estat d'un client. */
export function EstatLaboratori({ estat }: { estat: string | null }) {
  if (!estat) return null;
  const to = estat === "actiu" ? "verd" : estat === "baixa" ? "marca" : "neutre";
  return <Etiqueta to={to}>{etiquetaDe("estat", estat)}</Etiqueta>;
}

export function tipusLaboratori(tipus: string | null) {
  return etiquetaDe("tipus", tipus);
}

/** El codi de l'ERP: si és un número, a quatre xifres; si no, tal com és. Sense codi, una ratlla. */
export function codiLaboratori(codi: string | number | null) {
  if (codi === null || codi === undefined || String(codi).trim() === "") return "—";
  return /^\d+$/.test(String(codi)) ? String(codi).padStart(4, "0") : String(codi);
}
