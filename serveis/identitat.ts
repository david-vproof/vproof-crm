/**
 * Qui pot entrar al portal.
 *
 * Aquí es decideix contra què es comproven les credencials; la presentació
 * només rep un perfil o un error, i no sap si al darrere hi ha Directus o les
 * credencials locals.
 */
import "server-only";

import {
  ErrorDirectus,
  actualitzaPerfil,
  autentica,
  estaConfigurat,
  estatCompte,
  llegeixPerfilUsuari,
  type CanvisPerfil,
  type PerfilUsuari,
} from "@/apis/directus";
import type { Perfil } from "@/lib/sessio";

export type Identitat = { usuari: string; perfil: Perfil };

export class ErrorIdentitat extends Error {
  constructor(missatge: string) {
    super(missatge);
    this.name = "ErrorIdentitat";
  }
}

/**
 * Amb Directus configurat és l'única autoritat. Les credencials locals són la
 * sortida d'emergència mentre dura la migració: es recuperen traient
 * `DIRECTUS_URL` de l'entorn.
 */
export function origenIdentitat(): "directus" | "local" {
  return estaConfigurat() ? "directus" : "local";
}

function credencialsLocals(usuari: string, contrasenya: string) {
  return (
    usuari === (process.env.PORTAL_USUARI ?? "admin") &&
    contrasenya === (process.env.PORTAL_CONTRASENYA ?? "admin")
  );
}

/**
 * Si el compte d'una sessió oberta segueix actiu, i amb quin rol i quin agent
 * ara. `actiu` null vol dir que no s'ha pogut saber (Directus no respon, o el
 * portal no hi té permís) i que val més conservar la sessió i tornar-ho a
 * provar. Les sessions locals no tenen res a comprovar.
 */
export async function compteActiu(sessio: { id?: string }): Promise<{ actiu: boolean | null; perfil?: Pick<Perfil, "rol" | "agent"> }> {
  if (origenIdentitat() === "local" || !sessio.id) return { actiu: true };
  const compte = await estatCompte(sessio.id);
  if (compte.estat === "desconegut") return { actiu: null };
  if (compte.estat !== "actiu") return { actiu: false };
  return { actiu: true, perfil: { rol: compte.rol ?? null, agent: compte.agent ?? null } };
}

/** El perfil del compte de la sessió, o cap si no hi ha res a editar (sessió local). */
export async function perfilDelCompte(sessio: { id?: string }): Promise<PerfilUsuari | null> {
  if (origenIdentitat() === "local" || !sessio.id) return null;
  try {
    return await llegeixPerfilUsuari(sessio.id);
  } catch (error) {
    if (error instanceof ErrorDirectus) throw new ErrorIdentitat(error.message);
    throw error;
  }
}

/** Desa el perfil en nom de l'usuari. Cal la seva contrasenya actual. */
export async function desaCompte(correuActual: string, contrasenyaActual: string, canvis: CanvisPerfil) {
  try {
    await actualitzaPerfil(correuActual, contrasenyaActual, canvis);
  } catch (error) {
    if (!(error instanceof ErrorDirectus)) throw error;
    throw new ErrorIdentitat(
      error.motiu === "credencials" ? "La contrasenya actual no és correcta." : error.message,
    );
  }
}

export type { CanvisPerfil, PerfilUsuari };

export async function comprovaCredencials(usuari: string, contrasenya: string): Promise<Identitat> {
  if (origenIdentitat() === "local") {
    if (!credencialsLocals(usuari, contrasenya)) {
      throw new ErrorIdentitat("Les credencials no són correctes.");
    }
    return { usuari, perfil: {} };
  }

  try {
    const compte = await autentica(usuari, contrasenya);
    return {
      usuari: compte.correu,
      perfil: { nom: compte.nom, id: compte.id, rol: compte.rol, agent: compte.agent },
    };
  } catch (error) {
    if (error instanceof ErrorDirectus) throw new ErrorIdentitat(error.message);
    throw error;
  }
}
