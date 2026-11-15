/**
 * Qui pot entrar al portal.
 *
 * Les credencials es comproven contra els comptes de la base de dades; la
 * presentació només rep un perfil o un error.
 */
import "server-only";

import {
  ErrorDades,
  actualitzaPerfil,
  autentica,
  estatCompte,
  llegeixPerfilUsuari,
  type CanvisPerfil,
  type PerfilUsuari,
} from "@/apis/sqlite";
import type { Perfil } from "@/lib/sessio";

export type Identitat = { usuari: string; perfil: Perfil };

export class ErrorIdentitat extends Error {
  constructor(missatge: string) {
    super(missatge);
    this.name = "ErrorIdentitat";
  }
}

/**
 * Si el compte d'una sessió oberta segueix actiu, i amb quin rol i quin agent
 * ara. `actiu` null vol dir que no s'ha pogut saber i que val més conservar la
 * sessió i tornar-ho a provar.
 */
export async function compteActiu(sessio: { id?: string }): Promise<{ actiu: boolean | null; perfil?: Pick<Perfil, "rol" | "agent"> }> {
  if (!sessio.id) return { actiu: false };
  const compte = await estatCompte(sessio.id);
  if (compte.estat === "desconegut") return { actiu: null };
  if (compte.estat !== "actiu") return { actiu: false };
  return { actiu: true, perfil: { rol: compte.rol ?? null, agent: compte.agent ?? null } };
}

/** El perfil del compte de la sessió, o cap si la sessió no en porta. */
export async function perfilDelCompte(sessio: { id?: string }): Promise<PerfilUsuari | null> {
  if (!sessio.id) return null;
  try {
    return await llegeixPerfilUsuari(sessio.id);
  } catch (error) {
    if (error instanceof ErrorDades) throw new ErrorIdentitat(error.message);
    throw error;
  }
}

/** Desa el perfil en nom de l'usuari. Cal la seva contrasenya actual. */
export async function desaCompte(correuActual: string, contrasenyaActual: string, canvis: CanvisPerfil) {
  try {
    await actualitzaPerfil(correuActual, contrasenyaActual, canvis);
  } catch (error) {
    if (!(error instanceof ErrorDades)) throw error;
    throw new ErrorIdentitat(
      error.motiu === "credencials" ? "La contrasenya actual no és correcta." : error.message,
    );
  }
}

export type { CanvisPerfil, PerfilUsuari };

export async function comprovaCredencials(usuari: string, contrasenya: string): Promise<Identitat> {
  try {
    const compte = await autentica(usuari, contrasenya);
    return {
      usuari: compte.correu,
      perfil: { nom: compte.nom, id: compte.id, rol: compte.rol, agent: compte.agent },
    };
  } catch (error) {
    if (error instanceof ErrorDades) throw new ErrorIdentitat(error.message);
    throw error;
  }
}
