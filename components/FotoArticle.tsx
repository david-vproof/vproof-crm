import Image from "next/image";

import { ICONES } from "@/components/Icones";

/**
 * La miniatura d'un article als llistats. La foto ve de l'ERP i la serveix
 * el portal; si es passa `gran`, en tocar-la s'obre sencera. Sense `gran` és
 * només la miniatura, per posar-la dins d'un botó (vegeu `DetallArticle`).
 * Sense foto, un requadre amb la icona perquè les files no canviïn d'alineació.
 */
export function FotoArticle({
  petita,
  gran = null,
  nom,
  className = "size-10",
}: {
  petita: string | null;
  gran?: string | null;
  nom: string;
  /** La mida del requadre: quadrat, en classes de Tailwind. */
  className?: string;
}) {
  const requadre = `${className} shrink-0 overflow-hidden rounded-md border border-line bg-white`;

  if (!petita) {
    const Icona = ICONES.articles;
    return (
      <span aria-hidden className={`${requadre} flex items-center justify-center bg-parchment/60 text-muted/50`}>
        <Icona className="size-1/2" />
      </span>
    );
  }

  // Ja arriba a la mida que toca des de la base de dades: no cal que Next la torni a optimitzar.
  const foto = <Image src={petita} alt={nom} width={80} height={80} unoptimized className="size-full object-contain" />;
  if (!gran) return <span className={requadre}>{foto}</span>;
  return (
    <a href={gran} target="_blank" rel="noreferrer" title={`Foto de ${nom}`} className={`${requadre} block transition hover:border-ink`}>
      {foto}
    </a>
  );
}
