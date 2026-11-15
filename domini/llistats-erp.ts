/**
 * Les columnes per les quals s'ordenen els llistats de l'ERP: Clients (F_CLI
 * en directe), Cellers i Articles (la còpia de Directus). Cada llistat diu
 * quines columnes té i com s'hi ordena: a memòria, amb una clau per fila, o a
 * Directus, amb el nom del camp.
 */
import { type ArticleDeCataleg, nomDeFormat, nomDeTipus } from "./cataleg-articles";
import type { ClauDOrdre, ColumnaOrdenable } from "./ordre-llistat";
import type { Client } from "./tipus";

// ------------------------------------------------------------------ clients

export const COLUMNES_CLIENTS_ERP: ColumnaOrdenable[] = [
  { camp: "codi", etiqueta: "Codi" },
  { camp: "client", etiqueta: "Client" },
  { camp: "nif", etiqueta: "NIF" },
  { camp: "poblacio", etiqueta: "Població" },
  { camp: "estat", etiqueta: "Estat" },
];

/** L'API de DELSOL torna la taula sencera i sense paginar: s'ordena aquí. */
export const CLAUS_ORDRE_CLIENTS_ERP: Record<string, ClauDOrdre<Client>> = {
  codi: (c) => c.CODCLI,
  client: (c) => c.NOFCLI,
  nif: (c) => c.NIFCLI,
  // A igual població, per província: així «Sant Pere» de dues províncies no es barreja.
  poblacio: (c) => [c.POBCLI?.trim(), c.PROCLI?.trim()].filter(Boolean).join(" · "),
  estat: (c) => c.ESTCLI,
};

export const CODI_CLIENT_ERP: ClauDOrdre<Client> = (c) => c.CODCLI;

// ------------------------------------------------------------------ cellers

export const COLUMNES_CELLERS: ColumnaOrdenable[] = [
  { camp: "codi", etiqueta: "Codi" },
  { camp: "celler", etiqueta: "Celler" },
  { camp: "nif", etiqueta: "NIF" },
  { camp: "poblacio", etiqueta: "Població" },
  { camp: "estat", etiqueta: "Estat" },
];

/** El camp de `crm_proveidors` pel qual Directus ordena cada columna. */
export const CAMPS_ORDRE_CELLERS: Record<string, string> = {
  codi: "codi_erp",
  celler: "nom_comercial",
  nif: "nif",
  poblacio: "poblacio",
  estat: "estat",
};

// ----------------------------------------------------------------- articles

export const COLUMNES_ARTICLES: ColumnaOrdenable[] = [
  { camp: "article", etiqueta: "Article" },
  { camp: "tipus", etiqueta: "Tipus" },
  { camp: "regio", etiqueta: "Regió" },
  { camp: "anyada", etiqueta: "Anyada" },
  { camp: "format", etiqueta: "Format" },
];

/** Els articles també es llegeixen tots d'un cop: s'ordenen a memòria, amb el que es veu a cada columna. */
export const CLAUS_ORDRE_ARTICLES: Record<string, ClauDOrdre<ArticleDeCataleg>> = {
  article: (a) => a.nom,
  tipus: (a) => nomDeTipus(a.familia),
  // La regió porta la zona a sota: a igual regió, per zona.
  regio: (a) => [a.camp_programable_4?.trim(), a.camp_programable_3?.trim()].filter(Boolean).join(" · "),
  anyada: (a) => a.camp_programable_2,
  format: (a) => nomDeFormat(a.camp_programable_5),
};

export const NOM_ARTICLE: ClauDOrdre<ArticleDeCataleg> = (a) => a.nom;
