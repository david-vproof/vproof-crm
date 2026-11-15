"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Una columna que s'obre per l'adreça també es tanca amb Escape: porta a `href`, que és l'adreça sense ella. */
export function TancaAmbEscape({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const ambEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) router.push(href, { scroll: false });
    };
    document.addEventListener("keydown", ambEscape);
    return () => document.removeEventListener("keydown", ambEscape);
  }, [href, router]);
  return null;
}
