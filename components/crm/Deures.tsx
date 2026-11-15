"use client";

import { useActionState, useState, useTransition } from "react";

import {
  apuntaToDoAccio,
  marcaDeureAccio,
  reobreActivitatAccio,
  tancaActivitatAccio,
  type EstatTancament,
  type EstatToDo,
} from "@/app/(portal)/crm/accions";
import { EntradaAtributs } from "@/components/crm/Atributs";
import { TO_RESULTAT } from "@/components/crm/EstatActivitat";
import type { Atribut } from "@/domini/atributs";
import { MAXIM_DEURES, MAXIM_TEXT, type Deure } from "@/domini/crm-deures";
import { RESULTATS_TANCAMENT } from "@/domini/crm-fitxes";

/**
 * Els ToDos d'un tancament, escrits com a etiquetes.
 *
 * S'escriuen d'un en un i amb la tecla de retorn: en sortir d'una visita se'n
 * recorden tres o quatre de cop, i una llista d'etiquetes s'omple molt més de
 * pressa que quatre caselles. El valor de debò viatja en un camp ocult amb
 * JSON, com fan la matriu d'horaris i el constructor de criteris.
 */
function EntradaDeures({ deures, canvia }: { deures: string[]; canvia: (nous: string[]) => void }) {
  const [text, setText] = useState("");
  const ple = deures.length >= MAXIM_DEURES;

  function afegeix() {
    const net = text.trim().replace(/\s+/g, " ").slice(0, MAXIM_TEXT);
    if (!net || ple) return;
    // Repetir el mateix deure és una relliscada, no dues feines.
    if (deures.some((previ) => previ.toLowerCase() === net.toLowerCase())) {
      setText("");
      return;
    }
    canvia([...deures, net]);
    setText("");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="deures" value={JSON.stringify(deures)} />

      {deures.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {deures.map((deure, i) => (
            <li
              key={`${deure}-${i}`}
              className="flex max-w-full items-start gap-1.5 rounded-lg bg-parchment px-2 py-1 text-[13px] text-ink-soft"
            >
              <span className="min-w-0 break-words">{deure}</span>
              <button
                type="button"
                aria-label={`Treu «${deure}»`}
                onClick={() => canvia(deures.filter((_, j) => j !== i))}
                className="mt-px shrink-0 leading-none text-muted transition hover:text-marca"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <input
          type="text"
          value={text}
          maxLength={MAXIM_TEXT}
          disabled={ple}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Retorn afegeix; dins d'un formulari, si no, l'enviaria.
            if (e.key === "Enter") {
              e.preventDefault();
              afegeix();
            }
            // Esborrar amb la caixa buida es menja l'últim: és el gest de sempre.
            if (e.key === "Backspace" && !text && deures.length > 0) {
              canvia(deures.slice(0, -1));
            }
          }}
          placeholder={ple ? `Ja n'hi ha ${MAXIM_DEURES}` : "Escriu un To-Do…"}
          className="field-compacte min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={afegeix}
          disabled={ple || !text.trim()}
          className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px] transition hover:border-ink disabled:opacity-40"
        >
          Afegeix
        </button>
      </div>
    </div>
  );
}

/** Un deure amb la seva casella. Es marca de seguida i s'espera després. */
function FilaDeure({ deure, nomesLectura = false }: { deure: Deure; nomesLectura?: boolean }) {
  const [fet, setFet] = useState(deure.fet);
  const [error, setError] = useState("");
  const [enviant, comenca] = useTransition();

  function commuta() {
    const nou = !fet;
    setFet(nou);
    setError("");
    comenca(async () => {
      const resposta = await marcaDeureAccio(deure.id, nou);
      // Si no ha colat, la casella torna on era: val més això que fer creure
      // que s'ha desat una cosa que no hi és.
      if (resposta.error) {
        setFet(!nou);
        setError(resposta.error);
      }
    });
  }

  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <input
        type="checkbox"
        checked={fet}
        disabled={enviant || nomesLectura}
        onChange={commuta}
        aria-label={deure.text}
        className="mt-0.5 size-4 shrink-0 accent-marca"
      />
      <span className="min-w-0 flex-1">
        <span className={`block break-words text-[13.5px] leading-snug ${fet ? "text-muted line-through" : "text-ink"}`}>
          {deure.text}
        </span>
        <span className="mt-0.5 block break-words text-[11.5px] text-muted">
          {deure.origen}
          {deure.venciment ? ` · venç ${deure.venciment.slice(8)}/${deure.venciment.slice(5, 7)}` : ""}
        </span>
        {error ? <span className="mt-0.5 block text-[11.5px] text-marca">{error}</span> : null}
      </span>
    </li>
  );
}

