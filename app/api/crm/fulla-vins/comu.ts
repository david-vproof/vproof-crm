import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createElement } from "react";

import { FullaVins } from "@/components/pdf/FullaVins";
import { type AjustDeVi, nomDelFitxer } from "@/domini/fulla-vins";
import type { DadesFulla } from "@/serveis/fulla-vins";

export const UUID = /^[0-9a-f-]{36}$/i;

/** El que el modal envia per fer el PDF: els vins amb els retocs de la revisió. */
export type ViRetocat = { id: string; preu?: string | number | null; descompte?: string | number | null; observacions?: string | null };

export const nomesUuids = (ids: string[]) => ids.map((vi) => vi.trim()).filter((vi) => UUID.test(vi));

/** Els vins del cos d'un POST, només els ben formats, i els seus retocs per id. */
export function vinsRetocats(cos: { vins?: unknown }) {
  const triats = Array.isArray(cos.vins)
    ? (cos.vins as ViRetocat[]).filter((vi) => vi && typeof vi.id === "string" && UUID.test(vi.id))
    : [];
  const ajustos: Record<string, AjustDeVi> = {};
  for (const vi of triats) {
    ajustos[vi.id] = { preu: vi.preu ?? null, descompte: vi.descompte ?? null, observacions: vi.observacions ?? null };
  }
  return { ids: triats.map((vi) => vi.id), ajustos };
}

/**
 * La resposta amb les dades de la fulla, o amb el PDF. Els avisos (preus que
 * no s'han pogut llegir…) van a la capçalera `X-Avisos`, i la tarifa feta
 * servir, a `X-Tarifa`, perquè el modal ho pugui dir al costat de la fulla.
 */
export async function respostaFulla(dades: DadesFulla | null, format: "json" | "pdf", baixa = false) {
  if (!dades) return new NextResponse(null, { status: 404 });
  if (dades.vins.length === 0) return NextResponse.json({ error: "No hi ha cap vi triat." }, { status: 400 });

  if (format === "json") {
    return NextResponse.json(
      { ...dades, vins: dades.vins.map((vi) => ({ ...vi, foto: undefined })) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const pdf = await renderToBuffer(createElement(FullaVins, { dades }) as Parameters<typeof renderToBuffer>[0]);
  const fitxer = nomDelFitxer(dades.destinatari, dades.data);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixa ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(fitxer)}`,
      "Cache-Control": "private, no-store",
      "X-Avisos": encodeURIComponent(JSON.stringify(dades.avisos)),
      "X-Tarifa": encodeURIComponent(JSON.stringify(dades.tarifa)),
      "X-Fitxer": encodeURIComponent(fitxer),
    },
  });
}

export function respostaError(error: unknown) {
  return NextResponse.json({ error: (error as Error).message }, { status: 502 });
}
