/**
 * El motor de consultes del portal sobre SQLite.
 *
 * Entén el mateix llenguatge de consulta que feia servir el portal quan les
 * dades eren a la base de dades (`/items/<taula>?fields=…&filter=…&sort=…`), perquè
 * tots els serveis el parlen: camps amb punt que travessen relacions
 * (`client.nom_comercial`, `linies.article.nom`), filtres en JSON amb `_and`,
 * `_or` i els operadors `_eq`, `_in`, `_null`, `_icontains`…, també sobre
 * taules relacionades, ordres, límits, recomptes (`meta=filter_count`) i
 * agregats (`aggregate[count]=id&groupBy[]=client`). Torna una `Response` amb
 * el mateix cos (`{ data, meta }`) que tornava la base de dades.
 *
 * Les relacions surten de `model.ts`. Un camp o una taula que no hi és dona un
 * error, no un buit: així un error de programació es veu de seguida.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { bd } from "./bd";
import { MODEL, type DefinicioCamp, type DefinicioTaula } from "./model";
import { esborraFitxerDelDisc, llegeixFitxerDelDisc, pujaFitxerAlDisc } from "./fitxers";

type Fila = Record<string, unknown>;
type Valor = string | number | bigint | null | Buffer;

/** Els camins de l'API de la base de dades que tenien taula pròpia. */
const TAULES_DE_SISTEMA: Record<string, string> = { users: "usuaris", roles: "rols", files: "fitxers", folders: "carpetes" };
/** Camps que no surten mai en una lectura, encara que es demani `*`. */
const CAMPS_OCULTS = new Set(["password"]);
const AUDITORIA = ["date_created", "date_updated"] as const;

export class ErrorConsulta extends Error {
  constructor(
    readonly estat: number,
    missatge: string,
    readonly codi = "INVALID_QUERY",
  ) {
    super(missatge);
  }
}

const q = (nom: string) => `"${nom.replace(/"/g, '""')}"`;

function taula(nom: string): DefinicioTaula {
  const definicio = MODEL[nom];
  if (!definicio) throw new ErrorConsulta(404, `La taula «${nom}» no existeix.`, "ROUTE_NOT_FOUND");
  return definicio;
}

function campDesconegut(colleccio: string, camp: string): never {
  // El mateix text que donava Directus, perquè qui el llegeix (`crm.ts`) en sap treure el camp.
  throw new ErrorConsulta(403, `You don't have permission to access field "${camp}" in collection "${colleccio}" or it does not exist.`, "FORBIDDEN");
}

function definicioCamp(colleccio: string, camp: string): DefinicioCamp | "id" {
  if (camp === "id") return "id";
  const definicio = taula(colleccio).camps[camp];
  if (!definicio) campDesconegut(colleccio, camp);
  return definicio;
}

const o2m = (colleccio: string, camp: string) => taula(colleccio).o2m?.[camp];

// ---------------------------------------------------------------- valors

const DATA_SOLA = /^\d{4}-\d{2}-\d{2}$/;
const SENSE_FUS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** Un instant en ISO amb Z, que és com es desa i, per tant, com es compara. */
function instant(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const text = String(valor);
  const normal = DATA_SOLA.test(text) ? `${text}T00:00:00Z` : SENSE_FUS.test(text) ? `${text}Z` : text;
  const data = new Date(normal);
  return Number.isNaN(data.getTime()) ? text : data.toISOString();
}

/** Un valor tal com es desa a la columna. */
function aColumna(definicio: DefinicioCamp | "id", valor: unknown): Valor {
  if (valor === undefined || valor === null) return null;
  if (definicio === "id") return String(valor);
  switch (definicio.tipus) {
    case "boolea":
      return valor === true || valor === 1 || valor === "1" || valor === "true" ? 1 : 0;
    case "json":
      return typeof valor === "string" ? valor : JSON.stringify(valor);
    case "enter":
    case "decimal": {
      if (valor === "") return null;
      const numero = Number(valor);
      return Number.isFinite(numero) ? (definicio.tipus === "enter" ? Math.trunc(numero) : numero) : null;
    }
    case "instant":
      return instant(valor);
    case "data": {
      const text = String(valor);
      return text === "" ? null : text.length > 10 && /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
    }
    case "uuid":
      return valor === "" ? null : typeof valor === "object" && valor && "id" in valor ? String((valor as { id: unknown }).id) : String(valor);
    default:
      return typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  }
}

