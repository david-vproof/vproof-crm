"use client";

import { useActionState, useRef, useState } from "react";

import { LLARGADA_MAXIMA_NOM, esTipusBase, type DefinicioTipus } from "@/domini/crm-tipus-activitat";

import { desaTipus, type EstatConfiguracio } from "./actions";

/**
 * Les columnes de la taula. Al telèfon no hi caben: cada tipus fa dues línies,
 * el nom a dalt i les caselles a sota, amb el seu text.
 */
const COLUMNES =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_76px_56px_56px_52px_72px_24px]";

type Fila = Omit<DefinicioTipus, "valor"> & {
  /** Per a React: l'id, o un de provisional mentre és nova. */
  clau: string;
  usos: number;
  esborrable: boolean;
  perEsborrar: boolean;
};

type Marca = "visita" | "ambProductes" | "ambLaboratori" | "actiu";

const CASELLES: { marca: Marca; etiqueta: string }[] = [
  { marca: "visita", etiqueta: "Compta com a visita" },
  { marca: "ambProductes", etiqueta: "Demana productes" },
  { marca: "ambLaboratori", etiqueta: "Demana laboratori" },
  { marca: "actiu", etiqueta: "Es pot triar" },
];

function filesDe(tipus: DefinicioTipus[], usos: Record<string, number>): Fila[] {
  return tipus.map((definicio) => ({
    ...definicio,
    clau: definicio.id ?? definicio.valor,
    usos: usos[definicio.valor] ?? 0,
    esborrable: !esTipusBase(definicio.valor) && !usos[definicio.valor],
    perEsborrar: false,
  }));
}

