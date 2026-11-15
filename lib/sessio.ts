/**
 * Sessió mínima signada amb HMAC-SHA256.
 *
 * Es fa servir Web Crypto (no `node:crypto`) perquè el middleware, que corre
 * en el runtime Edge, pugui verificar la galeta sense duplicar lògica.
 *
 * És una sessió llarga i lliscant, pensada perquè el portal instal·lat al
 * mòbil no demani la contrasenya cada dia: cada dia d'ús l'allarga fins a
 * DURADA_MS, amb un sostre absolut de MAXIM_MS des de l'entrada. A canvi, el
 * middleware comprova un cop al dia que el compte segueixi actiu a Directus.
 */
import { ROL_ADMINISTRADOR, ROL_MANAGER } from "@/domini/rols";
const SECRET = process.env.AUTH_SECRET ?? "wine-backend-secret-de-desenvolupament";

const DIA_MS = 24 * 60 * 60 * 1000;
/** Fins on arriba la sessió des del darrer dia d'ús. */
export const DURADA_MS = 30 * DIA_MS;
/** Sostre des de l'entrada: passat aquest temps cal tornar a entrar, s'usi o no. */
export const MAXIM_MS = 90 * DIA_MS;
/** Cada quant es torna a signar la galeta amb la caducitat allargada. */
export const RENOVACIO_MS = DIA_MS;
/** Cada quant es comprova contra Directus que el compte segueix actiu. */
export const COMPROVACIO_MS = DIA_MS;
/** Si la comprovació no ha pogut respondre, quan es torna a intentar. */
export const REINTENT_MS = 60 * 60 * 1000;

export const GALETA_SESSIO = "wine_backend_sessio";

/** `usuari` és la identitat (correu amb Directus); la resta és per pintar. */
export type Sessio = {
  usuari: string;
  nom?: string;
  id?: string;
  rol?: string | null;
  /** L'agent comercial de FactuSol que és aquesta persona, si n'és un: el seu vincle amb els clients. */
  agent?: AgentDeSessio | null;
  /** Quan va entrar. La renovació no passa mai de MAXIM_MS des d'aquí. */
  inici: number;
  /** Quan es va signar per darrer cop. */
  renovat: number;
  /** Quan es va comprovar per darrer cop que el compte segueix actiu. */
  comprovat: number;
  expira: number;
};

/** L'agent lligat al compte: l'id de `crm_agents` i el codi que FactuSol posa als clients (AGECLI). */
export type AgentDeSessio = { id: string; codiErp: number | null };

export type Perfil = { nom?: string; id?: string; rol?: string | null; agent?: AgentDeSessio | null };

const codificador = new TextEncoder();

function aBase64Url(bytes: Uint8Array) {
  let binari = "";
  for (const byte of bytes) binari += String.fromCharCode(byte);
  return btoa(binari).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function desDeBase64Url(text: string) {
  const ple = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binari = atob(ple);
  return Uint8Array.from(binari, (caracter) => caracter.charCodeAt(0));
}

async function signa(dades: string) {
  const clau = await crypto.subtle.importKey(
    "raw",
    codificador.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatura = await crypto.subtle.sign("HMAC", clau, codificador.encode(dades));
  return aBase64Url(new Uint8Array(signatura));
}

/** Comparació en temps constant, per no filtrar la signatura per temporització. */
function iguals(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

function caducitat(inici: number, ara: number) {
  return Math.min(ara + DURADA_MS, inici + MAXIM_MS);
}

export function novaSessio(usuari: string, perfil: Perfil = {}, ara = Date.now()): Sessio {
  return { usuari, ...perfil, inici: ara, renovat: ara, comprovat: ara, expira: caducitat(ara, ara) };
}

/**
 * La mateixa sessió amb la caducitat allargada i, si s'ha comprovat, la marca
 * al dia. Amb `perfil`, el rol i l'agent tal com són ara a Directus: un canvi
 * de rol o d'agent fet des d'Usuaris arriba així a la sessió oberta.
 */
export function renovaSessio(
  sessio: Sessio,
  { comprovat = sessio.comprovat, ara = Date.now(), perfil }: { comprovat?: number; ara?: number; perfil?: Pick<Perfil, "rol" | "agent"> } = {},
): Sessio {
  return { ...sessio, ...perfil, renovat: ara, comprovat, expira: caducitat(sessio.inici, ara) };
}

export async function signaSessio(sessio: Sessio) {
  // La galeta va signada, no xifrada: aquí no hi ha d'anar mai cap testimoni.
  const cos = aBase64Url(codificador.encode(JSON.stringify(sessio)));
  return `${cos}.${await signa(cos)}`;
}

export async function verificaToken(token?: string | null): Promise<Sessio | null> {
  if (!token) return null;
  const [cos, signatura] = token.split(".");
  if (!cos || !signatura) return null;
  if (!iguals(signatura, await signa(cos))) return null;

  try {
    const brut = JSON.parse(new TextDecoder().decode(desDeBase64Url(cos))) as Partial<Sessio> & Pick<Sessio, "usuari" | "expira">;
    if (!(brut.expira > Date.now())) return null;
    // Galetes d'abans de la sessió lliscant: sense marques, es renoven i es comproven de seguida.
    return { ...brut, inici: brut.inici ?? Date.now(), renovat: brut.renovat ?? 0, comprovat: brut.comprovat ?? 0 };
  } catch {
    return null;
  }
}

/** Les opcions de la galeta, iguals en entrar i en renovar. */
export function opcionsGaleta(expira: number, ara = Date.now()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.max(0, Math.floor((expira - ara) / 1000)),
  };
}

export { ROL_ADMINISTRADOR, ROL_MANAGER };

const rolDe = (sessio: Pick<Sessio, "rol"> | null | undefined) => (sessio?.rol ?? "").trim().toLowerCase();

export function esAdministrador(sessio: Pick<Sessio, "rol"> | null | undefined): boolean {
  return rolDe(sessio) === ROL_ADMINISTRADOR;
}

export function esManager(sessio: Pick<Sessio, "rol"> | null | undefined): boolean {
  return rolDe(sessio) === ROL_MANAGER;
}

/**
 * Si veu els clients de tothom. L'administrador i el manager, sí; la resta
 * només els del seu agent comercial, i sense agent, cap (vegeu `domini/abast.ts`).
 */
export function veuTot(sessio: Pick<Sessio, "rol"> | null | undefined): boolean {
  return esAdministrador(sessio) || esManager(sessio);
}