/** Un valor tal com surt de la columna cap al portal. */
function deColumna(definicio: DefinicioCamp | "id", valor: unknown): unknown {
  if (valor === null || valor === undefined || definicio === "id") return valor ?? null;
  switch (definicio.tipus) {
    case "boolea":
      return valor === 1 || valor === true || valor === "1";
    case "json":
      try {
        return JSON.parse(String(valor));
      } catch {
        return valor;
      }
    default:
      return valor;
  }
}

/** Un valor d'un filtre, convertit com el de la columna amb què es compara. */
function valorDeFiltre(definicio: DefinicioCamp | "id", valor: unknown): Valor {
  if (definicio !== "id" && definicio.tipus === "instant") return instant(valor);
  if (definicio !== "id" && definicio.tipus === "boolea") return aColumna(definicio, valor);
  if (typeof valor === "boolean") return valor ? 1 : 0;
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number" || typeof valor === "bigint") return valor;
  return String(valor);
}

// ---------------------------------------------------------------- filtres

type Sql = { sql: string; params: Valor[] };
let comptadorAlies = 0;
const nouAlies = () => `t${++comptadorAlies}`;

const OPERADORS = new Set([
  "_eq", "_neq", "_lt", "_lte", "_gt", "_gte", "_in", "_nin", "_null", "_nnull", "_contains", "_ncontains",
  "_icontains", "_nicontains", "_starts_with", "_istarts_with", "_nstarts_with", "_ends_with", "_iends_with", "_nends_with",
  "_between", "_nbetween", "_empty", "_nempty", "_some", "_none",
]);

const esOperador = (clau: string) => OPERADORS.has(clau);

function llistaDe(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor === "string") return valor.split(",");
  return [valor];
}

function operador(columna: string, definicio: DefinicioCamp | "id", op: string, valor: unknown): Sql {
  const v = (x: unknown) => valorDeFiltre(definicio, x);
  const comMotiu = (patro: (text: string) => string, insensible: boolean, nega = false): Sql => ({
    sql: `${nega ? "NOT " : ""}(${insensible ? `minuscules(${columna})` : columna} LIKE ? ESCAPE '\\')`,
    params: [patro(String(valor ?? "").replace(/[\\%_]/g, (c) => `\\${c}`)).toString()].map((p) => (insensible ? p.toLocaleLowerCase("ca") : p)),
  });
  switch (op) {
    case "_eq":
      return valor === null ? { sql: `${columna} IS NULL`, params: [] } : { sql: `${columna} = ?`, params: [v(valor)] };
    case "_neq":
      return valor === null ? { sql: `${columna} IS NOT NULL`, params: [] } : { sql: `${columna} != ?`, params: [v(valor)] };
    case "_lt":
      return { sql: `${columna} < ?`, params: [v(valor)] };
    case "_lte":
      return { sql: `${columna} <= ?`, params: [v(valor)] };
    case "_gt":
      return { sql: `${columna} > ?`, params: [v(valor)] };
    case "_gte":
      return { sql: `${columna} >= ?`, params: [v(valor)] };
    case "_in":
    case "_nin": {
      const valors = llistaDe(valor).map(v);
      if (valors.length === 0) return { sql: op === "_in" ? "0" : "1", params: [] };
      return { sql: `${columna} ${op === "_in" ? "IN" : "NOT IN"} (${valors.map(() => "?").join(", ")})`, params: valors };
    }
    case "_null":
      return { sql: `${columna} ${valor === true || valor === "true" ? "IS NULL" : "IS NOT NULL"}`, params: [] };
    case "_nnull":
      return { sql: `${columna} ${valor === true || valor === "true" ? "IS NOT NULL" : "IS NULL"}`, params: [] };
    case "_empty":
      return { sql: `(${columna} IS NULL OR ${columna} = '')`, params: [] };
    case "_nempty":
      return { sql: `(${columna} IS NOT NULL AND ${columna} != '')`, params: [] };
    case "_contains":
      return { sql: `instr(${columna}, ?) > 0`, params: [String(valor ?? "")] };
    case "_ncontains":
      return { sql: `(${columna} IS NULL OR instr(${columna}, ?) = 0)`, params: [String(valor ?? "")] };
    case "_icontains":
      return comMotiu((t) => `%${t}%`, true);
    case "_nicontains":
      return comMotiu((t) => `%${t}%`, true, true);
    case "_starts_with":
      return comMotiu((t) => `${t}%`, false);
    case "_istarts_with":
      return comMotiu((t) => `${t}%`, true);
    case "_nstarts_with":
      return comMotiu((t) => `${t}%`, false, true);
    case "_ends_with":
      return comMotiu((t) => `%${t}`, false);
    case "_iends_with":
      return comMotiu((t) => `%${t}`, true);
    case "_nends_with":
      return comMotiu((t) => `%${t}`, false, true);
    case "_between":
    case "_nbetween": {
      const [desde, fins] = llistaDe(valor);
      return { sql: `${op === "_nbetween" ? "NOT " : ""}(${columna} BETWEEN ? AND ?)`, params: [v(desde), v(fins)] };
    }
    default:
      throw new ErrorConsulta(400, `L'operador «${op}» no es pot fer servir aquí.`);
  }
}

