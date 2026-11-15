/**
 * Qui pot entrar al portal.
 *
 * Els comptes viuen a la base de dades i el portal només els administra: aquí es
 * tradueixen al seu vocabulari i s'amaga el compte de màquina, que no és
 * ningú. Els canvis els signa sempre l'administrador amb la seva contrasenya.
 */
import "server-only";

import { ErrorDades } from "@/apis/sqlite";
import { llistaTot } from "@/apis/sqlite/crm";
import {
  actualitzaUsuari,
  creaRol,
  creaUsuari,
  llistaRols,
  llistaUsuaris,
  type Administrador,
  type FilaRol,
  type FilaUsuari,
} from "@/apis/sqlite/usuaris";

/** El rol dels comptes de màquina, tal com el crea scripts/crm-acces.mjs. */
const ROL_MAQUINA = "Portal";

export type EstatUsuari = "actiu" | "suspes" | "altre";

export type UsuariPortal = {
  id: string;
  nom: string;
  cognoms: string;
  correu: string;
  telefon: string;
  rol: { id: string; nom: string } | null;
  /** L'agent comercial de l'ERP que és aquesta persona, si n'és un. */
  agent: AgentPortal | null;
  estat: EstatUsuari;
  /** L'estat tal com el diu la base de dades, per quan no és cap dels dos coneguts. */
  estatDirectus: string;
  darrerAcces: string | null;
};

export type RolPortal = { id: string; nom: string; descripcio: string };

/** Un agent comercial de l'ERP (F_AGE), tal com el copia la sincronització de clients. */
export type AgentPortal = { id: string; nom: string };

export class ErrorUsuaris extends Error {
  constructor(missatge: string) {
    super(missatge);
    this.name = "ErrorUsuaris";
  }
}

function tradueixError(error: unknown): never {
  if (error instanceof ErrorDades) throw new ErrorUsuaris(error.message);
  throw error;
}

function aUsuari(fila: FilaUsuari): UsuariPortal {
  return {
    id: fila.id,
    nom: fila.first_name ?? "",
    cognoms: fila.last_name ?? "",
    correu: fila.email,
    telefon: fila.telefon ?? "",
    rol: fila.role ? { id: fila.role.id, nom: fila.role.name } : null,
    agent: fila.agent ? { id: fila.agent.id, nom: fila.agent.nom ?? "Sense nom" } : null,
    estat: fila.status === "active" ? "actiu" : fila.status === "suspended" ? "suspes" : "altre",
    estatDirectus: fila.status,
    darrerAcces: fila.last_access,
  };
}

function aRol(fila: FilaRol): RolPortal {
  return { id: fila.id, nom: fila.name, descripcio: fila.description ?? "" };
}

/** Els agents comercials de l'ERP: per lligar-los a un usuari i per triar de qui és l'agenda. */
export async function agentsDelPortal(): Promise<AgentPortal[]> {
  const files = await llistaTot<{ id: string; nom: string | null }>("crm_agents", ["id", "nom"], "nom");
  return files.map((fila) => ({ id: fila.id, nom: fila.nom ?? "Sense nom" }));
}

/** Les persones que poden entrar, els rols que se'ls pot donar i els agents que poden ser. */
export async function usuarisDelPortal(): Promise<{ usuaris: UsuariPortal[]; rols: RolPortal[]; agents: AgentPortal[] }> {
  try {
    const [usuaris, rols, agents] = await Promise.all([llistaUsuaris(), llistaRols(), agentsDelPortal()]);
    return {
      usuaris: usuaris.filter((u) => u.role?.name !== ROL_MAQUINA).map(aUsuari),
      rols: rols.filter((r) => r.name !== ROL_MAQUINA).map(aRol),
      agents,
    };
  } catch (error) {
    tradueixError(error);
  }
}

export type Comercial = { id: string; nom: string };

/** Les persones de l'equip, per triar de qui és l'agenda. Només les actives. */
export async function comercialsDelPortal(): Promise<Comercial[]> {
  try {
    return (await llistaUsuaris())
      .filter((u) => u.status === "active" && u.role?.name !== ROL_MAQUINA)
      .map((u) => ({ id: u.id, nom: [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email }));
  } catch (error) {
    tradueixError(error);
  }
}

export type DadesUsuari = {
  nom: string;
  cognoms: string;
  correu: string;
  telefon: string;
  rol: string;
  /** L'id de l'agent comercial a `crm_agents`, o null si la persona no n'és cap. */
  agent: string | null;
  /** Només en editar: en crear, el compte neix actiu. */
  estat?: "actiu" | "suspes";
  /** Obligatòria en crear; en editar, només si es vol canviar. */
  contrasenya?: string;
};

/** La contrasenya que no és correcta és la de l'administrador, no la del compte que toca. */
function ambContrasenyaDeLAdministrador(error: unknown): never {
  if (error instanceof ErrorDades && error.motiu === "credencials" && error.message === "Les credencials no són correctes.") {
    throw new ErrorUsuaris("La teva contrasenya no és correcta.");
  }
  tradueixError(error);
}

export async function creaUsuariDelPortal(admin: Administrador, dades: DadesUsuari) {
  try {
    await creaUsuari(admin, {
      first_name: dades.nom,
      last_name: dades.cognoms || null,
      email: dades.correu,
      telefon: dades.telefon || null,
      role: dades.rol,
      agent: dades.agent,
      status: "active",
      password: dades.contrasenya,
    });
  } catch (error) {
    ambContrasenyaDeLAdministrador(error);
  }
}

export async function desaUsuariDelPortal(admin: Administrador, id: string, dades: DadesUsuari) {
  try {
    await actualitzaUsuari(admin, id, {
      first_name: dades.nom,
      last_name: dades.cognoms || null,
      email: dades.correu,
      telefon: dades.telefon || null,
      role: dades.rol,
      agent: dades.agent,
      ...(dades.estat ? { status: dades.estat === "actiu" ? "active" : "suspended" } : {}),
      ...(dades.contrasenya ? { password: dades.contrasenya } : {}),
    });
  } catch (error) {
    ambContrasenyaDeLAdministrador(error);
  }
}

/**
 * Crea el rol Manager a la base de dades, si no hi és: qui el té veu els clients de
 * tothom sense administrar res (vegeu `lib/sessio.ts`). Diu si ha quedat amb
 * la política de l'equip; sense, no podria entrar fins a passar scripts/crm-acces.mjs.
 */
export async function creaRolManager(admin: Administrador): Promise<{ id: string; ambPolitica: boolean }> {
  try {
    return await creaRol(admin, {
      nom: "Manager",
      icona: "supervisor_account",
      descripcio: "Veu els clients de tothom al portal, sense administrar usuaris.",
    });
  } catch (error) {
    ambContrasenyaDeLAdministrador(error);
  }
}

export type { Administrador };
