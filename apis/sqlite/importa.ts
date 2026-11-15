/**
 * Importació de fitxes que vénen d'un altre sistema (l'ERP) a una taula.
 *
 * Cada fila porta `erp_id`, la clau de l'altre sistema. Les que ja hi són
 * s'actualitzen només si ha canviat algun camp; les noves es creen; i les que
 * l'ERP ja no porta queden marcades amb `erp_absent_des_de`, sense esborrar-les:
 * el CRM hi pot tenir activitats penjant. Les fitxes importades porten
 * `font = "erp"`, que és el que bloqueja els camps de l'ERP als formularis.
 *
 * Un camp que no ve a la fila no es toca: així el que és només del CRM (el
 * potencial, les notes, el comercial…) no es trepitja mai. Un valor pot ser una
 * funció del valor actual, per a les regles que en depenen (l'estat d'un
 * client que torna a estar actiu).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { bd } from "./bd";
import { aColumna } from "./consulta";
import { MODEL } from "./model";

type Valor = unknown | ((actual: unknown) => unknown);
export type FilaImportada = { erp_id: string } & Record<string, Valor>;

export type ResultatImportacio = { llegits: number; creats: number; actualitzats: number; iguals: number; absents: number };

export type OpcionsImportacio = {
  /** Per a una fila nova, l'id d'una fitxa del portal que ja és la mateixa (pel NIF, pel nom…). */
  adopta?: (fila: FilaImportada) => string | null;
  /** Camps que només es posen en crear la fitxa: després els mana el CRM. */
  nomesEnCrear?: string[];
  /** Si canvia algun d'aquests camps, es buiden els de `buida` (l'adreça → les coordenades). */
  quanCanvia?: { camps: string[]; buida: string[] };
  /** Si les que l'ERP ja no porta s'han de marcar com a absents. Per defecte, sí. */
  marcaAbsents?: boolean;
};

const q = (nom: string) => `"${nom.replace(/"/g, '""')}"`;

/** Dos valors de columna són el mateix? Els números es comparen com a números. */
function iguals(a: unknown, b: unknown) {
  if (a === null || a === undefined) return b === null || b === undefined || b === "";
  if (b === null || b === undefined) return a === "";
  if (typeof a === "number" || typeof b === "number") return Math.abs(Number(a) - Number(b)) < 1e-9;
  return String(a) === String(b);
}

