"use client";

import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { desaFitxaAccio, type EstatFitxa } from "@/app/(portal)/crm/accions";
import { useTancaFitxa } from "@/components/crm/FonsCrm";

/**
 * On es va després de desar, quan ho decideix el navegador i no l'acció: a la
 * fitxa d'un client, que és a sobre d'una vista. Tancar-la torna a la vista;
 * «ves» és tornar a la pestanya d'on s'ha obert el que s'ha desat.
 */
export type DespresDeDesar = { mena: "tanca" } | { mena: "ves"; href: string };

type Edicio = {
  estat: EstatFitxa;
  accio: (dades: FormData) => void;
  enviant: boolean;
  /**
   * L'id del formulari, que el botó «Desa» fa servir per enviar-lo des de
   * fora. És propi de cada edició: amb la fitxa d'un client oberta a sobre
   * d'una activitat, hi ha dos formularis a la pàgina.
   */
  idFormulari: string;
  /** Si l'acció no ha de redirigir: qui mana on anar és `despres`. */
  senseRedireccio: boolean;
  /**
   * Un fitxer que s'ha d'enviar amb el formulari. Va a part i no en un `<input
   * type="file">` perquè és la foto ja reduïda, no la triada, i perquè React buida
   * els camps en acabar l'acció: amb un error, la foto es perdria sense dir res.
   */
  adjunta: (nom: string, fitxer: File | null) => void;
  /** Mentre es prepara un fitxer no es pot desar: el formulari sortiria sense. */
  preparant: boolean;
  setPreparant: (preparant: boolean) => void;
};

const Context = createContext<Edicio | null>(null);

/**
 * L'estat del desat viu aquí, per sobre del panell, perquè qui el necessita
 * està en dos llocs: el botó «Desa» a la capçalera i el formulari al cos.
 * Es munta de nou per a cada fitxa que s'edita, així l'error d'una no es
 * queda penjat a la següent.
 */
export function EdicioFitxa({ despres, children }: { despres?: DespresDeDesar; children: ReactNode }) {
  const [estat, accioDesa, enviant] = useActionState<EstatFitxa, FormData>(desaFitxaAccio, {});
  const [preparant, setPreparant] = useState(false);
  const adjunts = useRef(new Map<string, File>());
  const adjunta = (nom: string, fitxer: File | null) => {
    if (fitxer) adjunts.current.set(nom, fitxer);
    else adjunts.current.delete(nom);
  };
  const accio = (dades: FormData) => {
    for (const [nom, fitxer] of adjunts.current) dades.set(nom, fitxer);
    accioDesa(dades);
  };
  const idFormulari = useId();
  const tanca = useTancaFitxa();
  const router = useRouter();
  // Cada desat es fa servir un sol cop: tornar a pintar la fitxa no ha de tornar a tancar-la.
  const jaFet = useRef<EstatFitxa | null>(null);

  useEffect(() => {
    if (!despres || !estat.desat || jaFet.current === estat) return;
    jaFet.current = estat;
    if (despres.mena === "tanca") tanca();
    else router.replace(despres.href, { scroll: false });
  }, [estat, despres, tanca, router]);

  return (
    <Context.Provider value={{ estat, accio, enviant, idFormulari, senseRedireccio: Boolean(despres), adjunta, preparant, setPreparant }}>
      {children}
    </Context.Provider>
  );
}

export function useEdicio() {
  const edicio = useContext(Context);
  if (!edicio) throw new Error("FormulariFitxa i BotoDesa han d'anar dins d'un EdicioFitxa.");
  return edicio;
}

/** Envia el formulari des de fora: l'atribut `form` el lliga per id. */
export function BotoDesa() {
  const { enviant, idFormulari, preparant } = useEdicio();
  return (
    <button type="submit" form={idFormulari} disabled={enviant || preparant} className="btn-compacte">
      {enviant ? "Desant…" : preparant ? "Preparant la foto…" : "Desa"}
    </button>
  );
}
