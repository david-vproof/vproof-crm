"use client";

import { useEffect } from "react";

/** Els camps on s'escriu: mentre n'hi ha un d'enfocat, el teclat és a dalt. */
function escrivint() {
  const actiu = document.activeElement;
  if (!(actiu instanceof HTMLElement)) return false;
  if (actiu.isContentEditable || actiu instanceof HTMLTextAreaElement || actiu instanceof HTMLSelectElement) return true;
  return (
    actiu instanceof HTMLInputElement &&
    !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "hidden"].includes(actiu.type)
  );
}

/**
 * El portal es mou com una app: la pàgina sencera no es desplaça mai, només el
 * panell de dins. Al telèfon, però, iOS empeny la pàgina sencera cap amunt
 * perquè el camp on s'escriu quedi per sobre del teclat, i quan el teclat
 * marxa de vegades no la torna a lloc: la capçalera queda tallada a dalt i hi
 * ha un forat a sota. Aquí, quan ja no s'escriu enlloc, es torna a posar a lloc.
 *
 * No toca res mentre s'escriu (el camp ha de quedar a la vista) ni si algú ha
 * ampliat la pantalla amb els dits: allò és seu.
 */
export function PantallaQuieta() {
  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;

    function aLloc() {
      clearTimeout(espera);
      // Deixa acabar l'animació del teclat, i el salt d'un camp a un altre.
      espera = setTimeout(() => {
        if (window.scrollX === 0 && window.scrollY === 0) return;
        if ((window.visualViewport?.scale ?? 1) > 1.01) return;
        if (escrivint()) return;
        window.scrollTo(0, 0);
      }, 150);
    }

    const vista = window.visualViewport;
    document.addEventListener("focusout", aLloc);
    window.addEventListener("scroll", aLloc, { passive: true });
    vista?.addEventListener("resize", aLloc);
    return () => {
      clearTimeout(espera);
      document.removeEventListener("focusout", aLloc);
      window.removeEventListener("scroll", aLloc);
      vista?.removeEventListener("resize", aLloc);
    };
  }, []);

  return null;
}
