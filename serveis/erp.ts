/**
 * La connexió amb l'ERP, vprooferp (un ERPNext): on és, amb quina clau s'hi
 * entra i cada quan se sincronitza. La sincronització mateixa és a
 * `serveis/erp-sincro.ts`.
 *
 * Es desa a Configuració (taula `crm_connexio_erp`) i la canvia l'administrador.
 * El que no s'hi ha posat surt de l'entorn del servei (VPROOFERP_*): així el
 * desplegament a la VM de l'ERP pot deixar l'adreça interna ja posada i només
 * cal afegir-hi la clau. El secret no surt mai cap al navegador.
 */
import "server-only";

import { desaSingleton, llegeixSingleton } from "@/apis/sqlite/crm";
import { configDe, connexioDeLEntorn, usuariConnectat, type ConfigErp } from "@/apis/vprooferp";

const TAULA = "crm_connexio_erp";

type FilaConnexio = {
  url: string | null;
  host: string | null;
  api_key: string | null;
  api_secret: string | null;
  llista_preus: string | null;
  minuts: number | null;
};

const MINUTS_PER_DEFECTE = 30;

async function llegeixFila(): Promise<FilaConnexio | null> {
  try {
    return await llegeixSingleton<FilaConnexio>(TAULA, ["url", "host", "api_key", "api_secret", "llista_preus", "minuts"]);
  } catch {
    return null;
  }
}

const net = (valor: string | null | undefined) => valor?.trim() || null;

/** Tot el que cal per connectar i sincronitzar: el desat, i el que falti, de l'entorn. */
export async function configuracioErp(): Promise<{ config: ConfigErp | null; llistaPreus: string | null; minuts: number }> {
  const fila = await llegeixFila();
  const entorn = connexioDeLEntorn();
  const config = configDe({
    url: net(fila?.url) ?? entorn.url,
    host: net(fila?.host) ?? entorn.host,
    clau: net(fila?.api_key) ?? entorn.clau,
    secret: net(fila?.api_secret) ?? entorn.secret,
  });
  const minutsEntorn = Number(process.env.VPROOFERP_SINCRO_MINUTS);
  const minuts = fila?.minuts ?? (Number.isFinite(minutsEntorn) && process.env.VPROOFERP_SINCRO_MINUTS ? minutsEntorn : MINUTS_PER_DEFECTE);
  return {
    config,
    llistaPreus: net(fila?.llista_preus) ?? net(process.env.VPROOFERP_LLISTA_PREUS),
    minuts: Math.max(0, Math.trunc(minuts)),
  };
}

/** El que ensenya el formulari de Configuració: mai el secret, només si n'hi ha. */
export type ConnexioPerAlFormulari = {
  url: string;
  host: string;
  clau: string;
  teSecret: boolean;
  llistaPreus: string;
  minuts: number;
  /** D'on surt cada valor que no s'ha desat: l'entorn del servei. */
  deLEntorn: { url: boolean; host: boolean; clau: boolean; secret: boolean };
};

export async function connexioPerAlFormulari(): Promise<ConnexioPerAlFormulari> {
  const fila = await llegeixFila();
  const entorn = connexioDeLEntorn();
  const { minuts, llistaPreus } = await configuracioErp();
  return {
    url: net(fila?.url) ?? entorn.url ?? "",
    host: net(fila?.host) ?? entorn.host ?? "",
    clau: net(fila?.api_key) ?? entorn.clau ?? "",
    teSecret: Boolean(net(fila?.api_secret) ?? entorn.secret),
    llistaPreus: llistaPreus ?? "",
    minuts,
    deLEntorn: {
      url: !net(fila?.url) && Boolean(entorn.url),
      host: !net(fila?.host) && Boolean(entorn.host),
      clau: !net(fila?.api_key) && Boolean(entorn.clau),
      secret: !net(fila?.api_secret) && Boolean(entorn.secret),
    },
  };
}

export class ErrorConnexioErp extends Error {}

export type CanvisConnexio = {
  url: string;
  host: string;
  clau: string;
  /** Buit, es queda el que hi havia. */
  secret: string;
  llistaPreus: string;
  minuts: number;
};

/** Desa la connexió. El secret només es canvia si n'arriba un de nou. */
export async function desaConnexioErp(canvis: CanvisConnexio) {
  const url = canvis.url.trim();
  if (url) {
    try {
      const adreca = new URL(url);
      if (adreca.protocol !== "http:" && adreca.protocol !== "https:") throw new Error();
    } catch {
      throw new ErrorConnexioErp("L'adreça ha de començar per http:// o https://.");
    }
  }
  if (!Number.isFinite(canvis.minuts) || canvis.minuts < 0 || canvis.minuts > 24 * 60) {
    throw new ErrorConnexioErp("Els minuts entre sincronitzacions han de ser entre 0 (aturada) i 1440.");
  }
  await desaSingleton(TAULA, {
    url: url || null,
    host: canvis.host.trim() || null,
    api_key: canvis.clau.trim() || null,
    ...(canvis.secret.trim() ? { api_secret: canvis.secret.trim() } : {}),
    llista_preus: canvis.llistaPreus.trim() || null,
    minuts: Math.trunc(canvis.minuts),
  });
}

/** Prova la connexió que hi ha ara: torna l'usuari de l'ERP amb qui s'entra. */
export async function provaConnexioErp(): Promise<string> {
  const { config } = await configuracioErp();
  if (!config) throw new ErrorConnexioErp("Falta l'adreça, la clau o el secret d'API.");
  return usuariConnectat(config);
}

export type EstatErp = { connectat: boolean; minuts: number; missatge: string };

export async function estatErp(): Promise<EstatErp> {
  const { config, minuts } = await configuracioErp();
  if (!config) {
    return {
      connectat: false,
      minuts,
      missatge: "El CRM encara no té connexió amb vprooferp: falta l'adreça, la clau o el secret d'API. Es posen aquí sota.",
    };
  }
  return {
    connectat: true,
    minuts,
    missatge:
      `El CRM llegeix vprooferp (${config.host ?? config.url.host})` +
      (minuts > 0 ? ` i se sincronitza sol cada ${minuts} minuts.` : ". La sincronització automàtica està aturada."),
  };
}
