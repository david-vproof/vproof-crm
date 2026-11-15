/**
 * La base de dades del portal: un fitxer SQLite.
 *
 * S'obre un cop per procés i, en obrir-la, es posa al dia amb el model
 * (`model.ts`): es creen les taules que falten i s'hi afegeixen les columnes
 * noves. No s'esborra mai res: una columna que ja no és al model s'hi queda.
 * També s'hi posen les dades de partida si la taula és buida: els rols, el
 * primer administrador, els tipus d'activitat, els tipus de client i les
 * franges de categoria.
 *
 * El fitxer és a `SQLITE_RUTA` (per defecte `dades/vproof-crm.sqlite`); al
 * costat, a `fitxers/`, hi van les fotos i els documents que s'hi pugen.
 */
import "server-only";

import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import Database from "better-sqlite3";

import { TIPUS_BASE } from "@/domini/crm-tipus-activitat";

import { MODEL, type DefinicioCamp } from "./model";
import { xifraContrasenya } from "./contrasenyes";

export type BaseDades = Database.Database;

/** On viu el fitxer. Relatiu, és respecte del directori on s'arrenca el portal. */
export const RUTA_BD = path.resolve(process.env.SQLITE_RUTA ?? path.join("dades", "vproof-crm.sqlite"));
/** On es desen els fitxers pujats (fotos d'activitats i de productes). */
export const DIR_FITXERS = path.join(path.dirname(RUTA_BD), "fitxers");

const TIPUS_SQL: Record<DefinicioCamp["tipus"], string> = {
  text: "TEXT",
  json: "TEXT",
  enter: "INTEGER",
  decimal: "REAL",
  boolea: "INTEGER",
  data: "TEXT",
  instant: "TEXT",
  uuid: "TEXT",
};

const q = (nom: string) => `"${nom.replace(/"/g, '""')}"`;

function valorPerDefecte(camp: DefinicioCamp) {
  if (camp.perDefecte === undefined) return "";
  const valor = camp.perDefecte;
  if (typeof valor === "boolean") return ` DEFAULT ${valor ? 1 : 0}`;
  if (typeof valor === "number") return ` DEFAULT ${valor}`;
  // Els enters i els decimals del model de la base de dades arribaven a vegades com a text («100»).
  if ((camp.tipus === "enter" || camp.tipus === "decimal") && Number.isFinite(Number(valor))) return ` DEFAULT ${Number(valor)}`;
  return ` DEFAULT '${String(valor).replace(/'/g, "''")}'`;
}

function definicioColumna(nom: string, camp: DefinicioCamp) {
  let sql = `${q(nom)} ${TIPUS_SQL[camp.tipus]}${valorPerDefecte(camp)}`;
  if (camp.m2o) sql += ` REFERENCES ${q(camp.m2o)}(id) ON DELETE ${camp.enEsborrar === "CASCADE" ? "CASCADE" : "SET NULL"}`;
  return sql;
}

