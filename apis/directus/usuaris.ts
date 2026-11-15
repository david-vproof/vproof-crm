/**
 * Administració dels usuaris del portal a Directus.
 *
 * Es llegeix amb el compte de màquina, que dels usuaris només en té lectura.
 * Els canvis, en canvi, es fan sempre en nom de l'administrador que els
 * demana: s'entra a Directus amb la seva contrasenya i és Directus qui decideix
 * si pot administrar usuaris. Així el compte de màquina no toca mai cap
 * usuari, i qui no és administrador no en pot crear ni des del portal ni des
 * de fora.
 */
import "server-only";

import { ErrorDirectus, TESTIMONI, demana, estaConfigurat } from "./client";
import { entra, tanca } from "./sessio";

export type FilaUsuari = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  /** Camp propi, vegeu scripts/crm-directus.mjs. */
  telefon: string | null;
  status: string;
  last_access: string | null;
  role: { id: string; name: string } | null;
  /** L'agent comercial de FactuSol que és aquesta persona (camp propi, vegeu scripts/crm-directus.mjs). */
  agent: { id: string; nom: string | null } | null;
};

export type FilaRol = { id: string; name: string; description: string | null };

const CAMPS_USUARI = "id,first_name,last_name,email,telefon,status,last_access,role.id,role.name,agent.id,agent.nom";

async function llegeix<T>(ruta: string): Promise<T[]> {
  if (!estaConfigurat() || !TESTIMONI) {
    throw new ErrorDirectus("configuracio", "Falten DIRECTUS_URL o DIRECTUS_TOKEN.");
  }

  const resposta = await demana(ruta, { headers: { Authorization: `Bearer ${TESTIMONI}` } });
  if (!resposta.ok) {
    if (resposta.status === 401 || resposta.status === 403) {
      throw new ErrorDirectus(
        "credencials",
        "El compte de màquina del portal no pot llegir els usuaris o els rols. " +
          "Executa scripts/crm-acces.mjs amb credencials d'administrador per donar-li permís.",
      );
    }
    throw new ErrorDirectus("servei", `Directus ha respost HTTP ${resposta.status}.`);
  }

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

/** Qui demana el canvi: s'entra a Directus amb les seves credencials. */
export type Administrador = { correu: string; contrasenya: string };

/**
 * Executa un canvi sobre els usuaris en nom de l'administrador. Els testimonis
 * de Directus no surten d'aquí: es fan servir per a la crida i es tanquen.
 */
async function enNomDe(admin: Administrador, ruta: string, metode: "POST" | "PATCH", cos: Record<string, unknown>) {
  const testimonis = await entra(admin.correu, admin.contrasenya);

  try {
    const resposta = await demana(ruta, {
      method: metode,
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
      throw new ErrorDirectus("credencials", "El teu compte de Directus no té permís per administrar usuaris.");
    }
    throw new ErrorDirectus("servei", detall.errors?.[0]?.message ?? `Directus ha respost HTTP ${resposta.status}.`);
  } finally {
    if (testimonis.refresc) await tanca(testimonis.refresc);
  }
}

export function creaUsuari(admin: Administrador, dades: Record<string, unknown>) {
  return enNomDe(admin, "/users", "POST", dades);
}

/** La política de l'equip, tal com la crea scripts/crm-acces.mjs: el que cal per entrar al portal. */
const POLITICA_EQUIP = "wine_users";

/**
 * Crea un rol a Directus amb la política de l'equip, en nom de
 * l'administrador. És el que fa scripts/crm-acces.mjs per al rol Manager,
 * però des del portal: així no cal cap terminal per tenir-lo.
 */
export async function creaRol(admin: Administrador, rol: { nom: string; icona: string; descripcio: string }) {
  const testimonis = await entra(admin.correu, admin.contrasenya);
  const capcaleres = { Authorization: `Bearer ${testimonis.acces}`, "Content-Type": "application/json" };
  try {
    const creat = await demana("/roles?fields=id", {
      method: "POST",
      headers: capcaleres,
      body: JSON.stringify({ name: rol.nom, icon: rol.icona, description: rol.descripcio }),
    });
    if (creat.status === 403) throw new ErrorDirectus("credencials", "El teu compte de Directus no té permís per crear rols.");
    if (!creat.ok) throw new ErrorDirectus("servei", `Directus ha respost HTTP ${creat.status} en crear el rol.`);
    const { data } = (await creat.json()) as { data?: { id: string } };

    const politiques = await demana(`/policies?limit=1&fields=id&filter[name][_eq]=${encodeURIComponent(POLITICA_EQUIP)}`, { headers: capcaleres });
    const politica = politiques.ok ? ((await politiques.json()) as { data?: { id: string }[] }).data?.[0] : undefined;
    if (data?.id && politica?.id) {
      await demana("/access", { method: "POST", headers: capcaleres, body: JSON.stringify({ role: data.id, policy: politica.id }) });
    }
    return { id: data?.id ?? "", ambPolitica: Boolean(politica?.id) };
  } finally {
    if (testimonis.refresc) await tanca(testimonis.refresc);
  }
}

export function actualitzaUsuari(admin: Administrador, id: string, dades: Record<string, unknown>) {
  return enNomDe(admin, `/users/${encodeURIComponent(id)}`, "PATCH", dades);
}