/** Les files, amb el seu estat: es tornen a muntar quan el servidor porta una llista diferent. */
function FilesTipus({ tipus, usos }: { tipus: DefinicioTipus[]; usos: Record<string, number> }) {
  const [files, setFiles] = useState<Fila[]>(() => filesDe(tipus, usos));
  const comptador = useRef(0);

  const canvia = (clau: string, canvis: Partial<Fila>) =>
    setFiles((previes) => previes.map((fila) => (fila.clau === clau ? { ...fila, ...canvis } : fila)));

  const afegeix = () => {
    comptador.current += 1;
    setFiles((previes) => [
      ...previes,
      {
        id: null,
        clau: `nou-${comptador.current}`,
        nom: "",
        visita: false,
        ambProductes: false,
        ambLaboratori: false,
        actiu: true,
        usos: 0,
        esborrable: true,
        perEsborrar: false,
      },
    ]);
  };

  // Un de nou que encara no s'ha desat, simplement es treu; un de desat queda
  // ratllat fins a desar, i es pot desfer.
  const treu = (fila: Fila) =>
    fila.id ? canvia(fila.clau, { perEsborrar: !fila.perEsborrar }) : setFiles((previes) => previes.filter((f) => f.clau !== fila.clau));

  const enviats = files
    .filter((fila) => !fila.perEsborrar)
    .map(({ id, nom, visita, ambProductes, ambLaboratori, actiu }) => ({ id, nom, visita, ambProductes, ambLaboratori, actiu }));
  const esborrats = files.filter((fila) => fila.perEsborrar && fila.id).map((fila) => fila.id);

  return (
    <>
      <input type="hidden" name="tipus" value={JSON.stringify(enviats)} />
      <input type="hidden" name="esborrats" value={JSON.stringify(esborrats)} />

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className={`${COLUMNES} hidden items-end border-b border-line bg-cream/70 px-3 py-2 text-[11px] font-medium uppercase leading-tight tracking-[0.06em] text-muted sm:grid`}>
          <span>Nom del tipus</span>
          {CASELLES.map(({ marca, etiqueta }) => (
            <span key={marca} className="text-center">
              {etiqueta}
            </span>
          ))}
          <span className="text-right">Núm. d&apos;activitats</span>
          <span />
        </div>

        <ul className="divide-y divide-line/70">
          {files.map((fila) => (
            <li key={fila.clau} className={`${COLUMNES} items-center px-3 py-2 ${fila.perEsborrar ? "bg-parchment/50" : ""}`}>
              <label className="order-1 min-w-0 sm:order-none">
                <span className="sr-only">Nom del tipus</span>
                <input
                  type="text"
                  value={fila.nom}
                  maxLength={LLARGADA_MAXIMA_NOM}
                  disabled={fila.perEsborrar}
                  autoFocus={!fila.id}
                  placeholder="Nom del tipus"
                  onChange={(e) => canvia(fila.clau, { nom: e.target.value })}
                  className={`field-compacte ${fila.perEsborrar ? "text-muted line-through" : ""}`}
                />
              </label>

              <div className="order-3 col-span-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 sm:order-none sm:col-span-1 sm:contents">
                {CASELLES.map(({ marca, etiqueta }) => (
                  <label key={marca} className="flex items-center gap-1.5 text-[12.5px] text-muted sm:justify-center">
                    <input
                      type="checkbox"
                      checked={fila[marca]}
                      disabled={fila.perEsborrar}
                      onChange={(e) => canvia(fila.clau, { [marca]: e.target.checked })}
                      className="size-4 accent-marca"
                    />
                    <span className="sm:sr-only">{etiqueta}</span>
                  </label>
                ))}
              </div>

              {/* Al telèfon va a sota i amb el seu text: no hi ha capçalera que digui què és aquest número. */}
              <span
                className="order-4 col-span-2 text-[12.5px] tabular-nums text-muted sm:order-none sm:col-span-1 sm:text-right sm:text-[13px] sm:text-ink-soft"
                title="Núm. d'activitats d'aquest tipus"
              >
                {fila.id ? fila.usos : "nou"}
                {fila.id ? <span className="sm:hidden">{fila.usos === 1 ? " activitat" : " activitats"}</span> : null}
              </span>
              {fila.esborrable ? (
                <button
                  type="button"
                  onClick={() => treu(fila)}
                  aria-label={`${fila.perEsborrar ? "No esborris" : "Esborra"} ${fila.nom || "aquest tipus"}`}
                  title={fila.perEsborrar ? "No l'esborris" : "Esborra'l"}
                  className="order-2 flex size-6 items-center justify-center rounded text-[14px] text-muted transition hover:bg-parchment hover:text-marca-fosc sm:order-none"
                >
                  {fila.perEsborrar ? "↺" : "✕"}
                </button>
              ) : (
                <span aria-hidden className="hidden size-6 sm:block" />
              )}
            </li>
          ))}
        </ul>
      </div>

      <button type="button" onClick={afegeix} className="text-[13px] font-medium text-marca underline-offset-2 hover:underline">
        + Afegeix un tipus
      </button>
    </>
  );
}

/**
 * La taula dels tipus d'activitat: es poden afegir, canviar de nom, dir què
 * porta cadascun i desactivar. No es desa res fins que no es prem «Desa».
 */
export function FormulariTipusActivitat({ tipus, usos }: { tipus: DefinicioTipus[]; usos: Record<string, number> }) {
  const [estat, accio, desant] = useActionState<EstatConfiguracio, FormData>(desaTipus, {});

  return (
    <form action={accio} className="space-y-3">
      {/* Quan el servidor torna una llista diferent, les files es refan: les noves ja tenen id. */}
      <FilesTipus key={JSON.stringify([tipus, usos])} tipus={tipus} usos={usos} />

      <div>
        <button type="submit" disabled={desant} className="btn-compacte">
          {desant ? "Desant…" : "Desa els tipus"}
        </button>
      </div>

      {estat.missatge ? (
        <p
          role="status"
          className={`rounded-lg px-3.5 py-2.5 text-[13px] ${estat.to === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-marca-clar text-marca-fosc"}`}
        >
          {estat.missatge}
        </p>
      ) : null}
    </form>
  );
}
