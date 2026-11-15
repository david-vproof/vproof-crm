/**
 * Administració dels usuaris del portal.
 *
 * Llegir-los ho pot fer el portal sol. Els canvis, en canvi, es fan sempre en
 * nom de l'administrador que els demana: es torna a comprovar la seva
 * contrasenya i que el seu rol sigui el d'administrador. Així, qui no ho és no
 * en pot crear ni canviar cap, ni des de la pantalla ni des de fora.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { ROL_ADMINISTRADOR } from "@/domini/rols";

import { bd } from "./bd";
import { ErrorDades } from "./client";
import { xifraContrasenya } from "./contrasenyes";
import { executa } from "./consulta";
import { comprovaContrasenya } from "./index";

export type FilaUsuari = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  telefon: string | null;
  status: string;
  last_access: string | null;
  role: { id: string; name: string } | null;
  /** L'agent comercial que és aquesta persona. */
  agent: { id: string; nom: string | null } | null;
};

export type FilaRol = { id: string; name: string; description: string | null };

const CAMPS_USUARI = "id,first_name,last_name,email,telefon,status,last_access,role.id,role.name,agent.id,agent.nom";

async function llegeix<T>(ruta: string): Promise<T[]> {
  const resposta = await executa(ruta);
  if (!resposta.ok) throw new ErrorDades("servei", `No s'han pogut llegir els usuaris (HTTP ${resposta.status}).`);
  const { data } = (await resposta.json()) as { data?: T[] };
  return data ?? [];
}

export function llistaUsuaris() {
  return llegeix<FilaUsuari>(`/users?limit=-1&sort=first_name,last_name,email&fields=${CAMPS_USUARI}`);
}

/** El correu i el telèfon d'un usuari, o null si no hi és. */
export async function contacteUsuari(id: string) {
  const [fila] = await llegeix<Pick<FilaUsuari, "email" | "telefon">>(
    `/users?limit=1&fields=email,telefon&filter[id][_eq]=${encodeURIComponent(id)}`,
  );
  return fila ? { correu: fila.email, telefon: fila.telefon?.trim() || null } : null;
}

export function llistaRols() {
  return llegeix<FilaRol>("/roles?limit=-1&sort=name&fields=id,name,description");
}

/** Qui demana el canvi: es tornen a comprovar les seves credencials. */
export type Administrador = { correu: string; contrasenya: string };

function exigeixAdministrador(admin: Administrador) {
  const fila = comprovaContrasenya(admin.correu, admin.contrasenya);
  if ((fila.rol ?? "").toLowerCase() !== ROL_ADMINISTRADOR) {
    throw new ErrorDades("credencials", "El teu compte no té permís per administrar usuaris.");
  }
}

/** Els camps d'usuari que es poden desar des de la pantalla, amb la contrasenya ja xifrada. */
function campsDUsuari(dades: Record<string, unknown>) {
  const camps: Record<string, unknown> = {};
  for (const [clau, valor] of Object.entries(dades)) {
    if (clau === "password") {
      if (typeof valor === "string" && valor) camps.password = xifraContrasenya(valor);
    } else if (clau === "email") {
      camps.email = String(valor ?? "").trim().toLowerCase();
    } else if (["first_name", "last_name", "telefon", "status", "role", "agent"].includes(clau)) {
      camps[clau] = valor === "" ? null : valor;
    }
  }
  return camps;
}

async function escriu(ruta: string, metode: "POST" | "PATCH", cos: Record<string, unknown>) {
  const resposta = await executa(ruta, { method: metode, body: JSON.stringify(cos) });
  if (resposta.ok) return;
  const detall = (await resposta.json().catch(() => ({}))) as { errors?: { message?: string; extensions?: { code?: string } }[] };
  if (detall.errors?.[0]?.extensions?.code === "RECORD_NOT_UNIQUE") {
    throw new ErrorDades("servei", "Ja hi ha un altre compte amb aquest correu.");
  }
  throw new ErrorDades("servei", detall.errors?.[0]?.message ?? `No s'ha pogut desar l'usuari (HTTP ${resposta.status}).`);
}

export async function creaUsuari(admin: Administrador, dades: Record<string, unknown>) {
  exigeixAdministrador(admin);
  return escriu("/users", "POST", { status: "active", ...campsDUsuari(dades) });
}

/** Crea un rol nou, en nom de l'administrador. */
export async function creaRol(admin: Administrador, rol: { nom: string; icona: string; descripcio: string }) {
  exigeixAdministrador(admin);
  const id = randomUUID();
  try {
    bd().prepare("INSERT INTO rols (id, name, description, icon) VALUES (?, ?, ?, ?)").run(id, rol.nom, rol.descripcio, rol.icona);
  } catch {
    throw new ErrorDades("servei", `Ja hi ha un rol que es diu «${rol.nom}».`);
  }
  return { id, ambPolitica: true };
}

export async function actualitzaUsuari(admin: Administrador, id: string, dades: Record<string, unknown>) {
  exigeixAdministrador(admin);
  return escriu(`/users/${encodeURIComponent(id)}`, "PATCH", campsDUsuari(dades));
}
