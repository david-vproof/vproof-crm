/**
 * Client de l'API de FactuSol / DELSOL (https://apidoc.sdelsol.com).
 *
 * L'API retorna cada fila com un array de parells {columna, dato} en comptes
 * d'un objecte JSON, així que tot passa per `aplanaFila()` abans de sortir.
 */
import "server-only";

import { ErrorFactusol } from "./errors";

const URL_PER_DEFECTE = "https://api.sdelsol.com";

type Cella = { columna: string; dato: unknown };
type Resposta<T> = { resultado: T; respuesta: string };

export type Credencials = {
  codiFabricant: number;
  codiClient: number;
  baseDades: string;
  /** En clar: es codifica en Base64 en autenticar, tal com demana l'API. */
  contrasenya: string;
  exercici: string;
  urlApi: string;

};

/**
 * Les credencials surten de l'entorn del servei, amb els noms curts
 * (`api_*`) del fitxer .env. Els noms antics `FACTUSOL_*` encara valen com a
 * alternativa per als desplegaments que ja els tinguin.
 *
 * `api_ejercicio` admet el marcador `<year>` per no haver de tocar el fitxer
 * cada canvi d'any.
 */
export function obtenirCredencials(): Credencials | null {
  const env = process.env;
  const fabricant = env.api_fabricante ?? env.FACTUSOL_CODIGO_FABRICANTE;
  const client = env.api_cliente ?? env.FACTUSOL_CODIGO_CLIENTE;
  const baseDades = env.api_db ?? env.FACTUSOL_BASE_DATOS;
  const contrasenya = env.api_password ?? env.FACTUSOL_PASSWORD;
  if (!fabricant || !client || !baseDades || !contrasenya) {
    return null;
  }
  return {
    codiFabricant: Number(fabricant),
    codiClient: Number(client),
    baseDades: baseDades.trim(),
    contrasenya,
    exercici: resolExercici(env.api_ejercicio ?? env.FACTUSOL_EJERCICIO),
    urlApi: (env.api_url ?? env.FACTUSOL_BASE_URL ?? URL_PER_DEFECTE).trim().replace(/\/+$/, ""),
  };
}

function resolExercici(valor?: string) {
  const net = (valor ?? "").trim();
  if (!net || net.toLowerCase() === "<year>") return String(new Date().getFullYear());
  return net;
}

/**
 * El testimoni és temporal. Es desa en memòria del procés i es renova per
 * caducitat estimada, quan l'API respon "Unauthorized" o quan canvien les
 * credencials.
 */
let memoriaToken: { valor: string; expira: number; empremta: string } | null = null;
const VIDA_TOKEN_MS = 20 * 60 * 1000;

function empremta(cred: Credencials) {
  return `${cred.urlApi}|${cred.codiFabricant}|${cred.codiClient}|${cred.baseDades}|${cred.contrasenya}|${cred.exercici}`;
}

/** Descarta el testimoni en desar una configuració nova. */
export function reiniciaToken() {
  memoriaToken = null;
}

/**
 * Quant s'espera una resposta. L'API de DELSOL deixa penjada una petició de
 * tant en tant, sigui quina sigui la consulta, i el seu gateway la talla als
 * 120 s amb un 503 en HTML; a més, després d'això el testimoni de sessió ja no
 * val. Les consultes grans (F_LAL sencera, 8 MB) triguen uns 3 s: val més
 * tallar abans i tornar-ho a provar amb una connexió nova.
 */
const ESPERA_MS = Number(process.env.FACTUSOL_ESPERA_MS ?? 45_000);
/** Quants cops es prova una lectura abans de donar-la per fallida. Són totes SELECT: repetir-les no fa cap mal. */
const INTENTS = 3;
const ESPERA_ENTRE_INTENTS_MS = 1_000;

async function demana(cred: Credencials, ruta: string, opcions: RequestInit) {
  try {
    return await fetch(`${cred.urlApi}${ruta}`, { ...opcions, cache: "no-store", signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (causa) {
    const error = causa as Error;
    const nom = ruta.split("/").pop();
    throw new ErrorFactusol(
      "xarxa",
      error.name === "TimeoutError"
        ? `L'API de FactuSol no ha respost en ${Math.round(ESPERA_MS / 1000)} s (${nom}).`
        : `No s'ha pogut contactar amb ${cred.urlApi}: ${error.message}`,
    );
  }
}

async function autentica(cred: Credencials): Promise<string> {
  const resposta = await demana(cred, "/login/Autenticar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigoFabricante: cred.codiFabricant,
      codigoCliente: cred.codiClient,
      baseDatosCliente: cred.baseDades,
      password: Buffer.from(cred.contrasenya, "utf8").toString("base64"),
    }),
  });

  if (!resposta.ok) {
    throw new ErrorFactusol("autenticacio", `Autenticar ha respost HTTP ${resposta.status}`);
  }

  const dades = await cosJson<Resposta<string>>(resposta, "Autenticar");
  if (dades.respuesta !== "OK" || !dades.resultado) {
    throw new ErrorFactusol("autenticacio", `L'API ha rebutjat les credencials: ${dades.respuesta || "sense detall"}`);
  }

  memoriaToken = { valor: dades.resultado, expira: Date.now() + VIDA_TOKEN_MS, empremta: empremta(cred) };
  return dades.resultado;
}

