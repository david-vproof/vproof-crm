import { Etiqueta } from "@/components/UI";
import { type EstatExecucio, NOM_ESTAT_EXECUCIO } from "@/domini/sincronitzacio";

const TO: Record<EstatExecucio, "neutre" | "vi" | "verd" | "ambre" | "blau"> = {
  en_curs: "blau",
  correcte: "verd",
  parcial: "ambre",
  error: "vi",
};

/** L'estat d'una passada, en etiqueta. Val tant al servidor com al navegador. */
export function EtiquetaEstatExecucio({ estat }: { estat: EstatExecucio }) {
  return <Etiqueta to={TO[estat]}>{NOM_ESTAT_EXECUCIO[estat]}</Etiqueta>;
}
