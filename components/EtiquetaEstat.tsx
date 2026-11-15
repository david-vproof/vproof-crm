import { Etiqueta } from "@/components/UI";

const TONS: Record<string, "neutre" | "marca" | "verd"> = {
  servida: "verd",
  cobrada: "verd",
  actiu: "verd",
  Guanyada: "verd",
  pendent: "neutre",
  preparació: "neutre",
  inactiu: "neutre",
  "anul·lada": "marca",
  vençuda: "marca",
  Perduda: "marca",
};

/** Etiqueta d'estat amb el to ja triat segons el valor. */
export function EtiquetaEstat({ estat }: { estat: string }) {
  return <Etiqueta to={TONS[estat] ?? "neutre"}>{estat.charAt(0).toUpperCase() + estat.slice(1)}</Etiqueta>;
}