const uneix = (parts: Sql[], amb: "AND" | "OR"): Sql =>
  parts.length === 0
    ? { sql: amb === "AND" ? "1" : "0", params: [] }
    : { sql: parts.map((p) => `(${p.sql})`).join(` ${amb} `), params: parts.flatMap((p) => p.params) };

/** Un filtre de la base de dades en SQL, sobre la taula `colleccio` amb l'àlies `alies`. */
function compilaFiltre(colleccio: string, alies: string, filtre: unknown): Sql {
  if (!filtre || typeof filtre !== "object") return { sql: "1", params: [] };
  const parts: Sql[] = [];
  for (const [clau, valor] of Object.entries(filtre as Record<string, unknown>)) {
    if (clau === "_and" || clau === "_or") {
      parts.push(uneix((valor as unknown[]).map((sub) => compilaFiltre(colleccio, alies, sub)), clau === "_and" ? "AND" : "OR"));
      continue;
    }
    const condicions = (valor ?? {}) as Record<string, unknown>;
    const relacio = o2m(colleccio, clau);
    if (relacio) {
      // Una relació d'un a molts: «n'hi ha alguna que…» (o «cap», amb _none).
      const fill = nouAlies();
      const nega = "_none" in condicions;
      const interior = condicions._some ?? condicions._none ?? condicions;
      const sub = compilaFiltre(relacio.colleccio, fill, interior);
      parts.push({
        sql: `${nega ? "NOT " : ""}EXISTS (SELECT 1 FROM ${q(relacio.colleccio)} ${fill} WHERE ${fill}.${q(relacio.camp)} = ${alies}.id AND ${sub.sql})`,
        params: sub.params,
      });
      continue;
    }

    const definicio = definicioCamp(colleccio, clau);
    const columna = `${alies}.${q(clau)}`;
    const claus = Object.keys(condicions);
    if (definicio !== "id" && definicio.m2o && claus.some((c) => !esOperador(c))) {
      // Una relació de molts a un: la fila a què apunta ha de complir el filtre.
      const pare = nouAlies();
      const sub = compilaFiltre(definicio.m2o, pare, condicions);
      parts.push({ sql: `EXISTS (SELECT 1 FROM ${q(definicio.m2o)} ${pare} WHERE ${pare}.id = ${columna} AND ${sub.sql})`, params: sub.params });
      continue;
    }
    parts.push(uneix(claus.map((op) => operador(columna, definicio, op, condicions[op])), "AND"));
  }
  return uneix(parts, "AND");
}

