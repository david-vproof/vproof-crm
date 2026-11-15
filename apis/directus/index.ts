/**
 * Identitat contra Directus.
 *
 * Tot passa pel servidor: el navegador no parla mai amb Directus ni rep cap
 * dels seus testimonis. Aquí es comproven les credencials i se'n treu qui és
 * l'usuari; la sessió del portal continua sent la galeta signada de `lib/sessio`.
 */
import "server-only";

import type { AgentDeSessio } from "@/lib/sessio";

import { ErrorDirectus, TESTIMONI, demana, estaConfigurat } from "./client";
import { entra, tanca } from "./sessio";

export { ErrorDirectus, estaConfigurat } from "./client";
export type { MotiuError } from "./client";

export type UsuariDirectus = {
  id: string;
  correu: string;
  /** Nom i cognoms si n'hi ha; si no, el correu. */
  nom: string;
  rol: string | null;
  /** L'agent comercial de FactuSol lligat al compte (vegeu scripts/crm-directus.mjs), o cap. */
  agent: AgentDeSessio | null;
};

type FilaPerfil = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: string;
  role: { name: string } | null;
  agent: { id: string; codi_erp: number | string | null } | null;
};

type RespostaUsuari = { data?: FilaPerfil };

const CAMPS_PERFIL = "id,email,first_name,last_name,status,role.name,agent.id,agent.codi_erp";

function agentDe(fila: Pick<FilaPerfil, "agent">): AgentDeSessio | null {
  if (!fila.agent?.id) return null;
  const codi = Number(fila.agent.codi_erp);
  return { id: fila.agent.id, codiErp: Number.isFinite(codi) && codi > 0 ? codi : null };
}

/**
 * Comprova les credencials i retorna el perfil. Els testimonis de Directus no
 * surten d'aquesta funció: es fan servir per llegir el perfil i es tanquen.
 */
export async function autentica(correu: string, contrasenya: string): Promise<UsuariDirectus> {
  const testimonis = await entra(correu, contrasenya);
  try {
    return await llegeixPerfil(testimonis.acces);
  } finally {
    // El portal gestiona la seva pròpia sessió: no deixem la de Directus oberta.
    if (testimonis.refresc) await tanca(testimonis.refresc);
  }
}

export type PerfilUsuari = { nom: string; cognoms: string; correu: string; telefon: string };

/** Nom, cognoms, correu i telèfon d'un usuari, llegits amb el testimoni de màquina. */
export async function llegeixPerfilUsuari(id: string): Promise<PerfilUsuari | null> {
  if (!estaConfigurat() || !TESTIMONI) return null;

  const resposta = await demana(
    `/users?limit=1&fields=first_name,last_name,email,telefon&filter[id][_eq]=${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${TESTIMONI}` } },
  );
  if (!resposta.ok) {
    throw new ErrorDirectus("servei", `No s'ha pogut llegir el perfil (HTTP ${resposta.status}).`);
  }

  const { data } = (await resposta.json()) as {
    data?: { first_name: string | null; last_name: string | null; email: string; telefon: string | null }[];
  };
  const fila = data?.[0];
  if (!fila) return null;
  return { nom: fila.first_name ?? "", cognoms: fila.last_name ?? "", correu: fila.email, telefon: fila.telefon ?? "" };
}

export type CanvisPerfil = {
  nom: string;
  cognoms: string;
  correu: string;
  /** Absent, no es toca: només l'administrador se'l pot canviar (vegeu la nota de sota). */
  telefon?: string | null;
  contrasenyaNova?: string;
};

/**
 * Desa el perfil d'un usuari en nom seu: s'entra a Directus amb la seva
 * contrasenya i es toca només /users/me. Així el compte de màquina no necessita
 * permís d'escriure usuaris, i canviar la contrasenya exigeix saber l'actual.
 * Un usuari amb accés d'app pot editar-se el nom, el correu i la contrasenya
 * per defecte; el telèfon és un camp propi i això no l'hi inclou.
 */
