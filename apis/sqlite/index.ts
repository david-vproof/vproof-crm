/**
 * Identitat: els comptes del portal, a la taula `usuaris`.
 *
 * Tot passa pel servidor. Aquí es comproven les credencials (la contrasenya va
 * xifrada amb scrypt, vegeu `contrasenyes.ts`) i se'n treu qui és l'usuari; la
 * sessió del portal continua sent la galeta signada de `lib/sessio`.
 */
import "server-only";

import type { AgentDeSessio } from "@/lib/sessio";

import { bd } from "./bd";
import { ErrorDades } from "./client";
import { contrasenyaCorrecta, xifraContrasenya } from "./contrasenyes";

export { ErrorDades } from "./client";
export type { MotiuError } from "./client";

export type UsuariPortal = {
  id: string;
  correu: string;
  /** Nom i cognoms si n'hi ha; si no, el correu. */
  nom: string;
  rol: string | null;
  /** L'agent comercial lligat al compte, o cap. */
  agent: AgentDeSessio | null;
};

type FilaPerfil = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  password: string | null;
  telefon: string | null;
  status: string;
  rol: string | null;
  agent_id: string | null;
  agent_codi_erp: number | string | null;
};

const SELECCIO_PERFIL = `
  SELECT u.id, u.email, u.first_name, u.last_name, u.password, u.telefon, u.status,
         r.name AS rol, a.id AS agent_id, a.codi_erp AS agent_codi_erp
    FROM usuaris u
    LEFT JOIN rols r ON r.id = u.role
    LEFT JOIN crm_agents a ON a.id = u.agent`;

function agentDe(fila: Pick<FilaPerfil, "agent_id" | "agent_codi_erp">): AgentDeSessio | null {
  if (!fila.agent_id) return null;
  const codi = Number(fila.agent_codi_erp);
  return { id: fila.agent_id, codiErp: Number.isFinite(codi) && codi > 0 ? codi : null };
}

const normalitzaCorreu = (correu: string) => correu.trim().toLowerCase();

function perCorreu(correu: string) {
  return bd().prepare(`${SELECCIO_PERFIL} WHERE lower(u.email) = ?`).get(normalitzaCorreu(correu)) as FilaPerfil | undefined;
}

function perId(id: string) {
  return bd().prepare(`${SELECCIO_PERFIL} WHERE u.id = ?`).get(id) as FilaPerfil | undefined;
}

/** Comprova les credencials i en torna la fila. Llança si no són bones o el compte no és actiu. */
export function comprovaContrasenya(correu: string, contrasenya: string): FilaPerfil {
  const fila = perCorreu(correu);
  if (!fila || !contrasenyaCorrecta(contrasenya, fila.password)) {
    throw new ErrorDades("credencials", "Les credencials no són correctes.");
  }
  if (fila.status !== "active") {
    throw new ErrorDades("suspes", `Aquest compte està en estat "${fila.status}".`);
  }
  return fila;
}

/** Comprova les credencials i retorna el perfil. */
export async function autentica(correu: string, contrasenya: string): Promise<UsuariPortal> {
  const fila = comprovaContrasenya(correu, contrasenya);
  bd().prepare("UPDATE usuaris SET last_access = ? WHERE id = ?").run(new Date().toISOString(), fila.id);
  const nom = [fila.first_name, fila.last_name].filter(Boolean).join(" ").trim();
  return { id: fila.id, correu: fila.email, nom: nom || fila.email, rol: fila.rol, agent: agentDe(fila) };
}

export type PerfilUsuari = { nom: string; cognoms: string; correu: string; telefon: string };

/** Nom, cognoms, correu i telèfon d'un usuari. */
export async function llegeixPerfilUsuari(id: string): Promise<PerfilUsuari | null> {
  const fila = perId(id);
  if (!fila) return null;
  return { nom: fila.first_name ?? "", cognoms: fila.last_name ?? "", correu: fila.email, telefon: fila.telefon ?? "" };
}

export type CanvisPerfil = {
  nom: string;
  cognoms: string;
  correu: string;
  /** Absent, no es toca: només l'administrador el canvia. */
  telefon?: string | null;
  contrasenyaNova?: string;
};

/**
 * Desa el perfil d'un usuari en nom seu: cal la seva contrasenya actual, i
 * només toca el seu compte.
 */
export async function actualitzaPerfil(correu: string, contrasenya: string, canvis: CanvisPerfil): Promise<void> {
  const fila = comprovaContrasenya(correu, contrasenya);
  const nouCorreu = normalitzaCorreu(canvis.correu);
  if (!nouCorreu.includes("@") && nouCorreu !== normalitzaCorreu(fila.email)) {
    throw new ErrorDades("servei", "El correu no és vàlid.");
  }
  const altre = perCorreu(nouCorreu);
  if (altre && altre.id !== fila.id) throw new ErrorDades("servei", "Ja hi ha un altre compte amb aquest correu.");

  const camps: Record<string, string | null> = { first_name: canvis.nom, last_name: canvis.cognoms, email: nouCorreu };
  if (canvis.telefon !== undefined) camps.telefon = canvis.telefon;
  if (canvis.contrasenyaNova) camps.password = xifraContrasenya(canvis.contrasenyaNova);
  const noms = Object.keys(camps);
  bd()
    .prepare(`UPDATE usuaris SET ${noms.map((n) => `${n} = ?`).join(", ")} WHERE id = ?`)
    .run(...noms.map((n) => camps[n]), fila.id);
}

export type EstatCompte = "actiu" | "inactiu" | "desconegut";
/** L'estat del compte i, si és actiu, el rol i l'agent que té ara: per posar la sessió al dia. */
export type CompteViu = { estat: EstatCompte; rol?: string | null; agent?: AgentDeSessio | null };

/** Si un compte segueix actiu, amb el rol i l'agent d'ara. */
export async function estatCompte(id: string): Promise<CompteViu> {
  try {
    const fila = perId(id);
    if (fila?.status !== "active") return { estat: "inactiu" };
    return { estat: "actiu", rol: fila.rol, agent: agentDe(fila) };
  } catch {
    return { estat: "desconegut" };
  }
}
