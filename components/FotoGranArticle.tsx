"use client";

import Image from "next/image";
import { useState } from "react";

import { ICONES } from "@/components/Icones";

/**
 * La foto gran d'un article a la columna de detall. La base de dades la transforma en
 * demanar-la i triga una mica: mentrestant hi ha la miniatura, que ja és a la
 * memòria cau, i el requadre no canvia de mida. Qui la fa servir li posa
 * `key={gran}` perquè, en canviar d'article, torni a començar.
 */
export function FotoGranArticle({ petita, gran, nom }: { petita: string | null; gran: string | null; nom: string }) {
  const [carregada, setCarregada] = useState(false);
  const Icona = ICONES.articles;

  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
      {gran ? (
        <>
          {petita && !carregada ? (
            <Image
              src={petita}
              alt=""
              aria-hidden
              width={160}
              height={160}
              unoptimized
              className="absolute inset-0 m-auto h-full w-full object-contain p-4 opacity-60 blur-[2px]"
            />
          ) : null}
          {/* Ja arriba a la mida que toca des de la base de dades: no cal que Next la torni a optimitzar. */}
          <Image
            src={gran}
            alt={`Foto de ${nom}`}
            width={1200}
            height={1200}
            unoptimized
            onLoad={() => setCarregada(true)}
            className={`relative h-full w-full object-contain p-4 transition-opacity duration-200 motion-reduce:transition-none ${
              carregada ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      ) : (
        <span className="flex flex-col items-center gap-2 text-muted/50">
          <Icona className="size-16" />
          <span className="text-[13px]">Sense foto a l&apos;ERP</span>
        </span>
      )}
    </div>
  );
}
