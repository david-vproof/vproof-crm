"use client";

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import { FilaTargeta, FilaTaula, MARCA_ID, repartimentDeColumnes, type ColumnaDeFila, type Posicio } from "@/components/crm/FilesRegistres";
import { TRAM_SCROLL } from "@/domini/crm-llistat";
import type { FilaLlistat } from "@/serveis/crm-manteniment";

/** Quants píxels abans del final es demana el tram següent, perquè en baixar no s'arribi a veure el buit. */
const MARGE_PX = 800;

type Estat = {
  /** Les files que s'han anat afegint a les que ha pintat el servidor. */
  afegides: FilaLlistat[];
  /** Quantes n'han arribat, comptant les repetides: per saber des d'on continuar. */
  demanades: number;
  total: number;
  fase: "quiet" | "carregant" | "error";
};

type ValorScroll = {
  files: FilaLlistat[];
  visibles: Posicio[];
  delTitol: Posicio[];
  plantillaEnllac: string;
  fase: Estat["fase"];
  queden: boolean;
  /** Si ja se n'ha afegit alguna: una llista que cap en un tram no ha de dir que s'ha acabat. */
  ambAfegides: boolean;
  sentinella: RefObject<HTMLDivElement | null>;
  reintenta: () => void;
};

const Context = createContext<ValorScroll | null>(null);

function useScroll() {
  const valor = useContext(Context);
  if (!valor) throw new Error("Les files afegides i el peu van dins d'un ScrollRegistres.");
  return valor;
}

/** La llista és dins d'una capa que es desplaça: l'observador ha de mirar respecte d'ella, si no el marge no compta. */
function contenidorQueEsDesplaca(element: Element) {
  for (let pare = element.parentElement; pare; pare = pare.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(pare).overflowY)) return pare;
  }
  return null;
}

/** Si entre tram i tram s'ha creat o esborrat alguna fitxa, una pot tornar a arribar: la clau de la fila no es pot repetir. */
function senseRepetides(files: FilaLlistat[]) {
  return [...new Map(files.map((fila) => [fila.id, fila])).values()];
}

const esCancel·lada = (error: unknown) => (error as Error).name === "AbortError";

/**
 * Un llistat que es va allargant en baixar, a trams, en lloc de paginar. El
 * primer tram el pinta el servidor; la resta es demana quan el final de la
 * llista s'acosta a la part visible. L'estat viu aquí, per sobre de la llista
 * de fitxes del telèfon i de la taula, que ensenyen les mateixes files.
 *
 * Es munta de nou per a cada consulta (la clau li posa TaulaRegistres): canviar
 * l'ordre o els filtres torna a començar. Obrir la fitxa d'un client no el
 * desmunta, i en tancar-la la llista és com era.
 */
