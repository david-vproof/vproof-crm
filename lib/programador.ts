/**
 * El rellotge del portal. El Next corre en un procés permanent, així que les
 * tasques periòdiques viuen aquí dins. Ara només n'hi ha una: situar al mapa
 * els clients i establiments que encara no tenen coordenades. Quan l'ERP
 * (vprooferp) hi estigui connectat, la seva importació periòdica anirà aquí.
 *
 * S'arrenca un sol cop per procés des de `instrumentation.ts`.
 */
import { ubicaTotsElsPendents } from "@/serveis/crm-mapa";

/** Cada quant es miren els clients sense coordenades. */
const UBICACIO_CADA_MS = 15 * 60_000;

type AmbProgramador = typeof globalThis & { __programadorPortal?: ReturnType<typeof setInterval> };

let ocupat = false;

export function arrencaProgramador() {
  const global = globalThis as AmbProgramador;
  if (global.__programadorPortal) return;

  global.__programadorPortal = setInterval(() => void ubica(), UBICACIO_CADA_MS);
  // Que el rellotge no impedeixi aturar el procés.
  global.__programadorPortal.unref?.();
  console.log("[programador] en marxa: cada quart d'hora se situen al mapa els clients sense coordenades.");
}

async function ubica() {
  if (ocupat) return;
  ocupat = true;
  try {
    const { ubicats, fallits } = await ubicaTotsElsPendents();
    if (ubicats || fallits) {
      console.log(`[programador] ubicació de clients: ${ubicats} situats, ${fallits} sense trobar.`);
    }
  } catch (error) {
    console.error(`[programador] ubicació de clients aturada: ${(error as Error).message}`);
  } finally {
    ocupat = false;
  }
}
