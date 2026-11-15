"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type MouseEvent } from "react";

/**
 * Navegar des del menú amb un avís de càrrega. `navega` fa el canvi de pàgina
 * dins d'una transició: `pendent` és cert des del clic fins que la pàgina nova
 * ja és pintada, que és el que no es veu quan el servidor triga. El clic amb
 * tecla (obrir en una pestanya nova) o amb el botó del mig es deixa al navegador.
 */
export function useNavegacioAmbEspera() {
  const router = useRouter();
  const [pendent, comenca] = useTransition();

  const navega = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    comenca(() => router.push(href));
  };

  return { pendent, navega };
}

/**
 * El modal de «carregant»: el fons s'enfosqueix i al mig hi ha la rodeta.
 * Surt al cap d'un moment, perquè una pàgina que ja és a la memòria no faci
 * un parpelleig, i tapa tota la pantalla perquè no es cliqui res mentrestant.
 */
export function ModalCarregant({ obert }: { obert: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!obert) {
      setVisible(false);
      return;
    }
    const espera = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(espera);
  }, [obert]);

  if (!visible) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Carregant la pàgina"
      aria-busy="true"
      className="fixed inset-0 z-[70] grid place-items-center bg-ink/40 animate-[apareix_160ms_ease-out]"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl bg-cream px-8 py-6 text-ink shadow-2xl">
        <span
          aria-hidden="true"
          className="size-9 animate-spin rounded-full border-[3px] border-line border-t-wine motion-reduce:animate-[spin_2s_linear_infinite]"
        />
        <p className="text-[13.5px] text-muted">Carregant…</p>
      </div>
    </div>
  );
}