async function obtenirToken(cred: Credencials, forcar = false): Promise<string> {
  const vigent = memoriaToken && memoriaToken.expira > Date.now() && memoriaToken.empremta === empremta(cred);
  if (!forcar && vigent) return memoriaToken!.valor;
  return autentica(cred);
}

/**
 * El cos JSON d'una resposta de l'API. Quan l'API cau, o un intermediari la
 * talla per temps, el que arriba és una pàgina HTML: es diu clar i amb el codi
 * HTTP, en comptes d'un «Unexpected token <» que no explica res.
 */
async function cosJson<T>(resposta: Response, nom: string): Promise<T> {
  const text = await resposta.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const resum = text.trim().replace(/\s+/g, " ").slice(0, 60);
    throw new ErrorFactusol(
      resposta.status >= 500 ? "xarxa" : "consulta",
      `${nom} ha respost HTTP ${resposta.status} sense JSON${resum ? ` («${resum}…»)` : ""}: ` +
        "l'API de FactuSol no està disponible o ha tallat la petició.",
      { passatger: true },
    );
  }
}

/** Converteix [{columna,dato}, ...] en un objecte pla. */
function aplanaFila<T>(fila: Cella[]): T {
  return Object.fromEntries(fila.map((cella) => [cella.columna, cella.dato])) as T;
}

const espera = (ms: number) => new Promise<void>((resol) => setTimeout(resol, ms));

/**
 * Una crida de l'API que torna files, com LanzarConsulta o ArticulosImagen.
 * Si falla per una cosa passatgera (la petició penjada, un 503 del gateway, la
 * xarxa) es torna a provar fins a `INTENTS` cops; l'autenticació hi va a dins,
 * perquè després d'un tall el testimoni ja no val.
 */
export async function demanaFiles<T>(cred: Credencials, ruta: string, cos: Record<string, unknown>): Promise<T[]> {
  for (let intent = 1; ; intent += 1) {
    try {
      return await demanaFilesUnCop<T>(cred, ruta, cos);
    } catch (error) {
      if (!(error instanceof ErrorFactusol) || !error.passatger || intent >= INTENTS) {
        if (error instanceof ErrorFactusol && error.passatger) error.message += ` Provat ${intent} cops.`;
        throw error;
      }
      // Al registre del servidor, perquè es vegi quant sovint passa.
      console.warn(`[factusol] ${ruta.split("/").pop()}: ${error.message} Es torna a provar (${intent + 1} de ${INTENTS}).`);
      // El testimoni pot haver caigut amb la petició: es demana de nou.
      memoriaToken = null;
      await espera(ESPERA_ENTRE_INTENTS_MS * intent);
    }
  }
}

/**
 * Un intent. Reintenta un cop si el testimoni ha caducat, que és la causa
 * habitual d'un "Unauthorized".
 */
async function demanaFilesUnCop<T>(cred: Credencials, ruta: string, cos: Record<string, unknown>): Promise<T[]> {
  const executa = async (token: string) =>
    demana(cred, ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(cos),
    });

  const nom = ruta.split("/").pop() ?? ruta;
  let resposta = await executa(await obtenirToken(cred));
  let dades = await cosJson<Resposta<Cella[][]>>(resposta, nom);

  if (dades.respuesta === "Unauthorized") {
    memoriaToken = null;
    resposta = await executa(await obtenirToken(cred, true));
    dades = await cosJson<Resposta<Cella[][]>>(resposta, nom);
  }

  if (dades.respuesta !== "OK") {
    throw new ErrorFactusol("consulta", `${nom} ha retornat "${dades.respuesta || "sense detall"}"`);
  }

  return (dades.resultado ?? []).map((fila) => aplanaFila<T>(fila));
}

/** Llança un SELECT contra l'API. */
export async function llancaConsulta<T>(cred: Credencials, consulta: string): Promise<T[]> {
  return demanaFiles<T>(cred, "/admin/LanzarConsulta", { ejercicio: cred.exercici, consulta });
}

/** Escapa cometes simples per interpolar un valor dins del SQL. */
export function escapaSql(valor: string) {
  return valor.replace(/'/g, "''");
}
