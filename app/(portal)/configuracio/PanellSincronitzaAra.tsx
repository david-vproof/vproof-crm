"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Etiqueta, Seccio } from "@/components/UI";
import { type EstatExecucio, type Taula, FITXA_TAULA, TAULES } from "@/domini/sincronitzacio";
import { dataHoraCurta, durada } from "@/lib/format";

import { EtiquetaEstatExecucio } from "./EstatExecucio";
import { SeguimentEnViu } from "./SeguimentEnViu";
import { type Pas, useCuaSincronitzacio } from "./useCuaSincronitzacio";

/** El que la pantalla sap de cada taula abans de triar-la. */
export type TaulaPerTriar = {
  taula: Taula;
  /** En marxa ara, aquí o en una altra instància: no es pot tornar a engegar, però s'hi pot mirar. */
  enCurs: boolean;
  darrera: { estat: EstatExecucio; inici: string; fi: string | null; resum: string } | null;
  /** Quan la farà el programador, si està programada. */
  propera: string | null;
};

/**
 * La sincronització global: es tria què es vol portar de FactuSol i el
 * portal ho fa en l'ordre que toca, una taula darrere l'altra, explicant-ho
 * en viu. Si en obrir la pantalla ja n'hi ha alguna en marxa, s'hi enganxa.
 */
