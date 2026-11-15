/**
 * Client de l'API REST de vprooferp, que és un ERPNext (Frappe).
 *
 * Només llegeix. S'autentica amb la clau d'API d'un usuari de l'ERP
 * (`Authorization: token clau:secret`). Quan el CRM corre a la mateixa VM que
 * l'ERP, hi parla per la xarxa interna de Docker: l'adreça és la del
 * contenidor del frontend de l'ERP i el lloc (el site de Frappe) va a la
 * capçalera Host. Per això es fa servir `node:http` i no `fetch`, que no deixa
 * canviar el Host.
 *
 * La connexió es desa a Configuració (vegeu `serveis/erp.ts`) i, si no, surt de
 * l'entorn: VPROOFERP_URL, VPROOFERP_API_KEY, VPROOFERP_API_SECRET i,
 * opcionalment, VPROOFERP_HOST (el nom del site, si l'adreça no ho és).
 */
import "server-only";

import http from "node:http";
import https from "node:https";

export type ConfigErp = { url: URL; host: string | null; clau: string; secret: string };

/** Les dades d'una connexió, tal com es desen o arriben de l'entorn. */
export type DadesConnexio = { url: string | null; host: string | null; clau: string | null; secret: string | null };

export class ErrorErp extends Error {
  constructor(
    missatge: string,
    readonly estat?: number,
  ) {
    super(missatge);
    this.name = "ErrorErp";
  }
}

/** El que diu l'entorn del servei: VPROOFERP_URL, VPROOFERP_HOST, VPROOFERP_API_KEY i VPROOFERP_API_SECRET. */
export function connexioDeLEntorn(): DadesConnexio {
  const valor = (nom: string) => process.env[nom]?.trim() || null;
  return { url: valor("VPROOFERP_URL"), host: valor("VPROOFERP_HOST"), clau: valor("VPROOFERP_API_KEY"), secret: valor("VPROOFERP_API_SECRET") };
}

/** Una connexió a punt per fer servir, o null si falta res o l'adreça no és vàlida. */
export function configDe(dades: DadesConnexio): ConfigErp | null {
  if (!dades.url || !dades.clau || !dades.secret) return null;
  try {
    return { url: new URL(dades.url), host: dades.host || null, clau: dades.clau, secret: dades.secret };
  } catch {
    return null;
  }
}

const ESPERA_MS = 60_000;

function peticio(config: ConfigErp, cami: string): Promise<{ estat: number; cos: Buffer; tipus: string }> {
  const adreca = new URL(cami, config.url);
  const client = adreca.protocol === "https:" ? https : http;
  return new Promise((resol, rebutja) => {
    const req = client.request(
      adreca,
      {
        method: "GET",
        headers: {
          Authorization: `token ${config.clau}:${config.secret}`,
          Accept: "application/json",
          ...(config.host ? { Host: config.host } : {}),
        },
        timeout: ESPERA_MS,
      },
      (res) => {
        const trossos: Buffer[] = [];
        res.on("data", (tros: Buffer) => trossos.push(tros));
        res.on("end", () => resol({ estat: res.statusCode ?? 0, cos: Buffer.concat(trossos), tipus: String(res.headers["content-type"] ?? "") }));
        res.on("error", rebutja);
      },
    );
    req.on("timeout", () => req.destroy(new ErrorErp(`L'ERP no ha respost en ${ESPERA_MS / 1000} segons.`)));
    req.on("error", (error) => rebutja(error instanceof ErrorErp ? error : new ErrorErp(`No s'ha pogut contactar amb l'ERP: ${error.message}`)));
    req.end();
  });
}

async function json<T>(config: ConfigErp, cami: string): Promise<T> {
  const { estat, cos } = await peticio(config, cami);
  const text = cos.toString("utf8");
  if (estat < 200 || estat >= 300) {
    let detall = text.slice(0, 300);
    try {
      const error = JSON.parse(text) as { exception?: string; exc_type?: string; message?: string; _server_messages?: string };
      detall = error.exception ?? error.message ?? error.exc_type ?? detall;
    } catch {
      // No era JSON: es diu tal qual.
    }
    // Frappe posa etiquetes HTML als missatges («Permiso insuficiente para <strong>Item Price</strong>»).
    throw new ErrorErp(`L'ERP ha respost HTTP ${estat} a ${decodeURIComponent(cami.split("?")[0])}: ${detall.replace(/<[^>]+>/g, "")}`, estat);
  }
  return JSON.parse(text) as T;
}

/** Qui és l'usuari de la clau: serveix per provar la connexió. */
export async function usuariConnectat(config: ConfigErp): Promise<string> {
  const { message } = await json<{ message: string }>(config, "/api/method/frappe.auth.get_logged_user");
  return message;
}

const PER_PAGINA = 500;

/**
 * Totes les files d'un doctype, pàgina a pàgina. `pare` és per a les taules
 * filles (les línies d'un albarà, els comercials d'un client): Frappe demana
 * de quin doctype penjen.
 */
export async function llistaTot<T>(
  config: ConfigErp,
  doctype: string,
  opcions: { camps: string[]; filtres?: unknown[]; pare?: string; ordre?: string },
): Promise<T[]> {
  const files: T[] = [];
  for (let inici = 0; ; inici += PER_PAGINA) {
    const parametres = new URLSearchParams({
      fields: JSON.stringify(opcions.camps),
      limit_start: String(inici),
      limit_page_length: String(PER_PAGINA),
      order_by: opcions.ordre ?? "name asc",
    });
    if (opcions.filtres?.length) parametres.set("filters", JSON.stringify(opcions.filtres));
    if (opcions.pare) parametres.set("parent", opcions.pare);
    const { data } = await json<{ data?: T[] }>(config, `/api/resource/${encodeURIComponent(doctype)}?${parametres}`);
    files.push(...(data ?? []));
    if (!data || data.length < PER_PAGINA) return files;
  }
}

/** Un fitxer de l'ERP (la foto d'un article), amb el seu tipus. */
export async function baixaFitxer(config: ConfigErp, cami: string): Promise<{ dades: Buffer; tipus: string }> {
  const { estat, cos, tipus } = await peticio(config, encodeURI(cami));
  if (estat !== 200) throw new ErrorErp(`L'ERP ha respost HTTP ${estat} a ${cami}.`, estat);
  return { dades: cos, tipus: tipus.split(";")[0] || "application/octet-stream" };
}