/** Crea el que falta del model. Idempotent: es pot fer a cada arrencada. */
function posaAlDia(bd: BaseDades) {
  for (const [taula, definicio] of Object.entries(MODEL)) {
    const columnes = Object.entries(definicio.camps).map(([nom, camp]) => definicioColumna(nom, camp));
    bd.exec(`CREATE TABLE IF NOT EXISTS ${q(taula)} (id TEXT PRIMARY KEY NOT NULL${columnes.length ? `, ${columnes.join(", ")}` : ""})`);

    const existents = new Set((bd.prepare(`PRAGMA table_info(${q(taula)})`).all() as { name: string }[]).map((c) => c.name));
    for (const [nom, camp] of Object.entries(definicio.camps)) {
      if (!existents.has(nom)) bd.exec(`ALTER TABLE ${q(taula)} ADD COLUMN ${definicioColumna(nom, camp)}`);
    }
    for (const [nom, camp] of Object.entries(definicio.camps)) {
      if (camp.unic) bd.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${q(`ux_${taula}_${nom}`)} ON ${q(taula)}(${q(nom)})`);
      else if (camp.m2o || camp.index) bd.exec(`CREATE INDEX IF NOT EXISTS ${q(`ix_${taula}_${nom}`)} ON ${q(taula)}(${q(nom)})`);
    }
  }
}

const ROLS_DE_PARTIDA = [
  { name: "Administrator", description: "Ho veu tot i administra els usuaris.", icon: "verified" },
  { name: "Manager", description: "Veu els clients de tothom, sense administrar res.", icon: "supervisor_account" },
  { name: "Comercial", description: "Veu els clients del seu agent.", icon: "badge" },
];

/** Els tipus de client d'una distribuïdora de producte sanitari veterinari. Es canvien a Configuració › Tipus de client. */
const TIPUS_CLIENT_DE_PARTIDA = [
  "Clínica veterinària",
  "Hospital veterinari",
  "Botiga d'animals",
  "Explotació ramadera",
  "Distribuïdor",
  "Altres",
];

/** Les dades sense les quals el portal no arrenca bé. Només s'hi posen si la taula és buida. */
function dadesDePartida(bd: BaseDades) {
  const buida = (taula: string) => (bd.prepare(`SELECT COUNT(*) AS n FROM ${q(taula)}`).get() as { n: number }).n === 0;
  const ara = new Date().toISOString();

  if (buida("rols")) {
    const insereix = bd.prepare("INSERT INTO rols (id, name, description, icon) VALUES (?, ?, ?, ?)");
    for (const rol of ROLS_DE_PARTIDA) insereix.run(randomUUID(), rol.name, rol.description, rol.icon);
  }

  if (buida("usuaris")) {
    const correu = (process.env.PORTAL_USUARI ?? "admin@vproof.local").trim().toLowerCase();
    const contrasenya = process.env.PORTAL_CONTRASENYA ?? "admin";
    const rol = bd.prepare("SELECT id FROM rols WHERE name = 'Administrator'").get() as { id: string } | undefined;
    bd.prepare("INSERT INTO usuaris (id, email, first_name, last_name, password, status, role) VALUES (?, ?, ?, ?, ?, 'active', ?)").run(
      randomUUID(), correu, "Administrador", null, xifraContrasenya(contrasenya), rol?.id ?? null,
    );
    if (!process.env.PORTAL_CONTRASENYA) {
      console.warn(`[sqlite] S'ha creat l'usuari «${correu}» amb la contrasenya per defecte. Canvia-la a «El meu compte».`);
    }
  }

  if (buida("crm_tipus_activitat")) {
    const insereix = bd.prepare(
      "INSERT INTO crm_tipus_activitat (id, nom, valor, visita, amb_productes, amb_laboratori, actiu, ordre, date_created) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    );
    TIPUS_BASE.forEach((tipus, i) =>
      insereix.run(randomUUID(), tipus.nom, tipus.valor, tipus.visita ? 1 : 0, tipus.ambProductes ? 1 : 0, tipus.ambLaboratori ? 1 : 0, (i + 1) * 10, ara),
    );
  }

  if (buida("crm_tipus_client")) {
    const insereix = bd.prepare("INSERT INTO crm_tipus_client (id, nom, codi_erp, usat_crm, font, date_created) VALUES (?, ?, ?, 1, 'portal', ?)");
    TIPUS_CLIENT_DE_PARTIDA.forEach((nom, i) => insereix.run(randomUUID(), nom, i + 1, ara));
  }

  if (buida("crm_categories")) {
    const insereix = bd.prepare("INSERT INTO crm_categories (id, lletra, des_de, date_created) VALUES (?, ?, ?, ?)");
    for (const [lletra, desDe] of [["E", 0], ["D", 1500], ["C", 2500], ["B", 5000], ["A", 7500]] as const) {
      insereix.run(randomUUID(), lletra, desDe, ara);
    }
  }
}

let oberta: BaseDades | null = null;

/** La connexió del procés. La primera crida crea el fitxer i el posa al dia. */
export function bd(): BaseDades {
  if (oberta) return oberta;
  mkdirSync(path.dirname(RUTA_BD), { recursive: true });
  mkdirSync(DIR_FITXERS, { recursive: true });

  const nova = new Database(RUTA_BD);
  nova.pragma("journal_mode = WAL");
  nova.pragma("foreign_keys = ON");
  nova.pragma("busy_timeout = 5000");
  // Minúscules i sense accents per a les cerques: el lower() de SQLite només entén l'ASCII.
  nova.function("pla", { deterministic: true }, (valor: unknown) =>
    valor === null || valor === undefined ? null : String(valor).normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ca"),
  );
  nova.function("minuscules", { deterministic: true }, (valor: unknown) =>
    valor === null || valor === undefined ? null : String(valor).toLocaleLowerCase("ca"),
  );

  nova.transaction(() => {
    posaAlDia(nova);
    dadesDePartida(nova);
  })();
  oberta = nova;
  return nova;
}