export function ScrollRegistres({
  consulta,
  inicials,
  total,
  columnes,
  plantillaEnllac,
  children,
}: {
  /** Els paràmetres que defineixen què es llista: la vista, l'ordre i els filtres. */
  consulta: string;
  /** Els ids del tram que ha pintat el servidor. */
  inicials: string[];
  total: number;
  columnes: ColumnaDeFila[];
  /** L'enllaç d'una fila, amb `MARCA_ID` al lloc de l'id. */
  plantillaEnllac: string;
  children: ReactNode;
}) {
  const [estat, setEstat] = useState<Estat>({ afegides: [], demanades: 0, total, fase: "quiet" });
  const sentinella = useRef<HTMLDivElement>(null);
  const peticio = useRef<AbortController | null>(null);

  const seguent = inicials.length + estat.demanades;
  const queden = seguent < estat.total;

  /** Només hi ha una petició alhora: la que arriba anul·la la que encara corria. */
  const demana = useCallback(
    async (salta: number, quantes: number) => {
      peticio.current?.abort();
      const controlador = new AbortController();
      peticio.current = controlador;
      const parametres = new URLSearchParams(consulta);
      parametres.set("salta", String(salta));
      parametres.set("quantes", String(quantes));
      const resposta = await fetch(`/api/crm/llistat?${parametres}`, { signal: controlador.signal, cache: "no-store" });
      if (!resposta.ok) throw new Error(`Resposta ${resposta.status}`);
      return (await resposta.json()) as { files: FilaLlistat[]; total: number };
    },
    [consulta],
  );

  const carregaMes = useCallback(async () => {
    setEstat((previ) => ({ ...previ, fase: "carregant" }));
    try {
      const { files, total: llegit } = await demana(seguent, TRAM_SCROLL);
      setEstat((previ) => ({
        afegides: senseRepetides([...previ.afegides, ...files]),
        demanades: previ.demanades + files.length,
        // Un tram buit vol dir que ja no n'hi ha més, digui el que digui el recompte: si no, es tornaria a demanar sense parar.
        total: files.length === 0 ? seguent : llegit,
        fase: "quiet",
      }));
    } catch (error) {
      if (!esCancel·lada(error)) setEstat((previ) => ({ ...previ, fase: "error" }));
    }
  }, [demana, seguent]);

  // El final de la llista s'acosta: el tram següent. L'observador es torna a posar després de
  // cada tram, i avisa de seguida si el final encara és a prop: una pantalla alta en demana dos.
  useEffect(() => {
    const element = sentinella.current;
    if (!element || !queden || estat.fase !== "quiet") return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) void carregaMes();
      },
      { root: contenidorQueEsDesplaca(element), rootMargin: `${MARGE_PX}px 0px` },
    );
    observador.observe(element);
    return () => observador.disconnect();
  }, [queden, estat.fase, carregaMes]);

  // Si el servidor torna a pintar la llista és que s'ha desat alguna cosa. El primer tram ja
  // arriba nou; els afegits es tornen a demanar, tots alhora, perquè la llista no s'escurci i
  // no es perdi on s'era.
  const pintades = useRef(inicials);
  const { demanades } = estat;
  useEffect(() => {
    if (pintades.current === inicials) return;
    pintades.current = inicials;
    if (demanades === 0) {
      setEstat((previ) => ({ ...previ, total }));
      return;
    }
    setEstat((previ) => ({ ...previ, total, fase: "carregant" }));
    demana(inicials.length, demanades)
      .then(({ files, total: llegit }) => {
        setEstat({ afegides: senseRepetides(files), demanades: files.length, total: llegit, fase: "quiet" });
      })
      .catch((error: unknown) => {
        // Sense poder-les refrescar, val més deixar les que hi havia que treure-les.
        if (!esCancel·lada(error)) setEstat((previ) => ({ ...previ, fase: "quiet" }));
      });
  }, [inicials, total, demanades, demana]);

  useEffect(() => () => peticio.current?.abort(), []);

  const { visibles, delTitol } = useMemo(() => repartimentDeColumnes(columnes), [columnes]);
  // Una fitxa pot haver passat al primer tram (s'ha canviat de nom): llavors surt només allà.
  const files = useMemo(() => {
    const delServidor = new Set(inicials);
    return estat.afegides.filter((fila) => !delServidor.has(fila.id));
  }, [estat.afegides, inicials]);

  return (
    <Context.Provider
      value={{
        files,
        visibles,
        delTitol,
        plantillaEnllac,
        fase: estat.fase,
        queden,
        ambAfegides: estat.demanades > 0,
        sentinella,
        reintenta: () => void carregaMes(),
      }}
    >
      {children}
    </Context.Provider>
  );
}

// Cada tram torna a pintar la llista: les files que ja hi eren no han de tornar a treballar.
const TargetaMemo = memo(FilaTargeta);
const FilaTaulaMemo = memo(FilaTaula);

const enllacDeFila = (plantilla: string, id: string) => plantilla.replace(MARCA_ID, encodeURIComponent(id));

/*
 * Les afegides van en un element propi, al costat del que ha pintat el servidor i
 * no a dins: un component de client entre les files del servidor és l'últim que
 * arriba de la càrrega RSC, i la hidratació hi topava a mig `<tbody>` («Hydration
 * failed»). Una taula pot tenir més d'un `<tbody>`, i les columnes són les mateixes.
 */

/** Les files afegides a la llista de fitxes del telèfon. */
export function TargetesAfegides() {
  const { files, visibles, delTitol, plantillaEnllac } = useScroll();
  if (files.length === 0) return null;
  return (
    <ul className="divide-y divide-line/70 border-b border-line md:hidden">
      {files.map((fila) => (
        <TargetaMemo key={fila.id} fila={fila} visibles={visibles} delTitol={delTitol} href={enllacDeFila(plantillaEnllac, fila.id)} />
      ))}
    </ul>
  );
}

/** Les files afegides a la taula. */
export function FilesAfegides() {
  const { files, visibles, delTitol, plantillaEnllac } = useScroll();
  if (files.length === 0) return null;
  return (
    <tbody>
      {files.map((fila) => (
        <FilaTaulaMemo key={fila.id} fila={fila} visibles={visibles} delTitol={delTitol} href={enllacDeFila(plantillaEnllac, fila.id)} />
      ))}
    </tbody>
  );
}

/** A sota de la llista: és el que l'observador vigila, i diu què passa quan s'hi arriba abans que les files. */
export function PeuScroll() {
  const { sentinella, fase, queden, ambAfegides, reintenta } = useScroll();
  return (
    <div ref={sentinella} role="status" className="shrink-0 px-4 py-4 text-center text-[13px] text-muted sm:px-5">
      {fase === "error" ? (
        <>
          No s&apos;han pogut carregar més fitxes.{" "}
          <button type="button" onClick={reintenta} className="text-marca underline underline-offset-2">
            Torna-ho a provar
          </button>
        </>
      ) : queden ? (
        "Carregant més fitxes…"
      ) : ambAfegides ? (
        "No n'hi ha més."
      ) : null}
    </div>
  );
}
