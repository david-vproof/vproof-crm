"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un PDF dibuixat a la pàgina, full a full, amb pdf.js. No es fa servir el
 * visor del navegador perquè als telèfons no hi és: Chrome d'Android no ensenya
 * PDF dins d'una pàgina i Safari de l'iPhone només n'ensenya el primer full.
 * pdf.js només es carrega quan s'obre un PDF, no amb la resta de l'app.
 */
export function VistaPdf({ pdf, titol }: { pdf: Blob; titol: string }) {
  const contenidor = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let viu = true;
    const lloc = contenidor.current;
    if (!lloc) return;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const document = await pdfjs.getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) }).promise;
        const amplada = lloc.clientWidth;
        const densitat = Math.min(window.devicePixelRatio || 1, 2);
        const fulls: HTMLCanvasElement[] = [];
        for (let numero = 1; numero <= document.numPages; numero += 1) {
          const full = await document.getPage(numero);
          const escala = amplada / full.getViewport({ scale: 1 }).width;
          const vista = full.getViewport({ scale: escala * densitat });
          const llenç = window.document.createElement("canvas");
          llenç.width = Math.floor(vista.width);
          llenç.height = Math.floor(vista.height);
          llenç.style.width = "100%";
          llenç.className = "block rounded-md border border-line bg-white shadow-sm";
          llenç.setAttribute("role", "img");
          llenç.setAttribute("aria-label", `${titol}, full ${numero} de ${document.numPages}`);
          await full.render({ canvas: llenç, viewport: vista }).promise;
          fulls.push(llenç);
        }
        if (!viu) return;
        lloc.replaceChildren(...fulls);
      } catch (causa) {
        if (viu) setError((causa as Error).message);
      }
    })();

    return () => {
      viu = false;
    };
  }, [pdf, titol]);

  return (
    <>
      {error ? <p className="text-[13px] text-wine-deep">No s&apos;ha pogut ensenyar el PDF: {error}. Obre&apos;l o descarrega&apos;l.</p> : null}
      <div ref={contenidor} className="space-y-3">
        <p className="py-10 text-center text-[13.5px] text-muted">Preparant la vista…</p>
      </div>
    </>
  );
}
