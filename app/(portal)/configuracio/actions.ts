"use server";

import { revalidatePath } from "next/cache";

import { ORDRE_FRANGES, type Franja } from "@/domini/crm-categoria";
import { llegeixTipusEnviats } from "@/domini/crm-tipus-activitat";
import { HORA_PER_DEFECTE, PERIODICITATS, type Programacio, type Taula, FITXA_TAULA, TAULES } from "@/domini/sincronitzacio";
import { potVeureTot } from "@/lib/sessio-actual";
import { provaConnexio as provaServei } from "@/serveis/configuracio";
import { ErrorCategoria, desaFranges } from "@/serveis/crm-categoria";
import { ErrorTipusActivitat, desaTipusActivitat } from "@/serveis/crm-tipus-activitat";
import { desaProgramacions as desaProgramacionsServei } from "@/serveis/sincronitzacio";

export type EstatConfiguracio = { to?: "ok" | "error"; missatge?: string };

/** La Configuració és de qui ho veu tot; un comercial no hi arriba pel menú, però una acció es pot cridar igualment. */
const SENSE_PERMIS: EstatConfiguracio = { to: "error", missatge: "No tens permís per canviar la configuració." };

export async function provaConnexio(): Promise<EstatConfiguracio> {
  if (!(await potVeureTot())) return SENSE_PERMIS;
  const prova = await provaServei();
  return prova.correcte
    ? { to: "ok", missatge: prova.missatge }
    : { to: "error", missatge: prova.missatge };
}

/** Desa les franges de la categoria i la recalcula a tots els clients. */
export async function desaCategoria(_previ: EstatConfiguracio, formulari: FormData): Promise<EstatConfiguracio> {
  if (!(await potVeureTot())) return SENSE_PERMIS;
  const franges: Franja[] = ORDRE_FRANGES.map((lletra) => {
    const brut = String(formulari.get(`des_de_${lletra}`) ?? "").trim().replace(",", ".");
    return { lletra, desDe: brut === "" ? Number.NaN : Number(brut) };
  });

  try {
    const canviats = await desaFranges(franges);
    revalidatePath("/configuracio");
    revalidatePath("/crm", "layout");
    return {
      to: "ok",
      missatge:
        canviats === 0
          ? "Franges desades. Cap client no ha canviat de categoria."
          : `Franges desades. ${canviats} ${canviats === 1 ? "client ha" : "clients han"} canviat de categoria.`,
    };
  } catch (error) {
    if (error instanceof ErrorCategoria) return { to: "error", missatge: error.message };
    return { to: "error", missatge: `No s'ha pogut desar: ${(error as Error).message}` };
  }
}

/** Desa la taula dels tipus d'activitat: els nous, els canvis i els que s'esborren. */
export async function desaTipus(_previ: EstatConfiguracio, formulari: FormData): Promise<EstatConfiguracio> {
  if (!(await potVeureTot())) return SENSE_PERMIS;

  let enviats;
  let esborrats: string[];
  try {
    enviats = llegeixTipusEnviats(JSON.parse(String(formulari.get("tipus") ?? "[]")));
    const brut: unknown = JSON.parse(String(formulari.get("esborrats") ?? "[]"));
    esborrats = Array.isArray(brut) ? brut.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return { to: "error", missatge: "La taula de tipus no s'ha pogut llegir. Torna a carregar la pàgina." };
  }

  try {
    const { creats, canviats, esborrats: treure } = await desaTipusActivitat(enviats, esborrats);
    revalidatePath("/configuracio");
    revalidatePath("/crm", "layout");
    const fets = [
      creats > 0 ? `${creats} ${creats === 1 ? "de nou" : "de nous"}` : null,
      canviats > 0 ? `${canviats} ${canviats === 1 ? "canviat" : "canviats"}` : null,
      treure > 0 ? `${treure} ${treure === 1 ? "esborrat" : "esborrats"}` : null,
    ].filter(Boolean);
    return { to: "ok", missatge: fets.length === 0 ? "No hi havia res per desar." : `Tipus desats: ${fets.join(", ")}.` };
  } catch (error) {
    if (error instanceof ErrorTipusActivitat) return { to: "error", missatge: error.message };
    return { to: "error", missatge: `No s'ha pogut desar: ${(error as Error).message}` };
  }
}

/**
 * La programació de totes les taules de cop, del formulari únic de la
 * pestanya de sincronització: `<taula>_activa`, `<taula>_periodicitat` i
 * `<taula>_hora` per a cadascuna.
 */
export async function desaProgramacions(_previ: EstatConfiguracio, formulari: FormData): Promise<EstatConfiguracio> {
  if (!(await potVeureTot())) return SENSE_PERMIS;
  const programacions = {} as Record<Taula, Programacio>;
  for (const taula of TAULES) {
    const minuts = Number(formulari.get(`${taula}_periodicitat`));
    const hora = String(formulari.get(`${taula}_hora`) ?? "").trim();
    if (!PERIODICITATS.some((p) => p.minuts === minuts)) {
      return { to: "error", missatge: `${FITXA_TAULA[taula].etiqueta}: tria una periodicitat de la llista.` };
    }
    if (hora && !/^\d{2}:\d{2}$/.test(hora)) {
      return { to: "error", missatge: `${FITXA_TAULA[taula].etiqueta}: l'hora ha de tenir el format HH:MM.` };
    }
    programacions[taula] = {
      activa: formulari.get(`${taula}_activa`) === "on",
      periodicitatMinuts: minuts,
      hora: hora || HORA_PER_DEFECTE,
    };
  }

  try {
    await desaProgramacionsServei(programacions);
  } catch (error) {
    return { to: "error", missatge: `No s'ha pogut desar: ${(error as Error).message}` };
  }
  revalidatePath("/configuracio");
  const actives = TAULES.filter((taula) => programacions[taula].activa);
  return {
    to: "ok",
    missatge:
      actives.length === 0
        ? "Programació desada: cap sincronització automàtica."
        : `Programació desada. El portal farà sol ${actives.map((taula) => FITXA_TAULA[taula].plural).join(", ")}.`,
  };
}
