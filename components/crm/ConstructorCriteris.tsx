"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  ETIQUETA_OPERADOR,
  SENSE_VALOR,
  VARIABLES,
  llegeixCriteris,
  variable,
  type Criteri,
  type Operador,
} from "@/domini/crm-segments";
import { rutaDelClient } from "@/lib/navegacio";

type Prova = { total: number; deQuants: number; comptes: { id: string; nom: string }[] };

type OpcionsRelacio = Record<string, { id: string; text: string }[]>;

/** Un criteri buit del primer camp disponible, per començar. */
function criteriNou(): Criteri {
  const primera = VARIABLES[0];
  return { camp: primera.nom, operador: primera.operadors[0], valors: [] };
}

/**
 * La llista de criteris per editar, i prou: qui la fa servir en guarda l'estat.
 * La munta el constructor de segments i també el selector de clients, on els
 * criteris d'un segment es retoquen només per a una cerca.
 */
export function EditorCriteris({
  criteris,
  alCanviar,
  opcionsRelacio = {},
  buit = "Encara no hi ha cap criteri.",
  peu,
}: {
  criteris: Criteri[];
  alCanviar: (criteris: Criteri[]) => void;
  /** Les fitxes dels catàlegs (els tipus de client), per a les variables de relació. */
  opcionsRelacio?: OpcionsRelacio;
  /** Què dir quan no n'hi ha cap. */
  buit?: string;
  /** El que va al costat del botó d'afegir, com l'avís de «Provant…». */
  peu?: ReactNode;
}) {
  const canvia = (posicio: number, canvi: Partial<Criteri>) =>
    alCanviar(criteris.map((criteri, i) => (i === posicio ? { ...criteri, ...canvi } : criteri)));

  return (
    <>
      {criteris.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-[13px] text-muted">{buit}</p>
      ) : (
        <ul className="space-y-2">
          {criteris.map((criteri, posicio) => {
            const meta = variable(criteri.camp);
            const senseValor = SENSE_VALOR.includes(criteri.operador);
            // Les d'una relació surten de la base de dades; les d'una tria, de la fitxa.
            const opcions: [string, string][] | undefined = meta?.relacio
              ? (opcionsRelacio[meta.relacio] ?? []).map((o): [string, string] => [o.id, o.text])
              : meta?.opcions;
            // D'una relació es desa l'id, i el nom per als llistats, que no tenen la llista a mà.
            const ambValors = (valors: string[]): Partial<Criteri> =>
              meta?.relacio
                ? { valors, textos: valors.map((valor) => opcions?.find(([id]) => id === valor)?.[1] ?? valor) }
                : { valors };

            return (
              <li key={posicio} className="rounded-lg border border-line bg-white p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    aria-label="Variable"
                    className="field-compacte !w-auto min-w-[130px] flex-1"
                    value={criteri.camp}
                    onChange={(e) => {
                      const nova = variable(e.target.value);
                      canvia(posicio, {
                        camp: e.target.value,
                        operador: nova?.operadors[0] ?? "es",
                        valors: [],
                        textos: undefined,
                      });
                    }}
                  >
                    {/* La ubicació no es tria aquí: la crea l'eina de regions del mapa. */}
                    {VARIABLES.filter((v) => v.tipus !== "regio" || v.nom === criteri.camp).map((v) => (
                      <option key={v.nom} value={v.nom}>
                        {v.etiqueta}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Condició"
                    className="field-compacte !w-auto min-w-[120px]"
                    value={criteri.operador}
                    onChange={(e) => {
                      const operador = e.target.value as Operador;
                      canvia(posicio, { operador, ...ambValors(SENSE_VALOR.includes(operador) ? [] : criteri.valors) });
                    }}
                  >
                    {(meta?.operadors ?? []).map((operador) => (
                      <option key={operador} value={operador}>
                        {ETIQUETA_OPERADOR[operador]}
                      </option>
                    ))}
                  </select>

                  {senseValor ? null : meta?.tipus === "regio" ? (
                    <span className="min-w-[130px] flex-1 text-[12.5px] text-muted">
                      {criteri.valors.length} {criteri.valors.length === 1 ? "regió dibuixada" : "regions dibuixades"} al mapa
                    </span>
                  ) : criteri.operador === "algun_de" && opcions ? null : opcions ? (
                    <select
                      aria-label="Valor"
                      className="field-compacte !w-auto min-w-[130px] flex-1"
                      value={criteri.valors[0] ?? ""}
                      onChange={(e) => canvia(posicio, ambValors(e.target.value ? [e.target.value] : []))}
                    >
                      <option value="">—</option>
                      {opcions.map(([valor, text]) => (
                        <option key={valor} value={valor}>
                          {text}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label="Valor"
                      className="field-compacte !w-auto min-w-[130px] flex-1"
                      type={
                        meta?.tipus === "data"
                          ? "date"
                          : meta?.tipus === "nombre" || meta?.tipus === "decimal" || meta?.tipus === "import"
                            ? "number"
                            : "text"
                      }
                      value={criteri.valors[0] ?? ""}
                      // Dins d'un formulari, Enter l'enviaria sencer.
                      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                      onChange={(e) => canvia(posicio, { valors: e.target.value ? [e.target.value] : [] })}
                    />
                  )}

                  <button
                    type="button"
                    aria-label="Treu el criteri"
                    onClick={() => alCanviar(criteris.filter((_, i) => i !== posicio))}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-[15px] leading-none text-muted transition hover:bg-marca-clar hover:text-marca"
                  >
                    ×
                  </button>
                </div>

                {/* «És un de» admet diversos valors: es trien com a etiquetes. */}
                {criteri.operador === "algun_de" && opcions ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {opcions.map(([valor, text]) => {
                      const triat = criteri.valors.includes(valor);
                      return (
                        <button
                          key={valor}
                          type="button"
                          aria-pressed={triat}
                          onClick={() =>
                            canvia(
                              posicio,
                              ambValors(triat ? criteri.valors.filter((v) => v !== valor) : [...criteri.valors, valor]),
                            )
                          }
                          className={`rounded-full px-2 py-0.5 text-[12px] transition ${
                            triat ? "bg-marca text-cream" : "bg-parchment text-ink-soft hover:bg-parchment/70"
                          }`}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => alCanviar([...criteris, criteriNou()])}
          className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] transition hover:border-ink"
        >
          + Afegeix criteri
        </button>
        {peu}
      </div>
    </>
  );
}

/**
 * Munta les condicions d'un segment.
 *
 * El valor de debò viatja en un camp ocult amb JSON, de manera que el formulari
 * de fitxes el desa com qualsevol altre camp. Mentre s'edita, es va preguntant
 * al servidor quants clients hi encaixarien: un filtre que no agafa ningú és
 * molt més fàcil de veure així que llegint-lo.
 */
export function ConstructorCriteris({
  nom,
  inicial,
  opcionsRelacio = {},
}: {
  nom: string;
  inicial: unknown;
  /** Les fitxes dels catàlegs (els tipus de client), per a les variables de relació. */
  opcionsRelacio?: OpcionsRelacio;
}) {
  const [criteris, setCriteris] = useState<Criteri[]>(() => llegeixCriteris(inicial));
  const [mode, setMode] = useState("tots");
  const [prova, setProva] = useState<Prova | null>(null);
  const [provant, setProvant] = useState(false);
  const ocult = useRef<HTMLInputElement>(null);

  const json = useMemo(() => JSON.stringify(criteris), [criteris]);

  // El mode és un camp germà dins el mateix formulari: se'n llegeix el valor i
  // se'n segueixen els canvis, perquè la prova digui la veritat.
  useEffect(() => {
    const formulari = ocult.current?.form;
    if (!formulari) return;

    const llegeix = () => {
      const camp = formulari.elements.namedItem("mode");
      if (camp instanceof HTMLSelectElement) setMode(camp.value || "tots");
    };
    llegeix();
    formulari.addEventListener("change", llegeix);
    return () => formulari.removeEventListener("change", llegeix);
  }, []);

  // Es deixa respirar mig segon: així no es pregunta a cada tecla.
  useEffect(() => {
    if (criteris.length === 0) {
      setProva(null);
      return;
    }

    const temporitzador = setTimeout(async () => {
      setProvant(true);
      try {
        const resposta = await fetch("/api/crm/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, criteris }),
        });
        setProva(resposta.ok ? ((await resposta.json()) as Prova) : null);
      } catch {
        setProva(null);
      } finally {
        setProvant(false);
      }
    }, 500);

    return () => clearTimeout(temporitzador);
  }, [json, mode, criteris]);

  return (
    <div className="space-y-2.5">
      <input ref={ocult} type="hidden" name={nom} value={json} />

      <EditorCriteris
        criteris={criteris}
        alCanviar={setCriteris}
        opcionsRelacio={opcionsRelacio}
        buit="Encara no hi ha cap criteri. Un segment sense criteris no agrupa cap client."
        peu={
          provant ? (
            <p className="text-[12.5px] text-muted" role="status">
              Provant…
            </p>
          ) : null
        }
      />

      {/* Qui ha quedat seleccionat. Es desplega perquè la llista pot ser llarga
          i, mentre es munta el filtre, el que es mira primer és el recompte. */}
      {criteris.length > 0 && prova ? (
        <details className="group rounded-lg border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[12.5px] text-muted transition hover:text-ink">
            <span className="text-[10px] leading-none transition-transform group-open:rotate-90">▶</span>
            <span>
              <span className="font-medium text-ink">
                {prova.total} {prova.total === 1 ? "client" : "clients"}
              </span>{" "}
              de {prova.deQuants} hi encaixen
            </span>
          </summary>

          <div className="border-t border-line px-3 py-2.5">
            {prova.comptes.length === 0 ? (
              <p className="text-[12.5px] text-muted">
                Cap client compleix aquests criteris. Afluixa alguna condició.
              </p>
            ) : (
              <>
                <ul className="flex flex-wrap gap-1.5">
                  {prova.comptes.map((compte) => (
                    <li key={compte.id}>
                      {/* La fitxa s'obre a sobre: el segment a mig fer es queda al darrere tal com és. */}
                      <Link
                        href={rutaDelClient(compte.id)}
                        scroll={false}
                        className="inline-flex rounded-md bg-parchment px-2 py-1 text-[12.5px] text-ink-soft transition hover:bg-parchment/60"
                      >
                        {compte.nom}
                      </Link>
                    </li>
                  ))}
                </ul>
                {prova.total > prova.comptes.length ? (
                  <p className="mt-2 text-[12px] text-muted">
                    Se n&apos;ensenyen {prova.comptes.length} de {prova.total}.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}