/** L'expressió SQL d'un camí amb punts (per ordenar): les relacions es resolen amb subconsultes. */
function expressioDeCami(colleccio: string, alies: string, cami: string[]): string {
  const [cap, ...resta] = cami;
  const definicio = definicioCamp(colleccio, cap);
  if (resta.length === 0) return `${alies}.${q(cap)}`;
  if (definicio === "id" || !definicio.m2o) campDesconegut(colleccio, cami.join("."));
  const pare = nouAlies();
  return `(SELECT ${expressioDeCami(definicio.m2o, pare, resta)} FROM ${q(definicio.m2o)} ${pare} WHERE ${pare}.id = ${alies}.${q(cap)})`;
}

function compilaOrdre(colleccio: string, alies: string, ordre: string[]): string {
  if (ordre.length === 0) return "";
  const parts = ordre.map((tros) => {
    const desc = tros.startsWith("-");
    const expressio = expressioDeCami(colleccio, alies, (desc ? tros.slice(1) : tros).split("."));
    // Com PostgreSQL, on vivia el CRM: els buits van al final pujant i al principi baixant.
    return `${expressio} ${desc ? "DESC NULLS FIRST" : "ASC NULLS LAST"}`;
  });
  return ` ORDER BY ${parts.join(", ")}`;
}

// ---------------------------------------------------------------- camps

type Arbre = Map<string, Arbre>;

function arbreDeCamps(camps: string[]): Arbre {
  const arrel: Arbre = new Map();
  for (const cami of camps.map((c) => c.trim()).filter(Boolean)) {
    let node = arrel;
    for (const tros of cami.split(".")) {
      if (!node.has(tros)) node.set(tros, new Map());
      node = node.get(tros)!;
    }
  }
  return arrel;
}

/** Converteix files crues de `colleccio` en objectes amb els camps demanats, relacions incloses. */
function resol(colleccio: string, files: Fila[], arbre: Arbre): Fila[] {
  const definicio = taula(colleccio);
  if (arbre.size === 0) arbre = new Map([["*", new Map()]]);
  const sortida: Fila[] = files.map(() => ({}));

  for (const [clau, subarbre] of arbre) {
    if (clau === "*") {
      files.forEach((fila, i) => {
        sortida[i].id = fila.id;
        for (const [camp, def] of Object.entries(definicio.camps)) {
          if (CAMPS_OCULTS.has(camp)) continue;
          if (!(camp in sortida[i])) sortida[i][camp] = deColumna(def, fila[camp]);
        }
        // Com la base de dades, `*` porta els ids dels fills de cada relació d'un a molts.
      });
      continue;
    }

    const relacio = o2m(colleccio, clau);
    if (relacio) {
      const ids = files.map((fila) => fila.id as string);
      const fills = ids.length
        ? (bd()
            .prepare(`SELECT * FROM ${q(relacio.colleccio)} WHERE ${q(relacio.camp)} IN (${ids.map(() => "?").join(", ")}) ORDER BY rowid`)
            .all(...ids) as Fila[])
        : [];
      const resolts = subarbre.size ? resol(relacio.colleccio, fills, subarbre) : fills.map((fill) => fill.id);
      const perPare = new Map<string, unknown[]>();
      fills.forEach((fill, i) => {
        const pare = fill[relacio.camp] as string;
        if (!perPare.has(pare)) perPare.set(pare, []);
        perPare.get(pare)!.push(resolts[i]);
      });
      files.forEach((fila, i) => (sortida[i][clau] = perPare.get(fila.id as string) ?? []));
      continue;
    }

    if (CAMPS_OCULTS.has(clau)) campDesconegut(colleccio, clau);
    const def = definicioCamp(colleccio, clau);
    if (subarbre.size === 0 || def === "id" || !def.m2o) {
      if (subarbre.size > 0 && !(def !== "id" && def.tipus === "json")) campDesconegut(colleccio, [clau, ...subarbre.keys()].join("."));
      files.forEach((fila, i) => (sortida[i][clau] = deColumna(def, fila[clau])));
      continue;
    }

    // Molts a un: es porten d'un cop les files a què apunten.
    const ids = [...new Set(files.map((fila) => fila[clau]).filter((id): id is string => typeof id === "string" && id !== ""))];
    const pares = ids.length
      ? (bd().prepare(`SELECT * FROM ${q(def.m2o)} WHERE id IN (${ids.map(() => "?").join(", ")})`).all(...ids) as Fila[])
      : [];
    const resolts = resol(def.m2o, pares, subarbre);
    const perId = new Map(pares.map((pare, i) => [pare.id as string, resolts[i]]));
    files.forEach((fila, i) => (sortida[i][clau] = perId.get(fila[clau] as string) ?? null));
  }
  return sortida;
}