export function PanellSincronitzaAra({
  taules,
  preseleccio,
  potSincronitzar,
  motiu,
}: {
  taules: TaulaPerTriar[];
  preseleccio: Taula[];
  potSincronitzar: boolean;
  /** Per què no es pot, si no es pot. */
  motiu?: string;
}) {
  const router = useRouter();
  const { passos, conduint, enMarxa, darrerSenyal, ara, engega, enganxa, reconnecta } = useCuaSincronitzacio();
  const [seleccio, setSeleccio] = useState<Set<Taula>>(() => new Set(preseleccio));
  const enganxat = useRef(false);

  // Les que ja corren quan s'obre la pantalla: s'hi enganxa, i en acabar es repinta tot.
  useEffect(() => {
    if (enganxat.current) return;
    enganxat.current = true;
    const enCurs = taules.filter((t) => t.enCurs).map((t) => t.taula);
    if (enCurs.length === 0) return;
    void enganxa(enCurs).then(() => router.refresh());
  }, [taules, enganxa, router]);

  const perTaula = new Map(taules.map((t) => [t.taula, t]));
  const triades = TAULES.filter((taula) => seleccio.has(taula));
  const alguna = triades.some((taula) => perTaula.get(taula)?.enCurs);
  const potEngegar = potSincronitzar && !enMarxa && triades.length > 0 && !alguna;

  async function executa() {
    if (!potEngegar) return;
    await engega(triades);
    router.refresh();
  }

  function tria(taula: Taula, marcada: boolean) {
    setSeleccio((previa) => {
      const nova = new Set(previa);
      if (marcada) nova.add(taula);
      else nova.delete(taula);
      return nova;
    });
  }

  return (
    <Seccio
      titol="Sincronitza ara"
      accions={
        <span className="flex gap-3 text-[12.5px]">
          <button type="button" onClick={() => setSeleccio(new Set(TAULES))} disabled={enMarxa} className="text-wine underline-offset-2 hover:underline disabled:opacity-50">
            Totes
          </button>
          <button type="button" onClick={() => setSeleccio(new Set())} disabled={enMarxa} className="text-muted underline-offset-2 hover:underline disabled:opacity-50">
            Cap
          </button>
        </span>
      }
    >
      <p className="text-[14px] leading-relaxed text-muted">
        Tria què vols portar de FactuSol. L&apos;ordre el posa el portal, perquè cada taula apunta a l&apos;anterior: primer els
        clients, després els proveïdors, els articles i, al final, els albarans. Cada passada només escriu el que ha canviat i
        no esborra mai res.
      </p>

      <ul className="mt-4 divide-y divide-line/70 rounded-lg border border-line bg-white">
        {TAULES.map((taula) => {
          const fitxa = FITXA_TAULA[taula];
          const info = perTaula.get(taula);
          const marcada = seleccio.has(taula);
          return (
            <li key={taula}>
              <label className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-parchment/40 ${enMarxa ? "cursor-default" : ""}`}>
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={enMarxa}
                  onChange={(e) => tria(taula, e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-wine"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-medium text-ink">{fitxa.etiqueta}</span>
                    <span className="font-mono text-[12px] text-muted">
                      {fitxa.origen} → {fitxa.desti}
                    </span>
                    {fitxa.pesada ? <Etiqueta>Llarga</Etiqueta> : null}
                    {info?.enCurs ? <Etiqueta to="blau">En curs</Etiqueta> : null}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">{fitxa.porta}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                    {info?.darrera ? (
                      <>
                        <span>Darrera {dataHoraCurta(info.darrera.fi ?? info.darrera.inici)}</span>
                        <EtiquetaEstatExecucio estat={info.darrera.estat} />
                        <span className="hidden sm:inline">{info.darrera.resum}</span>
                      </>
                    ) : (
                      <span>Encara cap passada</span>
                    )}
                    {info?.propera ? <span>· programada per {dataHoraCurta(info.propera)}</span> : null}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={executa} disabled={!potEngegar} className="btn-compacte">
          {conduint
            ? "Sincronitzant…"
            : triades.length === 0
              ? "Tria alguna taula"
              : triades.length === 1
                ? `Sincronitza ${FITXA_TAULA[triades[0]].plural}`
                : `Sincronitza ${triades.length} taules`}
        </button>
        <p className="text-[12.5px] text-muted">
          {!potSincronitzar
            ? motiu
            : alguna && !enMarxa
              ? "Alguna de les triades ja és en marxa: espera que acabi."
              : conduint
                ? "Deixa aquesta pestanya oberta: la cua la porta el navegador, una taula darrere l'altra."
                : "Cada taula va en la seva petició, amb tres minuts d'escriptura com a molt; el que no hi cap es fa a la següent."}
        </p>
      </div>

      {passos.length > 0 ? (
        <ol className="mt-5 space-y-3" aria-live="polite">
          {passos.map((pas) => (
            <li key={pas.taula} className="rounded-lg border border-line p-4">
              <CapceleraPas pas={pas} ara={ara} />
              {pas.estat ? (
                <div className="mt-3">
                  <SeguimentEnViu
                    estat={pas.estat}
                    ara={ara}
                    darrerSenyal={darrerSenyal}
                    connexio={pas.connexio}
                    alReconnectar={() => void reconnecta(pas.taula)}
                  />
                </div>
              ) : pas.situacio === "en_curs" ? (
                <p className="mt-2 text-[13px] text-muted">
                  {pas.connexio === "ok" ? "Engegant…" : pas.connexio === "reconnectant" ? "Tornant a connectar…" : "Sense connexió amb el servidor."}
                </p>
              ) : pas.situacio === "acabat" && pas.final ? (
                <p className={`mt-2 rounded-lg px-3.5 py-2.5 text-[13px] ${pas.final.estat === "error" ? "bg-wine-tint text-wine-deep" : "bg-parchment text-ink"}`}>
                  {pas.final.missatge}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {passos.length > 0 && !enMarxa ? <Balanç passos={passos} /> : null}
    </Seccio>
  );
}

function CapceleraPas({ pas, ara }: { pas: Pas; ara: number }) {
  const fitxa = FITXA_TAULA[pas.taula];
  const estatFinal = pas.final?.estat ?? pas.estat?.final?.estat ?? null;
  const transcorregut = pas.estat ? (pas.estat.final ? Date.parse(pas.estat.final.fi) : ara) - Date.parse(pas.estat.inici) : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <span className="flex items-center gap-2">
        <Marca situacio={pas.situacio} estat={estatFinal} />
        <span className="text-[14px] font-medium text-ink">{fitxa.etiqueta}</span>
        <span className="font-mono text-[12px] text-muted">{fitxa.origen}</span>
      </span>
      <span className="flex items-center gap-2 text-[12.5px] text-muted">
        {pas.situacio === "cua" ? "En cua" : null}
        {pas.situacio === "en_curs" && !pas.estat ? <EtiquetaEstatExecucio estat="en_curs" /> : null}
        {estatFinal ? <EtiquetaEstatExecucio estat={estatFinal} /> : null}
        {transcorregut !== null && pas.situacio !== "en_curs" ? <span className="tabular-nums">{durada(transcorregut)}</span> : null}
      </span>
    </div>
  );
}

/** El punt de l'esquerra: gris en cua, batent en curs, i del color del final. */
function Marca({ situacio, estat }: { situacio: Pas["situacio"]; estat: EstatExecucio | null }) {
  const color =
    situacio === "cua"
      ? "bg-line"
      : situacio === "en_curs"
        ? "bg-sky-500 animate-pulse"
        : estat === "correcte"
          ? "bg-emerald-500"
          : estat === "parcial"
            ? "bg-amber-500"
            : "bg-wine";
  return <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${color}`} />;
}

/** En acabar la cua: com ha anat, en una línia, i on veure'n el detall. */
function Balanç({ passos }: { passos: Pas[] }) {
  const estats = passos.map((pas) => pas.final?.estat ?? "error");
  const correctes = estats.filter((e) => e === "correcte").length;
  const parcials = estats.filter((e) => e === "parcial").length;
  const fallides = estats.filter((e) => e === "error").length;
  const to = fallides ? "bg-wine-tint text-wine-deep" : parcials ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800";
  return (
    <div className={`mt-4 rounded-lg px-3.5 py-2.5 text-[13px] ${to}`}>
      <p>
        {passos.length === 1 ? "Passada acabada" : `${passos.length} passades acabades`}
        {correctes ? ` · ${correctes} correctes` : ""}
        {parcials ? ` · ${parcials} amb files sense copiar` : ""}
        {fallides ? ` · ${fallides} fallides` : ""}.
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {passos.map((pas) => (
          <Link key={pas.taula} href={`/configuracio?t=${pas.taula}`} className="underline underline-offset-2">
            Resultats de {FITXA_TAULA[pas.taula].plural}
          </Link>
        ))}
      </p>
    </div>
  );
}

/** Per a la pestanya de resultats d'una taula que és en marxa: s'hi enganxa i, en acabar, repinta la pàgina. */
export function SeguimentAdjunt({ taula }: { taula: Taula }) {
  const router = useRouter();
  const { passos, darrerSenyal, ara, enganxa, reconnecta } = useCuaSincronitzacio();
  const enganxat = useRef(false);

  useEffect(() => {
    if (enganxat.current) return;
    enganxat.current = true;
    void enganxa([taula]).then(() => router.refresh());
  }, [taula, enganxa, router]);

  const pas = passos[0];
  if (!pas?.estat) return <p className="text-[13px] text-muted">Connectant amb la passada en curs…</p>;
  return (
    <SeguimentEnViu estat={pas.estat} ara={ara} darrerSenyal={darrerSenyal} connexio={pas.connexio} alReconnectar={() => void reconnecta(taula)} />
  );
}
