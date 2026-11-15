/**
 * El rellotge del portal. El Next corre en un contenidor permanent, així que
 * les tasques periòdiques viuen aquí dins: cada minut es mira si toca fer
 * alguna passada. Què toca i quan ho decideix cada servei, no el rellotge.
 *
 * S'arrenca un sol cop per procés des de `instrumentation.ts`.
 */
import { teAccesCrm } from "@/apis/directus/crm";
import { ubicaTotsElsPendents } from "@/serveis/crm-mapa";
import { executaSiToca } from "@/serveis/sincronitzacio";

const CADA_MS = 60_000;
/** Cada quant es miren els clients sense coordenades, a més de després de cada sincronització de clients. */
const UBICACIO_CADA_MS = 15 * 60_000;

type AmbProgramador = typeof globalThis & { __programadorPortal?: ReturnType<typeof setInterval> };

// El mateix error (Directus sense provisionar, posem) no s'escriu cada minut.
let darrerError = "";
let darreraUbicacio = 0;

export function arrencaProgramador() {
  const global = globalThis as AmbProgramador;
  if (global.__programadorPortal) return;

  global.__programadorPortal = setInterval(tic, CADA_MS);
  // Que el rellotge no impedeixi aturar el procés.
  global.__programadorPortal.unref?.();
  console.log("[programador] en marxa: cada minut es comprova si toca sincronitzar amb FactuSol.");
}

async function tic() {
  let clientsSincronitzats = false;
  try {
    const passades = await executaSiToca();
    darrerError = "";
    for (const { taula, resultat } of passades) {
      const com = resultat.estat === "correcte" ? "feta" : resultat.estat === "parcial" ? "feta amb errors de còpia" : "fallida";
      console.log(`[programador] sincronització de ${taula} ${com}: ${resultat.missatge}`);
      if (taula === "clients" && resultat.correcte) clientsSincronitzats = true;
    }
  } catch (error) {
    const missatge = (error as Error).message;
    if (missatge !== darrerError) console.error(`[programador] ${missatge}`);
    darrerError = missatge;
  }

  // Els clients nous, o els que han canviat d'adreça (la sincro els buida les
  // coordenades), s'ubiquen sols: sense coordenades no entrarien als segments
  // per ubicació fins que algú obrís el mapa. No s'espera: pot durar minuts.
  if (teAccesCrm() && (clientsSincronitzats || Date.now() - darreraUbicacio >= UBICACIO_CADA_MS)) {
    darreraUbicacio = Date.now();
    void ubica();
  }
}

async function ubica() {
  try {
    const { ubicats, fallits } = await ubicaTotsElsPendents();
    if (ubicats || fallits) {
      console.log(`[programador] ubicació de clients: ${ubicats} situats, ${fallits} sense trobar.`);
    }
  } catch (error) {
    console.error(`[programador] ubicació de clients aturada: ${(error as Error).message}`);
  }
}
