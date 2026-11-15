"use server";

import { revalidatePath } from "next/cache";

import { ORDRE_FRANGES, type Franja } from "@/domini/crm-categoria";
import { llegeixTipusEnviats } from "@/domini/crm-tipus-activitat";
import { potVeureTot } from "@/lib/sessio-actual";
import { ErrorCategoria, desaFranges } from "@/serveis/crm-categoria";
import { ErrorTipusActivitat, desaTipusActivitat } from "@/serveis/crm-tipus-activitat";

export type EstatConfiguracio = { to?: "ok" | "error"; missatge?: string };

/** La Configuració és de qui ho veu tot; un comercial no hi arriba pel menú, però una acció es pot cridar igualment. */
const SENSE_PERMIS: EstatConfiguracio = { to: "error", missatge: "No tens permís per canviar la configuració." };

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