// ---------------------------------------------------------------- lectura

type Parametres = {
  camps: string[];
  filtre: unknown;
  ordre: string[];
  limit: number;
  salta: number;
  meta: string[];
  agregats: { funcio: string; camps: string[] }[];
  agrupa: string[];
};

/** `filter[a][b][_eq]=x` → `{ a: { b: { _eq: "x" } } }`. */
function filtreDeClaudators(consulta: URLSearchParams): Record<string, unknown> | null {
  let filtre: Record<string, unknown> | null = null;
  for (const [clau, valor] of consulta) {
    if (!clau.startsWith("filter[")) continue;
    const parts = Array.from(clau.matchAll(/\[([^\]]*)\]/g), (m) => m[1]);
    filtre ??= {};
    let node = filtre;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) node[part] = valor;
      else node = (node[part] ??= {}) as Record<string, unknown>;
    });
  }
  return filtre;
}

function llegeixParametres(consulta: URLSearchParams): Parametres {
  const json = consulta.get("filter");
  let filtre: unknown = null;
  if (json) {
    try {
      filtre = JSON.parse(json);
    } catch {
      throw new ErrorConsulta(400, "El filtre no és JSON vàlid.");
    }
  }
  const deClaudators = filtreDeClaudators(consulta);
  if (deClaudators) filtre = filtre ? { _and: [filtre, deClaudators] } : deClaudators;

  const agregats: Parametres["agregats"] = [];
  for (const [clau, valor] of consulta) {
    const agregat = /^aggregate\[(\w+)\]$/.exec(clau);
    if (agregat) agregats.push({ funcio: agregat[1], camps: valor.split(",").filter(Boolean) });
  }
  const limit = consulta.get("limit");
  return {
    camps: (consulta.getAll("fields").join(",") || "*").split(","),
    filtre,
    ordre: consulta.getAll("sort").join(",").split(",").filter(Boolean),
    // Sense límit (o -1), totes. La base de dades en donava cent, i en un agregat això en perdia.
    limit: limit === null ? -1 : Number(limit),
    salta: Number(consulta.get("offset") ?? 0) || 0,
    meta: (consulta.get("meta") ?? "").split(",").filter(Boolean),
    agregats,
    agrupa: [...consulta.getAll("groupBy[]"), ...consulta.getAll("groupBy")].flatMap((c) => c.split(",")).filter(Boolean),
  };
}

function llegeix(colleccio: string, p: Parametres, id?: string) {
  taula(colleccio);
  const alies = nouAlies();
  const filtres = [compilaFiltre(colleccio, alies, p.filtre)];
  if (id) filtres.push({ sql: `${alies}.id = ?`, params: [id] });
  const on = uneix(filtres, "AND");

  if (p.agregats.length > 0) return agrega(colleccio, alies, on, p);

  const limit = p.limit < 0 ? "" : ` LIMIT ${Math.trunc(p.limit)} OFFSET ${Math.trunc(p.salta)}`;
  const files = bd()
    .prepare(`SELECT ${alies}.* FROM ${q(colleccio)} ${alies} WHERE ${on.sql}${compilaOrdre(colleccio, alies, p.ordre)}${p.limit === 0 ? " LIMIT 0" : limit}`)
    .all(...on.params) as Fila[];
  const data = resol(colleccio, files, arbreDeCamps(p.camps));

  const meta: Record<string, number> = {};
  if (p.meta.includes("filter_count") || p.meta.includes("*")) {
    meta.filter_count = (bd().prepare(`SELECT COUNT(*) AS n FROM ${q(colleccio)} ${alies} WHERE ${on.sql}`).get(...on.params) as { n: number }).n;
  }
  if (p.meta.includes("total_count") || p.meta.includes("*")) {
    meta.total_count = (bd().prepare(`SELECT COUNT(*) AS n FROM ${q(colleccio)}`).get() as { n: number }).n;
  }
  if (id) {
    if (data.length === 0) throw new ErrorConsulta(403, "You don't have permission to access this.", "FORBIDDEN");
    return { data: data[0] };
  }
  if (taula(colleccio).singleton) return { data: data[0] ?? null };
  return Object.keys(meta).length ? { data, meta } : { data };
}

