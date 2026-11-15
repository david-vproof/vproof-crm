/**
 * El rellotge del portal. El Next corre en un procés permanent, així que les
 * tasques periòdiques viuen aquí dins:
 *
 * - la sincronització amb l'ERP (vprooferp), cada VPROOFERP_SINCRO_MINUTS
 *   minuts (30 per defecte), si la connexió està configurada;
 * - situar al mapa els clients i establiments sense coordenades, cada quart
 *   d'hora i després de cada sincronització.
 *
 * S'arrenca un sol cop per procés des de `instrumentation.ts`.
 */
import { configErp } from "@/apis/vprooferp";
import { ubicaTotsElsPendents } from "@/serveis/crm-mapa";
import { minutsEntreSincros } from "@/serveis/erp";
import { sincronitzaAmbErp } from "@/serveis/erp-sincro";

const CADA_MS = 60_000;
const UBICACIO_CADA_MS = 15 * 60_000;
/** La primera passada, un minut després d'arrencar: que el servei ja respongui. */
const PRIMERA_SINCRO_MS = 60_000;

type AmbProgramador = typeof globalThis & { __programadorPortal?: ReturnType<typeof setInterval> };

let ubicant = false;
let darreraUbicacio = 0;
let properaSincro = Date.now() + PRIMERA_SINCRO_MS;

export function arrencaProgramador() {
  const global = globalThis as AmbProgramador;
  if (global.__programadorPortal) return;

  global.__programadorPortal = setInterval(() => void tic(), CADA_MS);
  // Que el rellotge no impedeixi aturar el procés.
  global.__programadorPortal.unref?.();
  console.log(
    `[programador] en marxa: ubicació de clients cada quart d'hora` +
      (configErp() && minutsEntreSincros() > 0 ? ` i sincronització amb l'ERP cada ${minutsEntreSincros()} minuts.` : "; sense sincronització amb l'ERP."),
  );
}

async function tic() {
  const minuts = minutsEntreSincros();
  let sincronitzat = false;
  if (configErp() && minuts > 0 && Date.now() >= properaSincro) {
    properaSincro = Date.now() + minuts * 60_000;
    try {
      const resultat = await sincronitzaAmbErp("programada");
      sincronitzat = true;
      const errors = resultat.passos.filter((pas) => !pas.correcte);
      console.log(
        `[programador] sincronització amb l'ERP ${errors.length ? `amb ${errors.length} errors: ${errors.map((pas) => `${pas.nom} (${pas.error})`).join("; ")}` : "correcta"}.`,
      );
    } catch (error) {
      console.error(`[programador] sincronització amb l'ERP aturada: ${(error as Error).message}`);
    }
  }
  if (sincronitzat || Date.now() - darreraUbicacio >= UBICACIO_CADA_MS) {
    darreraUbicacio = Date.now();
    void ubica();
  }
}

async function ubica() {
  if (ubicant) return;
  ubicant = true;
  try {
    const { ubicats, fallits } = await ubicaTotsElsPendents();
    if (ubicats || fallits) console.log(`[programador] ubicació de clients: ${ubicats} situats, ${fallits} sense trobar.`);
  } catch (error) {
    console.error(`[programador] ubicació de clients aturada: ${(error as Error).message}`);
  } finally {
    ubicant = false;
  }
}