export function importa(taula: string, files: FilaImportada[], opcions: OpcionsImportacio = {}): ResultatImportacio {
  const model = MODEL[taula];
  if (!model) throw new Error(`La taula «${taula}» no existeix.`);
  const base = bd();
  const ara = new Date().toISOString();
  const avui = ara.slice(0, 10);
  const resultat: ResultatImportacio = { llegits: files.length, creats: 0, actualitzats: 0, iguals: 0, absents: 0 };

  const campsDeLesFiles = [...new Set(files.flatMap((fila) => Object.keys(fila)))].filter((camp) => camp !== "erp_id");
  for (const camp of campsDeLesFiles) if (!model.camps[camp]) throw new Error(`El camp «${camp}» no existeix a ${taula}.`);
  // Les taules que són una còpia pura de l'ERP (la facturació) no porten font ni absència: el que ja no hi és, s'esborra.
  const ambFont = Boolean(model.camps.font);
  const ambAbsencia = Boolean(model.camps.erp_absent_des_de);
  const campsQueMiro = [...new Set([...campsDeLesFiles, ...(opcions.quanCanvia?.buida ?? []), ...(ambAbsencia ? ["erp_absent_des_de"] : []), ...(ambFont ? ["font"] : [])])];

  base.transaction(() => {
    const existents = new Map(
      (base.prepare(`SELECT id, erp_id, ${campsQueMiro.map(q).join(", ")} FROM ${q(taula)} WHERE erp_id IS NOT NULL`).all() as Record<string, unknown>[]).map(
        (fila) => [String(fila.erp_id), fila],
      ),
    );
    const vistos = new Set<string>();

    for (const fila of files) {
      vistos.add(fila.erp_id);
      let actual = existents.get(fila.erp_id);
      if (!actual && opcions.adopta) {
        const id = opcions.adopta(fila);
        if (id) actual = base.prepare(`SELECT id, erp_id, ${campsQueMiro.map(q).join(", ")} FROM ${q(taula)} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
      }

      const valors: Record<string, unknown> = {};
      for (const [camp, valor] of Object.entries(fila)) {
        if (camp === "erp_id") continue;
        if (actual && opcions.nomesEnCrear?.includes(camp)) continue;
        const brut = typeof valor === "function" ? (valor as (a: unknown) => unknown)(actual?.[camp]) : valor;
        if (brut === undefined) continue;
        valors[camp] = aColumna(model.camps[camp], brut);
      }

      if (!actual) {
        const columnes: Record<string, unknown> = { ...valors, erp_id: fila.erp_id, erp_sincronitzat_el: ara };
        if (ambFont) columnes.font = "erp";
        if (model.camps.date_created) columnes.date_created = ara;
        if (model.camps.date_updated) columnes.date_updated = ara;
        const noms = Object.keys(columnes).filter((nom) => model.camps[nom]);
        base
          .prepare(`INSERT INTO ${q(taula)} (id, ${noms.map(q).join(", ")}) VALUES (?, ${noms.map(() => "?").join(", ")})`)
          .run(randomUUID(), ...noms.map((nom) => columnes[nom] as never));
        resultat.creats += 1;
        continue;
      }

      const canvis: Record<string, unknown> = {};
      for (const [camp, valor] of Object.entries(valors)) if (!iguals(actual[camp], valor)) canvis[camp] = valor;
      if (opcions.quanCanvia && opcions.quanCanvia.camps.some((camp) => camp in canvis)) {
        for (const camp of opcions.quanCanvia.buida) canvis[camp] = null;
      }
      if (ambAbsencia && actual.erp_absent_des_de) canvis.erp_absent_des_de = null;
      if (ambFont && actual.font !== "erp") canvis.font = "erp";
      if (actual.erp_id !== fila.erp_id) canvis.erp_id = fila.erp_id;

      if (Object.keys(canvis).length === 0) {
        resultat.iguals += 1;
        continue;
      }
      canvis.erp_sincronitzat_el = ara;
      if (model.camps.date_updated) canvis.date_updated = ara;
      const noms = Object.keys(canvis).filter((nom) => model.camps[nom]);
      base.prepare(`UPDATE ${q(taula)} SET ${noms.map((nom) => `${q(nom)} = ?`).join(", ")} WHERE id = ?`).run(...noms.map((nom) => canvis[nom] as never), actual.id as never);
      resultat.actualitzats += 1;
    }

    if (opcions.marcaAbsents !== false) {
      for (const [erpId, fila] of existents) {
        if (vistos.has(erpId)) continue;
        if (!ambAbsencia) {
          base.prepare(`DELETE FROM ${q(taula)} WHERE id = ?`).run(fila.id as never);
          resultat.absents += 1;
          continue;
        }
        if ((ambFont && fila.font !== "erp") || fila.erp_absent_des_de) continue;
        base.prepare(`UPDATE ${q(taula)} SET erp_absent_des_de = ? WHERE id = ?`).run(avui, fila.id as never);
        resultat.absents += 1;
      }
    }
  })();

  return resultat;
}

/** De la clau de l'ERP a l'id del CRM, per lligar relacions (el client d'un albarà, el laboratori d'un article). */
export function idsPerErpId(taula: string): Map<string, string> {
  const files = bd().prepare(`SELECT id, erp_id FROM ${q(taula)} WHERE erp_id IS NOT NULL`).all() as { id: string; erp_id: string }[];
  return new Map(files.map((fila) => [fila.erp_id, fila.id]));
}

/** L'id d'una fitxa per un camp (sense distingir majúscules), per adoptar les creades al portal. */
export function idPerCamp(taula: string, camp: string, valor: unknown): string | null {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const fila = bd()
    .prepare(`SELECT id FROM ${q(taula)} WHERE erp_id IS NULL AND lower(trim(${q(camp)})) = lower(trim(?)) LIMIT 1`)
    .get(String(valor)) as { id: string } | undefined;
  return fila?.id ?? null;
}

/** Els valors actuals d'uns camps, per id: per decidir què cal tornar a fer (les fotos que han canviat). */
export function valorsPerErpId<T extends Record<string, unknown>>(taula: string, camps: string[]): Map<string, T & { id: string }> {
  const files = bd()
    .prepare(`SELECT id, erp_id, ${camps.map(q).join(", ")} FROM ${q(taula)} WHERE erp_id IS NOT NULL`)
    .all() as (T & { id: string; erp_id: string })[];
  return new Map(files.map((fila) => [fila.erp_id, fila]));
}

/** Escriu uns camps d'una fila tal qual: per a la foto d'un article, un cop baixada. */
export function actualitzaCamps(taula: string, id: string, valors: Record<string, unknown>) {
  const model = MODEL[taula];
  const noms = Object.keys(valors).filter((nom) => model.camps[nom]);
  if (noms.length === 0) return;
  bd()
    .prepare(`UPDATE ${q(taula)} SET ${noms.map((nom) => `${q(nom)} = ?`).join(", ")} WHERE id = ?`)
    .run(...noms.map((nom) => aColumna(model.camps[nom], valors[nom]) as never), id);
}
