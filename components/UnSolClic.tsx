"use client";

import { useEffect } from "react";

/**
 * Un doble clic fa el mateix que un clic. Molta gent fa doble clic per costum,
 * i el segon clic arriba quan el primer ja ha fet la feina: «Desa» ja envia,
 * el client ja és triat o l'enllaç ja porta a una altra pantalla. Aquell segon
 * clic tornaria a enviar, desfaria la tria o cauria sobre un altre botó que
 * ara és al mateix lloc. Aquí es llença abans que arribi enlloc.
 *
 * Només compta el segon clic al mateix punt i de seguida (`detail` > 1): dos
 * clics separats funcionen com sempre, i el teclat (`detail` 0) no hi entra.
 * El mapa té el seu propi doble clic, el zoom, i es deixa tranquil.
 */
export function UnSolClic() {
  useEffect(() => {
    function llenca(e: MouseEvent) {
      if (e.detail < 2) return;
      if (e.target instanceof Element && e.target.closest(".leaflet-container")) return;
      e.preventDefault();
      e.stopPropagation();
    }
    // En captura i a la finestra: abans que cap altre element el pugui atendre.
    window.addEventListener("click", llenca, true);
    return () => window.removeEventListener("click", llenca, true);
  }, []);

  return null;
}