function Llista({
  titol,
  deures,
  buit,
  nomesLectura = false,
}: {
  titol: string;
  deures: Deure[];
  buit?: string;
  nomesLectura?: boolean;
}) {
  const pendents = deures.filter((deure) => !deure.fet).length;

  if (deures.length === 0) {
    return buit ? (
      <section className="rounded-xl border border-line bg-white p-3.5">
        <h3 className="text-[12px] font-medium text-muted">{titol}</h3>
        <p className="mt-2 text-[13px] text-muted/70">{buit}</p>
      </section>
    ) : null;
  }

  return (
    <section className="rounded-xl border border-line bg-white p-3.5">
      {/* Sense majúscules: «To-Do» s'ha de llegir tal qual, no «TO-DO». */}
      <h3 className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted">
        {titol}
        {pendents > 0 ? (
          <span className="rounded bg-marca-clar px-1.5 py-px text-[11px] tabular-nums text-marca-fosc">
            {pendents}
          </span>
        ) : null}
      </h3>
      <ul className="mt-1.5 divide-y divide-line/50">
        {deures.map((deure) => (
          <FilaDeure key={deure.id} deure={deure} nomesLectura={nomesLectura} />
        ))}
      </ul>
    </section>
  );
}

/**
 * El pas de tancar: com ha anat, què queda per fer i, si l'activitat és d'un
 * client, què se n'ha après (els seus atributs).
 */