const FUNCIONS: Record<string, (columna: string) => string> = {
  count: (c) => `COUNT(${c})`,
  countDistinct: (c) => `COUNT(DISTINCT ${c})`,
  sum: (c) => `SUM(${c})`,
  sumDistinct: (c) => `SUM(DISTINCT ${c})`,
  avg: (c) => `AVG(${c})`,
  avgDistinct: (c) => `AVG(DISTINCT ${c})`,
  min: (c) => `MIN(${c})`,
  max: (c) => `MAX(${c})`,
};

function agrega(colleccio: string, alies: string, on: Sql, p: Parametres) {
  const seleccio: string[] = [];
  const claus: { nom: string; funcio?: string; camp?: string; def?: DefinicioCamp | "id" }[] = [];
  p.agrupa.forEach((camp, i) => {
    seleccio.push(`${expressioDeCami(colleccio, alies, camp.split("."))} AS g${i}`);
    claus.push({ nom: camp, def: camp.includes(".") ? undefined : definicioCamp(colleccio, camp) });
  });
  for (const { funcio, camps } of p.agregats) {
    const fn = FUNCIONS[funcio];
    if (!fn) throw new ErrorConsulta(400, `L'agregat «${funcio}» no existeix.`);
    for (const camp of camps) {
      seleccio.push(`${fn(camp === "*" ? "*" : expressioDeCami(colleccio, alies, camp.split(".")))} AS a${claus.length}`);
      claus.push({ nom: `a${claus.length}`, funcio, camp });
    }
  }
  const grup = p.agrupa.length ? ` GROUP BY ${p.agrupa.map((_, i) => `g${i}`).join(", ")}` : "";
  const ordre = p.ordre.length
    ? ` ORDER BY ${p.ordre
        .map((tros) => {
          const desc = tros.startsWith("-");
          const nom = desc ? tros.slice(1) : tros;
          const i = p.agrupa.indexOf(nom);
          return i >= 0 ? `g${i} ${desc ? "DESC" : "ASC"}` : null;
        })
        .filter(Boolean)
        .join(", ")}`
    : "";
  const limit = p.limit < 0 || p.agrupa.length === 0 ? "" : ` LIMIT ${Math.trunc(p.limit)} OFFSET ${Math.trunc(p.salta)}`;
  const files = bd()
    .prepare(`SELECT ${seleccio.join(", ")} FROM ${q(colleccio)} ${alies} WHERE ${on.sql}${grup}${ordre.trim() === "ORDER BY" ? "" : ordre}${limit}`)
    .all(...on.params) as Fila[];

  const data = files.map((fila) => {
    const sortida: Fila = {};
    claus.forEach((clau, i) => {
      if (!clau.funcio) {
        sortida[clau.nom] = clau.def ? deColumna(clau.def, fila[`g${i}`]) : fila[`g${i}`];
        return;
      }
      const valor = fila[`a${i}`];
      if (clau.camp === "*") sortida[clau.funcio] = valor;
      else sortida[clau.funcio] = { ...((sortida[clau.funcio] as Fila | undefined) ?? {}), [clau.camp!]: valor };
    });
    return sortida;
  });
  return { data };
}

