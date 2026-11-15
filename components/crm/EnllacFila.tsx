"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

/**
 * L'enllaç d'una fila d'un llistat. Els enllaços de Next demanen la pàgina per
 * endavant quan entren a la pantalla: baixant per una llista llarga serien
 * centenars de peticions de fitxes que no s'obriran. Aquest la demana en passar-hi
 * el cursor o en tocar-lo, que ja és prou abans del clic perquè la capa surti a l'acte.
 *
 * I no fa pujar la llista: la fitxa s'obre a sobre, i la llista s'ha de quedar on era.
 */
export function EnllacFila({ href, ...resta }: { href: string } & Omit<ComponentProps<typeof Link>, "href" | "prefetch" | "scroll" | "onMouseEnter" | "onTouchStart">) {
  const router = useRouter();
  const demana = () => router.prefetch(href);
  return <Link href={href} prefetch={false} scroll={false} onMouseEnter={demana} onTouchStart={demana} {...resta} />;
}
