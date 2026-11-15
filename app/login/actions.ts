"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GALETA_SESSIO, novaSessio, opcionsGaleta, signaSessio } from "@/lib/sessio";
import { ErrorIdentitat, comprovaCredencials } from "@/serveis/identitat";

export type EstatLogin = { error?: string };

export async function iniciaSessio(_previ: EstatLogin, dades: FormData): Promise<EstatLogin> {
  const usuari = String(dades.get("usuari") ?? "").trim();
  const contrasenya = String(dades.get("contrasenya") ?? "");
  const des = String(dades.get("des") ?? "");

  if (!usuari || !contrasenya) {
    return { error: "Introdueix l'usuari i la contrasenya." };
  }

  let identitat;
  try {
    identitat = await comprovaCredencials(usuari, contrasenya);
  } catch (error) {
    if (error instanceof ErrorIdentitat) return { error: error.message };
    throw error;
  }

  const sessio = novaSessio(identitat.usuari, identitat.perfil);
  (await cookies()).set(GALETA_SESSIO, await signaSessio(sessio), opcionsGaleta(sessio.expira));

  // Només s'admeten rutes internes com a destí, per no obrir un redirect obert.
  redirect(des.startsWith("/") && !des.startsWith("//") ? des : "/crm");
}

export async function tancaSessio() {
  const magatzem = await cookies();
  magatzem.delete(GALETA_SESSIO);
  redirect("/login");
}
