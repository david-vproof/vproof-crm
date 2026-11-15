/**
 * Les columnes per les quals s'ordenen els llistats de l'ERP: Clients (F_CLI
 * en directe), Laboratoris i Articles (la còpia de la base de dades). Cada llistat diu
 * quines columnes té i com s'hi ordena: a memòria, amb una clau per fila, o a
 * La base de dades, amb el nom del camp.
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

// ------------------------------------------------------------------ laboratoris

export const COLUMNES_LABORATORIS: ColumnaOrdenable[] = [
  { camp: "codi", etiqueta: "Codi" },
  { camp: "laboratori", etiqueta: "Laboratori" },
  { camp: "nif", etiqueta: "NIF" },
  { camp: "poblacio", etiqueta: "Població" },
  { camp: "estat", etiqueta: "Estat" },
];

/** El camp de `crm_proveidors` pel qual la base de dades ordena cada columna. */
export const CAMPS_ORDRE_LABORATORIS: Record<string, string> = {
  codi: "codi_erp",
  laboratori: "nom_comercial",
  nif: "nif",
  poblacio: "poblacio",
  estat: "estat",
};

// ---------------------------------------------------------------- productes

export const COLUMNES_ARTICLES: ColumnaOrdenable[] = [
  { camp: "article", etiqueta: "Producte" },
  { camp: "tipus", etiqueta: "Categoria" },
  { camp: "especie", etiqueta: "Espècie" },
  { camp: "prescripcio", etiqueta: "Prescripció" },
  { camp: "format", etiqueta: "Format" },
];

/** Els productes també es llegeixen tots d'un cop: s'ordenen a memòria, amb el que es veu a cada columna. */
export const CLAUS_ORDRE_ARTICLES: Record<string, ClauDOrdre<ArticleDeCataleg>> = {
  article: (a) => a.nom,
  tipus: (a) => nomDeTipus(a.familia),
  // L'espècie porta la forma a sota: a igual espècie, per forma.
  especie: (a) => [a.camp_programable_1?.trim(), a.camp_programable_2?.trim()].filter(Boolean).join(" · "),
  prescripcio: (a) => a.camp_programable_4,
  format: (a) => nomDeFormat(a.camp_programable_5),
};

export const NOM_ARTICLE: ClauDOrdre<ArticleDeCataleg> = (a) => a.nom;
