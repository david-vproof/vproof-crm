/**
 * Els fitxers pujats al portal: una fila a `fitxers` amb el nom, el tipus i la
 * mida, i el contingut al disc, a `DIR_FITXERS/<id>`. En servir una imatge,
 * se'n pot demanar una mida o un format (`width`, `height`, `fit`, `format`,
 * `quality`, `withoutEnlargement`, i `transforms` amb `trim`), com feia
 * l'endpoint /assets de Directus. Ho fa sharp; si no pot, es dona l'original.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { DIR_FITXERS, bd } from "./bd";

type FilaFitxer = { id: string; filename_download: string | null; type: string | null };

const rutaDe = (id: string) => path.join(DIR_FITXERS, id.replace(/[^a-zA-Z0-9-]/g, ""));

async function midesDImatge(dades: Buffer, tipus: string) {
  if (!tipus.startsWith("image/")) return { width: null, height: null };
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(dades).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/** Desa el fitxer d'un formulari (camps `file`, `title` i `folder`) i en torna l'id. */
export async function pujaFitxerAlDisc(formulari: FormData): Promise<string> {
  const fitxer = formulari.get("file");
  if (!(fitxer instanceof Blob)) throw new Error("No hi ha cap fitxer al formulari.");
  const id = randomUUID();
  const dades = Buffer.from(await fitxer.arrayBuffer());
  const tipus = fitxer.type || "application/octet-stream";
  const nom = "name" in fitxer && typeof fitxer.name === "string" ? fitxer.name : id;
  const mides = await midesDImatge(dades, tipus);
  writeFileSync(rutaDe(id), dades);
  const carpeta = formulari.get("folder");
  const titol = formulari.get("title");
  bd()
    .prepare("INSERT INTO fitxers (id, filename_download, type, title, folder, filesize, width, height, uploaded_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, nom, tipus, typeof titol === "string" ? titol : null, typeof carpeta === "string" && carpeta ? carpeta : null, dades.length, mides.width, mides.height, new Date().toISOString());
  return id;
}

export function esborraFitxerDelDisc(id: string) {
  bd().prepare("DELETE FROM fitxers WHERE id = ?").run(id);
  rmSync(rutaDe(id), { force: true });
}

const FORMATS: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", avif: "image/avif" };

async function transforma(dades: Buffer, tipus: string, consulta: URLSearchParams): Promise<{ dades: Buffer; tipus: string }> {
  const amplada = Number(consulta.get("width")) || undefined;
  const alcada = Number(consulta.get("height")) || undefined;
  const format = consulta.get("format") ?? "";
  const transformacions = consulta.get("transforms");
  if (!tipus.startsWith("image/") || (!amplada && !alcada && !format && !transformacions)) return { dades, tipus };

  const sharp = (await import("sharp")).default;
  let imatge = sharp(dades, { failOn: "none" }).rotate();
  if (transformacions) {
    for (const [nom, opcions] of JSON.parse(transformacions) as [string, Record<string, unknown>?][]) {
      if (nom === "trim") imatge = imatge.trim({ threshold: Number(opcions?.threshold ?? 10) });
    }
  }
  if (amplada || alcada) {
    imatge = imatge.resize({
      width: amplada,
      height: alcada,
      fit: (consulta.get("fit") as "cover" | "contain" | "inside" | "outside" | null) ?? "cover",
      withoutEnlargement: consulta.get("withoutEnlargement") === "true",
    });
  }
  const qualitat = Number(consulta.get("quality")) || undefined;
  if (format && FORMATS[format]) {
    imatge = imatge.toFormat(format as "webp" | "jpeg" | "png" | "avif", qualitat ? { quality: qualitat } : undefined);
    return { dades: await imatge.toBuffer(), tipus: FORMATS[format] };
  }
  return { dades: await imatge.toBuffer(), tipus };
}

/** El fitxer tal com el vol el navegador, o un 404 si no hi és. */
export async function llegeixFitxerDelDisc(id: string, consulta: URLSearchParams): Promise<Response> {
  const fila = bd().prepare("SELECT id, filename_download, type FROM fitxers WHERE id = ?").get(id) as FilaFitxer | undefined;
  const ruta = rutaDe(id);
  if (!fila || !existsSync(ruta)) {
    return new Response(JSON.stringify({ errors: [{ message: "El fitxer no existeix." }] }), { status: 404 });
  }
  const original = readFileSync(ruta);
  const tipus = fila.type ?? "application/octet-stream";
  let resultat: { dades: Buffer; tipus: string } = { dades: original, tipus };
  try {
    resultat = await transforma(original, tipus, consulta);
  } catch {
    // Si la imatge no es pot transformar, es dona tal qual.
  }
  return new Response(new Uint8Array(resultat.dades), {
    status: 200,
    headers: {
      "Content-Type": resultat.tipus,
      "Content-Length": String(resultat.dades.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(fila.filename_download ?? id)}"`,
    },
  });
}
