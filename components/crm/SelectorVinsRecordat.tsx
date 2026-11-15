"use client";

import { useSyncExternalStore } from "react";

import { ConfiguradorVins, type TriaDelSelector } from "@/components/crm/ConfiguradorVins";
import type { ViDeCataleg } from "@/domini/cistella-vins";
import { CLAU_SELECTOR_VINS } from "@/lib/vistes-recordades";

/** Cal pujar-la si canvia la forma de `TriaDelSelector`: el que hi hagués desat d'abans s'ignora. */
const VERSIO = 1;

function llegeixTria(): TriaDelSelector | null {
  try {
    const desat = JSON.parse(sessionStorage.getItem(CLAU_SELECTOR_VINS) ?? "null");
    return desat?.versio === VERSIO ? desat.tria : null;
  } catch {
    return null;
  }
}

function desaTria(tria: TriaDelSelector) {
  try {
    sessionStorage.setItem(CLAU_SELECTOR_VINS, JSON.stringify({ versio: VERSIO, tria }));
  } catch {
    // Sense emmagatzematge, el selector va igual: només que en tornar-hi comença de nou.
  }
}

const senseSubscripcio = () => () => {};

/**
 * El configurador de la pàgina «Selector de vins», que recorda la tria: en
 * anar a una altra pantalla i tornar-hi, o en recarregar, es troba tal com es
 * va deixar. S'oblida en tancar la sessió o la pestanya (vegeu
 * `lib/vistes-recordades.ts`). El modal d'una activitat no passa per aquí: el
 * seu comença sempre amb els vins de l'activitat.
 *
 * `sessionStorage` només existeix al navegador: al servidor i en hidratar no es
 * pinta res, perquè l'estat inicial del configurador ja surti de la tria
 * recordada i els seus efectes no comencin des d'una tria buida. Navegant dins
 * del portal no hi ha hidratació, i es pinta de seguida.
 */
export function SelectorVinsRecordat({ catalegInicial }: { catalegInicial: ViDeCataleg[] }) {
  const alNavegador = useSyncExternalStore(senseSubscripcio, () => true, () => false);
  if (!alNavegador) return null;
  return <ConfiguradorVins catalegInicial={catalegInicial} recordada={llegeixTria()} alCanviarTria={desaTria} />;
}