// ---------------------------------------------------------------- escriptura

function columnesDe(colleccio: string, dades: Fila) {
  const definicio = taula(colleccio);
  const columnes: Record<string, Valor> = {};
  const fills: { relacio: { colleccio: string; camp: string }; files: unknown[] }[] = [];
  for (const [camp, valor] of Object.entries(dades)) {
    if (camp === "id") continue;
    const relacio = definicio.o2m?.[camp];
    if (relacio) {
      if (Array.isArray(valor)) fills.push({ relacio, files: valor });
      continue;
    }
    const def = definicio.camps[camp];
    if (!def) campDesconegut(colleccio, camp);
    columnes[camp] = aColumna(def, valor);
  }
  return { columnes, fills };
}

function insereix(colleccio: string, dades: Fila): string {
  const definicio = taula(colleccio);
  const id = typeof dades.id === "string" && dades.id ? dades.id : randomUUID();
  const { columnes, fills } = columnesDe(colleccio, dades);
  const ara = new Date().toISOString();
  for (const camp of AUDITORIA) if (definicio.camps[camp] && !(camp in columnes)) columnes[camp] = ara;
  const noms = Object.keys(columnes);
  bd()
    .prepare(`INSERT INTO ${q(colleccio)} (id${noms.map((n) => `, ${q(n)}`).join("")}) VALUES (?${noms.map(() => ", ?").join("")})`)
    .run(id, ...noms.map((n) => columnes[n]));
  for (const { relacio, files } of fills) {
    for (const fill of files) {
      if (fill && typeof fill === "object") insereix(relacio.colleccio, { ...(fill as Fila), [relacio.camp]: id });
      else if (typeof fill === "string") actualitza(relacio.colleccio, fill, { [relacio.camp]: id });
    }
  }
  return id;
}

function actualitza(colleccio: string, id: string, dades: Fila) {
  const definicio = taula(colleccio);
  const { columnes, fills } = columnesDe(colleccio, dades);
  if (fills.length) throw new ErrorConsulta(400, `Les files de «${colleccio}» relacionades s'han de desar a part.`);
  if (definicio.camps.date_updated && !("date_updated" in columnes)) columnes.date_updated = new Date().toISOString();
  const noms = Object.keys(columnes);
  if (noms.length === 0) return;
  const resultat = bd()
    .prepare(`UPDATE ${q(colleccio)} SET ${noms.map((n) => `${q(n)} = ?`).join(", ")} WHERE id = ?`)
    .run(...noms.map((n) => columnes[n]), id);
  if (resultat.changes === 0) throw new ErrorConsulta(403, "You don't have permission to access this.", "FORBIDDEN");
}

function desaSingleton(colleccio: string, dades: Fila) {
  const fila = bd().prepare(`SELECT id FROM ${q(colleccio)} LIMIT 1`).get() as { id: string } | undefined;
  if (fila) actualitza(colleccio, fila.id, dades);
  else insereix(colleccio, dades);
}

function esborra(colleccio: string, ids: string[]) {
  taula(colleccio);
  if (ids.length === 0) return;
  bd().prepare(`DELETE FROM ${q(colleccio)} WHERE id IN (${ids.map(() => "?").join(", ")})`).run(...ids);
}

function errorDeSqlite(error: unknown): ErrorConsulta {
  if (error instanceof ErrorConsulta) return error;
  const missatge = (error as Error).message ?? String(error);
  if (/UNIQUE constraint failed/.test(missatge)) return new ErrorConsulta(400, `Ja n'hi ha un altre amb aquest valor (${missatge}).`, "RECORD_NOT_UNIQUE");
  if (/FOREIGN KEY constraint failed/.test(missatge)) return new ErrorConsulta(400, "Una relació apunta a una fitxa que no existeix.", "INVALID_FOREIGN_KEY");
  return new ErrorConsulta(500, missatge, "INTERNAL_SERVER_ERROR");
}

// ---------------------------------------------------------------- entrada

function resposta(cos: unknown, estat = 200) {
  return new Response(cos === null ? null : JSON.stringify(cos), {
    status: estat,
    headers: cos === null ? {} : { "Content-Type": "application/json" },
  });
}

