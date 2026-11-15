import { Etiqueta } from "@/components/UI";

const TONS: Record<string, "neutre" | "vi" | "verd"> = {
  servida: "verd",
  cobrada: "verd",
  actiu: "verd",
  Guanyada: "verd",
  pendent: "neutre",
  preparació: "neutre",
  inactiu: "neutre",
  "anul·lada": "vi",
  vençuda: "vi",
  Perduda: "vi",
};

/** Etiqueta d'estat amb el to ja triat segons el valor. */
export function EtiquetaEstat({ estat }: { estat: string }) {
  return <Etiqueta to={TONS[estat] ?? "neutre"}>{estat.charAt(0).toUpperCase() + estat.slice(1)}</Etiqueta>;
}
