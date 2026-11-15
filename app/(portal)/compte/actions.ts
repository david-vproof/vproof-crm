"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { GALETA_SESSIO, esAdministrador, opcionsGaleta, signaSessio, verificaToken } from "@/lib/sessio";
import { ErrorIdentitat, desaCompte } from "@/serveis/identitat";

export type EstatCompte = { error?: string; fet?: string };

export async function desaCompteAccio(_previ: EstatCompte, dades: FormData): Promise<EstatCompte> {
  const galetes = await cookies();
  const sessio = await verificaToken(galetes.get(GALETA_SESSIO)?.value);
  if (!sessio) redirect("/login?des=%2Fcompte");

  const nom = String(dades.get("nom") ?? "").trim();
  const cognoms = String(dades.get("cognoms") ?? "").trim();
  const correu = String(dades.get("correu") ?? "").trim().toLowerCase();
  // la base de dades només deixa escriure aquest camp a l'administrador: per a la resta no s'envia, i el perfil es pot desar igual.
  const telefon = esAdministrador(sessio) ? String(dades.get("telefon") ?? "").trim() || null : undefined;
  const contrasenyaActual = String(dades.get("contrasenya_actual") ?? "");
  const nova = String(dades.get("contrasenya_nova") ?? "");
  const repetida = String(dades.get("contrasenya_repetida") ?? "");

  if (!nom) return { error: "Cal omplir el nom." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correu)) return { error: "El correu no té un format vàlid." };
  if (!contrasenyaActual) return { error: "Per desar els canvis cal la contrasenya actual." };
  if (nova && nova.length < 8) return { error: "La contrasenya nova ha de tenir 8 caràcters com a mínim." };
  if (nova !== repetida) return { error: "Les dues contrasenyes noves no coincideixen." };

  try {
    await desaCompte(sessio.usuari, contrasenyaActual, { nom, cognoms, correu, telefon, contrasenyaNova: nova || undefined });
  } catch (error) {
    if (error instanceof ErrorIdentitat) return { error: error.message };
    throw error;
  }

  // La galeta porta el nom i el correu per pintar-los: es torna a signar amb els nous.
  const nomComplet = [nom, cognoms].filter(Boolean).join(" ");
  const actualitzada = { ...sessio, usuari: correu, nom: nomComplet || correu };
  galetes.set(GALETA_SESSIO, await signaSessio(actualitzada), opcionsGaleta(actualitzada.expira));

  revalidatePath("/", "layout");
  return { fet: nova ? "Dades i contrasenya desades." : "Dades desades." };
}
