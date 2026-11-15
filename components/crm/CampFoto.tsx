"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";

import { useEdicio } from "@/components/crm/EdicioFitxa";
import { MIDA_MAXIMA_FOTO, QUALITAT_FOTO, TEXT_FOTO_MASSA_GRAN, midesReduides, nomTreuFoto } from "@/domini/foto-activitat";

class ErrorFoto extends Error {}

/**
 * La foto reduïda i tornada a desar en JPEG. El llenç ja la gira com toca i no
 * en copia les dades de dins, com ara on s'ha fet.
 */
async function fotoReduida(original: File) {
  const adreca = URL.createObjectURL(original);
  try {
    const imatge = new window.Image();
    await new Promise((resol, rebutja) => {
      imatge.onload = resol;
      imatge.onerror = rebutja;
      imatge.src = adreca;
    }).catch(() => {
      // El cas típic és una foto HEIC en un navegador que no la sap obrir.
      throw new ErrorFoto("Aquesta imatge no es pot llegir. Prova-ho amb una foto JPG o PNG.");
    });

    const { amplada, alcada } = midesReduides(imatge.naturalWidth, imatge.naturalHeight);
    const llenc = document.createElement("canvas");
    llenc.width = amplada;
    llenc.height = alcada;
    const context = llenc.getContext("2d");
    if (!context) throw new ErrorFoto("Aquest navegador no pot preparar la foto.");
    // El JPEG no té transparència: el que en tingui, sobre blanc i no sobre negre.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, amplada, alcada);
    context.drawImage(imatge, 0, 0, amplada, alcada);

    const reduida = await new Promise<Blob | null>((resol) => llenc.toBlob(resol, "image/jpeg", QUALITAT_FOTO));
    if (!reduida) throw new ErrorFoto("Aquest navegador no pot preparar la foto.");
    if (reduida.size > MIDA_MAXIMA_FOTO) throw new ErrorFoto(TEXT_FOTO_MASSA_GRAN);
    return new File([reduida], "foto.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(adreca);
  }
}

const BOTO =
  "cursor-pointer items-center rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink focus-within:border-wine focus-within:ring-4 focus-within:ring-wine/10 has-disabled:cursor-default has-disabled:opacity-50";

/**
 * La foto d'una activitat. A les pantalles tàctils es pot fer amb la càmera o
 * triar de la galeria, amb un botó per a cada cosa: un sol selector no sempre
 * ofereix la càmera a Android. A l'ordinador només es tria, que càmera no n'hi ha.
 *
 * Una foto nova no es desa fins que es desa la fitxa. Fins llavors, es veu
 * reduïda, tal com s'enviarà.
 */
export function CampFoto({
  id,
  nom,
  activitat,
  fitxerInicial,
}: {
  id: string;
  nom: string;
  /** L'activitat, si ja està desada: d'on es demana la foto que ja té. */
  activitat: string | null;
  fitxerInicial: string | null;
}) {
  const { adjunta, enviant, preparant, setPreparant } = useEdicio();
  const [nova, setNova] = useState<string | null>(null);
  const [treta, setTreta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // L'adreça de la vista prèvia ocupa memòria fins que s'allibera.
  useEffect(() => (nova ? () => URL.revokeObjectURL(nova) : undefined), [nova]);

  const desada = fitxerInicial && activitat && !treta ? `/api/crm/activitats/${activitat}/foto?v=${fitxerInicial}` : null;
  const vista = nova ?? desada;

  const alTriar = async (event: ChangeEvent<HTMLInputElement>) => {
    const triat = event.target.files?.[0];
    // Si no, tornar a triar la mateixa foto no avisaria de res.
    event.target.value = "";
    if (!triat) return;
    setError(null);
    setPreparant(true);
    try {
      const reduida = await fotoReduida(triat);
      adjunta(nom, reduida);
      setNova(URL.createObjectURL(reduida));
      setTreta(false);
    } catch (fallada) {
      setError(fallada instanceof ErrorFoto ? fallada.message : "No s'ha pogut preparar la foto. Torna-ho a provar.");
    } finally {
      setPreparant(false);
    }
  };

  const treu = () => {
    adjunta(nom, null);
    setNova(null);
    setTreta(true);
    setError(null);
  };

  const bloquejat = preparant || enviant;

  return (
    <div className="space-y-2">
      {treta && fitxerInicial ? <input type="hidden" name={nomTreuFoto(nom)} value="1" /> : null}

      {vista ? (
        <a href={vista} target="_blank" rel="noreferrer" className="block w-fit max-w-full">
          <Image
            src={vista}
            alt="Foto de l'activitat"
            width={480}
            height={320}
            unoptimized
            className="h-auto max-h-64 w-auto max-w-full rounded-lg border border-line object-contain"
          />
        </a>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className={`hidden pointer-coarse:inline-flex ${BOTO}`}>
          <input type="file" accept="image/*" capture="environment" disabled={bloquejat} onChange={alTriar} className="sr-only" />
          Fes una foto
        </label>
        <label className={`inline-flex ${BOTO}`}>
          <input id={id} type="file" accept="image/*" disabled={bloquejat} onChange={alTriar} className="sr-only" />
          <span className="pointer-coarse:hidden">{vista ? "Canvia la foto" : "Tria una foto"}</span>
          <span className="hidden pointer-coarse:inline">Tria de la galeria</span>
        </label>
        {vista ? (
          <button type="button" onClick={treu} disabled={bloquejat} className="text-[13px] text-muted transition hover:text-wine disabled:opacity-50">
            Treu la foto
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-[12px] text-wine-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
