import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createElement } from "react";

import { FullaProductes } from "@/components/pdf/FullaProductes";
import { type AjustDeProducte, nomDelFitxer } from "@/domini/fulla-productes";
import type { DadesFulla } from "@/serveis/fulla-productes";

export const UUID = /^[0-9a-f-]{36}$/i;

/** El que el modal envia per fer el PDF: els productes amb els retocs de la revisió. */
export type ProducteRetocat = { id: string; preu?: string | number | null; descompte?: string | number | null; observacions?: string | null };

export const nomesUuids = (ids: string[]) => ids.map((producte) => producte.trim()).filter((producte) => UUID.test(producte));

/** Els productes del cos d'un POST, només els ben formats, i els seus retocs per id. */
export function productesRetocats(cos: { productes?: unknown }) {
  const triats = Array.isArray(cos.productes)
    ? (cos.productes as ProducteRetocat[]).filter((producte) => producte && typeof producte.id === "string" && UUID.test(producte.id))
    : [];
  const ajustos: Record<string, AjustDeProducte> = {};
  for (const producte of triats) {
    ajustos[producte.id] = { preu: producte.preu ?? null, descompte: producte.descompte ?? null, observacions: producte.observacions ?? null };
  }
  return { ids: triats.map((producte) => producte.id), ajustos };
}

/**
 * La resposta amb les dades de la fulla, o amb el PDF. Els avisos (preus que
 * no s'han pogut llegir…) van a la capçalera `X-Avisos`, i la tarifa feta
 * servir, a `X-Tarifa`, perquè el modal ho pugui dir al costat de la fulla.
 */
export async function respostaFulla(dades: DadesFulla | null, format: "json" | "pdf", baixa = false) {
  if (!dades) return new NextResponse(null, { status: 404 });
  if (dades.productes.length === 0) return NextResponse.json({ error: "No hi ha cap producte triat." }, { status: 400 });

  if (format === "json") {
    return NextResponse.json(
      { ...dades, productes: dades.productes.map((producte) => ({ ...producte, foto: undefined })) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const pdf = await renderToBuffer(createElement(FullaProductes, { dades }) as Parameters<typeof renderToBuffer>[0]);
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
