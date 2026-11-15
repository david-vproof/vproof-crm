/**
 * La connexió amb l'ERP, vprooferp (un ERPNext): si està configurada i com ha
 * anat la darrera sincronització. La sincronització mateixa és a
 * `serveis/erp-sincro.ts`.
 */
import "server-only";

import { configErp } from "@/apis/vprooferp";

export type EstatErp = { connectat: boolean; url: string | null; minuts: number; missatge: string };

/** Cada quants minuts es sincronitza sol (VPROOFERP_SINCRO_MINUTS, per defecte 30; 0 l'atura). */
export function minutsEntreSincros() {
  const minuts = Number(process.env.VPROOFERP_SINCRO_MINUTS ?? 30);
  return Number.isFinite(minuts) && minuts >= 0 ? minuts : 30;
}

export function estatErp(): EstatErp {
  const config = configErp();
  const minuts = minutsEntreSincros();
  if (!config) {
    return {
      connectat: false,
      url: process.env.VPROOFERP_URL?.trim() || null,
      minuts,
      missatge:
        "El CRM no té connexió amb vprooferp: falten VPROOFERP_URL, VPROOFERP_API_KEY i VPROOFERP_API_SECRET a l'entorn del servei. El desplegament a la VM de l'ERP les posa soles.",
    };
  }
  return {
    connectat: true,
    url: config.url.toString(),
    minuts,
    missatge:
      `El CRM llegeix vprooferp (${config.host ?? config.url.host})` +
      (minuts > 0 ? ` i se sincronitza sol cada ${minuts} minuts.` : ". La sincronització automàtica està aturada."),
  };
}