export async function actualitzaPerfil(correu: string, contrasenya: string, canvis: CanvisPerfil): Promise<void> {
  const testimonis = await entra(correu, contrasenya);

  try {
    const cos: Record<string, string | null> = { first_name: canvis.nom, last_name: canvis.cognoms, email: canvis.correu };
    if (canvis.telefon !== undefined) cos.telefon = canvis.telefon;
    if (canvis.contrasenyaNova) cos.password = canvis.contrasenyaNova;

    const resposta = await demana("/users/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${testimonis.acces}`, "Content-Type": "application/json" },
      body: JSON.stringify(cos),
    });
    if (resposta.ok) return;

    const detall = (await resposta.json().catch(() => ({}))) as {
      errors?: { message?: string; extensions?: { code?: string } }[];
    };
    const codi = detall.errors?.[0]?.extensions?.code;
    if (codi === "RECORD_NOT_UNIQUE") {
      throw new ErrorDirectus("servei", "Ja hi ha un altre compte amb aquest correu.");
    }
    if (codi === "FAILED_VALIDATION") {
      throw new ErrorDirectus("servei", detall.errors?.[0]?.message ?? "Directus no accepta aquestes dades.");
    }
    if (resposta.status === 403) {
      throw new ErrorDirectus("servei", "El teu rol a Directus no permet editar el perfil des del portal.");
    }
    throw new ErrorDirectus("servei", detall.errors?.[0]?.message ?? `Directus ha respost HTTP ${resposta.status}.`);
  } finally {
    if (testimonis.refresc) await tanca(testimonis.refresc);
  }
}

async function llegeixPerfil(testimoni: string): Promise<UsuariDirectus> {
  const resposta = await demana(`/users/me?fields=${CAMPS_PERFIL}`, {
    headers: { Authorization: `Bearer ${testimoni}` },
  });

  if (!resposta.ok) {
    throw new ErrorDirectus("servei", `No s'ha pogut llegir el perfil (HTTP ${resposta.status}).`);
  }

  const { data } = (await resposta.json()) as RespostaUsuari;
  if (!data) {
    throw new ErrorDirectus("servei", "El perfil ha arribat buit.");
  }
  if (data.status !== "active") {
    throw new ErrorDirectus("suspes", `Aquest compte està en estat "${data.status}".`);
  }

  const nom = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return { id: data.id, correu: data.email, nom: nom || data.email, rol: data.role?.name ?? null, agent: agentDe(data) };
}

export type EstatCompte = "actiu" | "inactiu" | "desconegut";
/** L'estat del compte i, si és actiu, el rol i l'agent que té ara: per posar la sessió al dia. */
export type CompteViu = { estat: EstatCompte; rol?: string | null; agent?: AgentDeSessio | null };

/**
 * Si un compte segueix actiu, llegit amb el testimoni de màquina. Es demana per
 * filtre i no per /users/id perquè Directus respon 403 tant si l'usuari no
 * existeix com si no s'hi té permís: amb filtre, «no hi és» arriba com una
 * llista buida i el 403 només vol dir permisos. És una comprovació de fons,
 * així que espera poc: si Directus no respon, val més dir «desconegut» que
 * aturar la pàgina mig minut.
 */
export async function estatCompte(id: string): Promise<CompteViu> {
  if (!estaConfigurat() || !TESTIMONI) return { estat: "desconegut" };

  try {
    const resposta = await demana(
      `/users?limit=1&fields=status,role.name,agent.id,agent.codi_erp&filter[id][_eq]=${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${TESTIMONI}` } },
      5_000,
    );
    if (!resposta.ok) return { estat: "desconegut" };

    const { data } = (await resposta.json()) as { data?: Pick<FilaPerfil, "status" | "role" | "agent">[] };
    if (!data) return { estat: "desconegut" };
    const fila = data[0];
    if (fila?.status !== "active") return { estat: "inactiu" };
    return { estat: "actiu", rol: fila.role?.name ?? null, agent: agentDe(fila) };
  } catch {
    return { estat: "desconegut" };
  }
}