function respostaDError(error: ErrorConsulta) {
  return resposta({ errors: [{ message: error.message, extensions: { code: error.codi } }] }, error.estat);
}

async function cosDe(cos: BodyInit | null | undefined): Promise<unknown> {
  if (cos === null || cos === undefined) return null;
  if (typeof cos === "string") return cos ? JSON.parse(cos) : null;
  return cos;
}

/**
 * Executa una petició amb el camí i el mètode de l'API de la base de dades. És
 * síncrona per dins (SQLite ho és), però torna una promesa perquè qui la crida
 * ho feia per xarxa.
 */
export async function executa(ruta: string, opcions: RequestInit = {}): Promise<Response> {
  const metode = (opcions.method ?? "GET").toUpperCase();
  const [cami, consultaText = ""] = ruta.split("?");
  const consulta = new URLSearchParams(consultaText);
  const trossos = cami.split("/").filter(Boolean).map(decodeURIComponent);

  try {
    // Fitxers: es serveixen i es desen al disc.
    if (trossos[0] === "assets" && trossos[1]) return await llegeixFitxerDelDisc(trossos[1], consulta);
    if (trossos[0] === "files" && metode === "POST" && opcions.body instanceof FormData) {
      const id = await pujaFitxerAlDisc(opcions.body);
      return resposta({ data: { id } });
    }
    if (trossos[0] === "files" && metode === "DELETE" && trossos[1]) {
      esborraFitxerDelDisc(trossos[1]);
      return resposta(null, 204);
    }

    let colleccio: string;
    let id: string | undefined;
    if (trossos[0] === "items" && trossos[1]) [colleccio, id] = [trossos[1], trossos[2]];
    else if (TAULES_DE_SISTEMA[trossos[0]]) [colleccio, id] = [TAULES_DE_SISTEMA[trossos[0]], trossos[1]];
    else throw new ErrorConsulta(404, `Ruta desconeguda: ${cami}`, "ROUTE_NOT_FOUND");
    const definicio = taula(colleccio);
    const parametres = llegeixParametres(consulta);
    const cos = await cosDe(opcions.body);

    if (metode === "GET" || metode === "SEARCH") return resposta(llegeix(colleccio, parametres, id));

    if (metode === "POST") {
      const ids = bd().transaction(() => (Array.isArray(cos) ? cos.map((fila) => insereix(colleccio, fila as Fila)) : [insereix(colleccio, (cos ?? {}) as Fila)]))();
      const llegits = llegeix(colleccio, { ...parametres, filtre: { id: { _in: ids } }, limit: -1, ordre: [], meta: [], agregats: [] }).data as Fila[];
      const perId = new Map(llegits.map((fila) => [fila.id, fila]));
      return resposta({ data: Array.isArray(cos) ? ids.map((i) => perId.get(i)) : perId.get(ids[0]) });
    }

    if (metode === "PATCH") {
      bd().transaction(() => {
        if (id) actualitza(colleccio, id, (cos ?? {}) as Fila);
        else if (Array.isArray(cos)) for (const fila of cos as Fila[]) actualitza(colleccio, String(fila.id ?? ""), fila);
        else if (definicio.singleton) desaSingleton(colleccio, (cos ?? {}) as Fila);
        else throw new ErrorConsulta(400, "Falta l'id de la fila que s'ha d'actualitzar.");
      })();
      if (definicio.singleton && !id) return resposta(llegeix(colleccio, parametres));
      return resposta({ data: id ? { id } : (cos as Fila[]).map((fila) => ({ id: fila.id })) });
    }

    if (metode === "DELETE") {
      const ids = id ? [id] : Array.isArray(cos) ? (cos as unknown[]).map(String) : [];
      bd().transaction(() => esborra(colleccio, ids))();
      return resposta(null, 204);
    }

    throw new ErrorConsulta(405, `Mètode ${metode} no admès.`);
  } catch (error) {
    return respostaDError(errorDeSqlite(error));
  }
}
