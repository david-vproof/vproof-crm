"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

import { esRutaDeFitxaClient } from "@/lib/navegacio";

/** On porta tancar la fitxa quan no hi ha cap vista al darrere: s'hi ha entrat de cop. */
const FONS_PER_DEFECTE = "/crm?v=clients";

const Context = createContext<(() => void) | null>(null);

/**
 * Embolcalla tot el CRM i sap tancar la fitxa d'un client.
 *
 * La fitxa s'obre a sobre de la vista d'on es ve, que es queda muntada al
 * darrere tal com era. Tancar-la és tornar enrere a l'historial: la vista surt
 * de la memòria del navegador, sense tornar-la a demanar al servidor. Si s'ha
 * entrat de cop a la fitxa (un enllaç de fora, recarregar), no hi ha cap vista
 * a què tornar i es va a la llista de clients.
 */
export function FonsCrm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  // Si l'entrada d'abans de la fitxa a l'historial és una vista del CRM.
  const ambFons = useRef(false);
  const anterior = useRef<string | null>(null);
  // Si s'hi ha arribat amb els botons del navegador: llavors no se sap què hi ha al darrere.
  const perHistorial = useRef(false);
  const tancant = useRef(false);

  useEffect(() => {
    const marca = () => {
      perHistorial.current = true;
    };
    window.addEventListener("popstate", marca);
    return () => window.removeEventListener("popstate", marca);
  }, []);

  useEffect(() => {
    const venia = anterior.current;
    anterior.current = ruta;
    if (esRutaDeFitxaClient(ruta) && (venia === null || !esRutaDeFitxaClient(venia))) {
      ambFons.current = venia !== null && !perHistorial.current;
    }
    perHistorial.current = false;
  }, [ruta]);

  const tanca = useCallback(() => {
    if (!ambFons.current) {
      router.replace(FONS_PER_DEFECTE, { scroll: false });
      return;
    }
    if (tancant.current) return;
    tancant.current = true;
    // Dins la fitxa tot es mou amb `replace`; si algun enllaç hi hagués deixat
    // una entrada, en tornar enrere encara s'hi és, i cal un pas més.
    const segueix = () => {
      if (esRutaDeFitxaClient(window.location.pathname)) {
        window.history.back();
        return;
      }
      window.removeEventListener("popstate", segueix);
      tancant.current = false;
    };
    window.addEventListener("popstate", segueix);
    window.history.back();
  }, [router]);

  return <Context.Provider value={tanca}>{children}</Context.Provider>;
}

/** Tanca la fitxa del client i torna a la vista de darrere. */
export function useTancaFitxa() {
  const tanca = useContext(Context);
  const router = useRouter();
  return tanca ?? (() => router.replace(FONS_PER_DEFECTE));
}