function Tancament({ id, atributs }: { id: string; atributs: Atribut[] | null }) {
  const [obert, setObert] = useState(false);
  const [resultat, setResultat] = useState("");
  const [deures, setDeures] = useState<string[]>([]);
  const [atributsNous, setAtributsNous] = useState<string[]>([]);
  const [estat, accio, enviant] = useActionState<EstatTancament, FormData>(tancaActivitatAccio, {});

  if (estat.fet) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
        {estat.fet}
      </p>
    );
  }

  if (!obert) {
    return (
      <button type="button" onClick={() => setObert(true)} className="btn-compacte w-full justify-center py-2">
        Tanca l&apos;activitat
      </button>
    );
  }

  return (
    <form action={accio} className="space-y-3 rounded-xl border border-line bg-white p-3.5">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="resultat" value={resultat} />

      {estat.error ? (
        <p role="alert" className="rounded-lg bg-marca-clar px-3 py-2 text-[13px] text-marca-fosc">
          {estat.error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        {/* Com els altres títols del tancament, sense majúscules: hi ha «To-Do» al costat. */}
        <p className="text-[12px] font-medium text-muted">
          Com ha anat<span className="text-marca"> *</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RESULTATS_TANCAMENT.map((valor) => (
            <button
              key={valor}
              type="button"
              aria-pressed={resultat === valor}
              onClick={() => setResultat(valor)}
              className={`rounded-lg border px-2.5 py-1.5 text-[13px] transition ${
                resultat === valor
                  ? TO_RESULTAT[valor]
                  : "border-line bg-white text-ink-soft hover:border-ink"
              }`}
            >
              {valor}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[12px] font-medium text-muted">To-Do per a la propera visita</p>
        <EntradaDeures deures={deures} canvia={setDeures} />
        <p className="text-[12px] text-muted">
          Amb la tecla de retorn se n&apos;afegeix un altre. Sortiran a la propera activitat
          d&apos;aquest client fins que es marquin.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-[12px] font-medium text-muted">Venciment dels To-Do</span>
        <input type="date" name="venciment" className="field-compacte" />
      </label>

      {atributs ? (
        <div className="space-y-1.5">
          <p className="text-[12px] font-medium text-muted">Atributs del client</p>
          <EntradaAtributs existents={atributs} nous={atributsNous} canvia={setAtributsNous} />
          <p className="text-[12px] text-muted">
            {atributs.length > 0 ? "Els grisos ja els té. " : ""}
            Els nous es desen al client en tancar l&apos;activitat.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setObert(false)}
          className="text-[13px] text-muted transition hover:text-ink"
        >
          Cancel·la
        </button>
        <button type="submit" disabled={enviant || !resultat} className="btn-compacte disabled:opacity-50">
          {enviant ? "Tancant…" : "Tanca l'activitat"}
        </button>
      </div>
    </form>
  );
}

function Reobre({ id, resultat }: { id: string; resultat: string }) {
  const [estat, accio, enviant] = useActionState<EstatTancament, FormData>(reobreActivitatAccio, {});

  return (
    <form action={accio} className="flex flex-wrap items-center justify-between gap-2">
      <input type="hidden" name="id" value={id} />
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium ${
          TO_RESULTAT[resultat] ?? "border-line bg-parchment text-muted"
        }`}
      >
        Tancada · {resultat}
      </span>
      <button type="submit" disabled={enviant} className="text-[13px] text-muted transition hover:text-ink">
        {enviant ? "Obrint…" : "Torna a obrir"}
      </button>
      {estat.error ? (
        <p role="alert" className="w-full text-[12.5px] text-marca">
          {estat.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * El bloc de deures d'una activitat: què arrossega el compte i, segons si
 * l'activitat és oberta o tancada, el pas de tancar-la o el que va deixar.
 */
export function SeccioDeures({
  id,
  tancada,
  resultat,
  compte,
  arrossegats,
  propis,
  atributs = null,
  nomesLectura = false,
}: {
  id: string;
  tancada: boolean;
  resultat: string;
  /** Els atributs del client, per veure'ls i afegir-ne en tancar. Null si l'activitat és d'un lead. */
  atributs?: Atribut[] | null;
  /** Nom del compte o lead, per dir de qui són els deures. */
  compte: string;
  /**
   * Deures pendents que vénen d'altres activitats del mateix compte. Sense
   * llista no en surt cap: a la fitxa del client ja són a la columna del costat.
   */
  arrossegats?: Deure[];
  /** Deures que ha deixat aquesta activitat en tancar-se. */
  propis: Deure[];
  /**
   * L'activitat encara no existeix: s'ensenya què arrossega el compte, però no
   * s'hi pot tancar res ni marcar cap deure fins que estigui desada.
   */
  nomesLectura?: boolean;
}) {
  if (nomesLectura) {
    return (
      <div className="space-y-3 border-t border-line pt-4">
        <Llista titol={compte ? `To-Do pendents de ${compte}` : "To-Do pendents"} deures={arrossegats ?? []} nomesLectura />
        <p className="text-[12px] text-muted">
          Desa l&apos;activitat per poder-los marcar i per tancar-la amb To-Do nous.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-line pt-4">
      {arrossegats ? (
        <Llista
          titol={compte ? `To-Do pendents de ${compte}` : "To-Do pendents"}
          deures={arrossegats}
          buit={tancada ? undefined : "Aquest client no té cap To-Do pendent."}
        />
      ) : null}

      {tancada ? (
        <>
          <Reobre id={id} resultat={resultat} />
          <Llista titol="To-Do que ha deixat" deures={propis} />
        </>
      ) : (
        <Tancament id={id} atributs={atributs} />
      )}
    </div>
  );
}

/**
 * Apunta un To-Do al client, sense haver de passar per cap activitat: el que
 * surt d'una trucada o d'un correu també queda per fer.
 *
 * Els camps els porta l'estat, i no el formulari: així, si no s'ha pogut desar,
 * el que s'ha escrit es queda a la caixa.
 */
function NouToDo({ client }: { client: string }) {
  const [text, setText] = useState("");
  const [venciment, setVenciment] = useState("");
  const [estat, accio, enviant] = useActionState<EstatToDo, FormData>(async (previ, dades) => {
    const resposta = await apuntaToDoAccio(previ, dades);
    if (resposta.fet) {
      setText("");
      setVenciment("");
    }
    return resposta;
  }, {});

  return (
    <form action={accio} className="space-y-1.5">
      <input type="hidden" name="client" value={client} />
      <input
        type="text"
        name="text"
        required
        value={text}
        maxLength={MAXIM_TEXT}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escriu un To-Do…"
        aria-label="To-Do nou"
        className="field-compacte w-full"
      />
      <div className="flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-muted">
          Venç
          <input
            type="date"
            name="venciment"
            value={venciment}
            onChange={(e) => setVenciment(e.target.value)}
            className="field-compacte min-w-0 flex-1"
          />
        </label>
        <button type="submit" disabled={enviant || !text.trim()} className="btn-compacte shrink-0 disabled:opacity-50">
          {enviant ? "Afegint…" : "Afegeix"}
        </button>
      </div>
      {estat.error ? (
        <p role="alert" className="text-[12.5px] text-marca">
          {estat.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Els deures d'un client, a la columna del costat de la seva fitxa.
 *
 * És el repàs de què li deu la casa a aquest compte, amb tot el que arrossega
 * junt i vingui d'on vingui, i on se n'hi apunten de nous. Les fetes es
 * pleguen: es consulten de tant en tant i, obertes, taparien el que de debò
 * queda per fer.
 */
export function PanellDeures({ client, deures, compte }: { client: string; deures: Deure[]; compte: string }) {
  const pendents = deures.filter((deure) => !deure.fet);
  const fets = deures.filter((deure) => deure.fet);

  return (
    <div className="space-y-3">
      <NouToDo client={client} />

      {/* Va a la columna del costat de la fitxa: sense res, una línia, que no ocupi el lloc del que sí que hi és. */}
      {deures.length === 0 ? (
        <p className="text-[12.5px] text-muted">
          Encara no en té cap. També se n&apos;hi apunten en tancar una activitat{compte ? ` de ${compte}` : ""}.
        </p>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            {pendents.length} {pendents.length === 1 ? "pendent" : "pendents"}
            {fets.length > 0 ? ` · ${fets.length} ${fets.length === 1 ? "fet" : "fets"}` : ""}
          </p>

          {pendents.length === 0 ? (
            <p className="rounded-xl border border-line bg-white px-3.5 py-3 text-[13px] text-muted">
              Tot al dia: no queda cap To-Do per fer.
            </p>
          ) : (
            <ul className="divide-y divide-line/50 rounded-xl border border-line bg-white px-3.5">
              {pendents.map((deure) => (
                <FilaDeure key={deure.id} deure={deure} />
              ))}
            </ul>
          )}

          {fets.length > 0 ? (
            <details className="group rounded-xl border border-line bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] text-muted transition hover:text-ink">
                <span className="text-[10px] leading-none transition-transform group-open:rotate-90">▶</span>
                {fets.length} To-Do ja {fets.length === 1 ? "fet" : "fets"}
              </summary>
              <ul className="divide-y divide-line/50 border-t border-line px-3.5">
                {fets.map((deure) => (
                  <FilaDeure key={deure.id} deure={deure} />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
