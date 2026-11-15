"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import { afegeixAtributAccio, esborraAtributAccio, type EstatAtribut } from "@/app/(portal)/crm/accions-atributs";
import { BotoModal, useDemanda } from "@/components/crm/BotoModal";
import { type Atribut, MAXIM_ATRIBUTS_DE_COP, MAXIM_TEXT_ATRIBUT, mateixAtribut, netejaAtribut } from "@/domini/atributs";
import { rutaDelClient } from "@/lib/navegacio";

/** «12/10/2026», per dir quan es va posar un atribut. */
function dia(iso: string | null) {
  const trossos = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return trossos ? `${Number(trossos[3])}/${Number(trossos[2])}/${trossos[1]}` : null;
}

/** D'on ve un atribut: quan, qui i, si va ser en tancar una activitat, quina. */
function origenDe(atribut: Atribut) {
  return [dia(atribut.creat), atribut.qui, atribut.activitat ? `en tancar «${atribut.activitat}»` : null].filter(Boolean).join(" · ");
}

/** Un atribut en pastilla, com les etiquetes dels To-Do. */
function Pastilla({ text, apagada = false, children }: { text: string; apagada?: boolean; children?: React.ReactNode }) {
  return (
    <li
      className={`flex max-w-full items-start gap-1.5 rounded-lg px-2 py-1 text-[13px] ${
        apagada ? "bg-parchment/70 text-muted" : "bg-marca-clar text-marca-fosc"
      }`}
    >
      <span className="min-w-0 break-words">{text}</span>
      {children}
    </li>
  );
}

/**
 * Els atributs al tancament d'una activitat: els que el client ja té, per
 * tenir-los presents, i els nous, que s'escriuen d'un en un amb la tecla de
 * retorn com els To-Do i es desen en tancar. Viatgen en un camp ocult amb JSON.
 */
export function EntradaAtributs({ existents, nous, canvia }: { existents: Atribut[]; nous: string[]; canvia: (nous: string[]) => void }) {
  const [text, setText] = useState("");
  const ple = nous.length >= MAXIM_ATRIBUTS_DE_COP;

  function afegeix() {
    const net = netejaAtribut(text);
    if (!net || ple) return;
    // Un que ja té, o que ja s'ha escrit, no es repeteix.
    if ([...existents.map((a) => a.text), ...nous].some((previ) => mateixAtribut(previ, net))) {
      setText("");
      return;
    }
    canvia([...nous, net]);
    setText("");
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="atributs" value={JSON.stringify(nous)} />

      {existents.length > 0 || nous.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {existents.map((atribut) => (
            <Pastilla key={atribut.id} text={atribut.text} apagada />
          ))}
          {nous.map((nou, i) => (
            <Pastilla key={`${nou}-${i}`} text={nou}>
              <button
                type="button"
                aria-label={`Treu «${nou}»`}
                onClick={() => canvia(nous.filter((_, j) => j !== i))}
                className="mt-px shrink-0 leading-none text-marca-fosc/60 transition hover:text-marca"
              >
                ×
              </button>
            </Pastilla>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <input
          type="text"
          value={text}
          maxLength={MAXIM_TEXT_ATRIBUT}
          disabled={ple}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Retorn afegeix; dins d'un formulari, si no, l'enviaria.
            if (e.key === "Enter") {
              e.preventDefault();
              afegeix();
            }
            if (e.key === "Backspace" && !text && nous.length > 0) canvia(nous.slice(0, -1));
          }}
          placeholder={ple ? `Ja n'hi ha ${MAXIM_ATRIBUTS_DE_COP}` : "Escriu un atribut…"}
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

/** Una fila de la pestanya: l'atribut, d'on ve i el botó de treure'l, que demana confirmació al mateix lloc. */
function FilaAtribut({ atribut }: { atribut: Atribut }) {
  const [confirmant, setConfirmant] = useState(false);
  const [error, setError] = useState("");
  const [treient, comenca] = useTransition();
  const origen = origenDe(atribut);

  return (
    <li className={`flex items-start gap-3 px-3.5 py-2.5 ${treient ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[13.5px] text-ink">{atribut.text}</p>
        {origen ? <p className="mt-0.5 break-words text-[11.5px] text-muted">{origen}</p> : null}
        {error ? <p className="mt-0.5 text-[11.5px] text-marca">{error}</p> : null}
      </div>
      {confirmant ? (
        <span className="flex shrink-0 items-center gap-2 text-[12.5px]">
          <button type="button" onClick={() => setConfirmant(false)} className="text-muted transition hover:text-ink">
            No
          </button>
          <button
            type="button"
            disabled={treient}
            onClick={() =>
              comenca(async () => {
                const resposta = await esborraAtributAccio(atribut.id);
                if (resposta.error) {
                  setError(resposta.error);
                  setConfirmant(false);
                }
              })
            }
            className="rounded-md bg-marca px-2 py-0.5 font-medium text-cream transition hover:bg-marca-fosc"
          >
            Treu-lo
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Treu «${atribut.text}»`}
          onClick={() => setConfirmant(true)}
          className="shrink-0 rounded px-2 py-0.5 text-[15px] leading-none text-muted transition hover:bg-parchment hover:text-marca"
        >
          ×
        </button>
      )}
    </li>
  );
}

/**
 * Els atributs a la fitxa d'un client: el que el caracteritza. Se
 * n'hi afegeixen d'un en un i es treuen amb confirmació; també arriben dels
 * tancaments de les seves activitats.
 */
export function PanellAtributs({ client, atributs }: { client: string; atributs: Atribut[] }) {
  const [estat, accio, enviant] = useActionState<EstatAtribut, FormData>(afegeixAtributAccio, {});
  const formulari = useRef<HTMLFormElement>(null);

  // Afegit: la caixa es buida per escriure'n un altre.
  useEffect(() => {
    if (estat.fet) formulari.current?.reset();
  }, [estat]);

  return (
    <div className="space-y-3">
      <form ref={formulari} action={accio} className="space-y-1.5">
        <input type="hidden" name="client" value={client} />
        <div className="flex flex-wrap gap-1.5">
          <input
            type="text"
            name="text"
            required
            maxLength={MAXIM_TEXT_ATRIBUT}
            placeholder="Escriu un atribut del client…"
            aria-label="Atribut nou"
            className="field-compacte min-w-0 flex-1"
          />
          <button type="submit" disabled={enviant} className="btn-compacte shrink-0 disabled:opacity-50">
            {enviant ? "Afegint…" : "Afegeix"}
          </button>
        </div>
        {estat.error ? (
          <p role="alert" className="text-[12.5px] text-marca">
            {estat.error}
          </p>
        ) : null}
      </form>

      {/* Va a la columna del costat de la fitxa: sense res, una línia, que no ocupi el lloc del que sí que hi és. */}
      {atributs.length === 0 ? (
        <p className="text-[12.5px] text-muted">Encara no en té cap. També se n&apos;hi posen en tancar una activitat seva.</p>
      ) : (
        <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white">
          {atributs.map((atribut) => (
            <FilaAtribut key={atribut.id} atribut={atribut} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Els atributs d'un client, demanats en obrir el modal. En llista, com els To-Do del modal del costat. */
function AtributsDelModal({ client }: { client: string }) {
  const dades = useDemanda<{ atributs: Atribut[] }>(`/api/crm/atributs?${new URLSearchParams({ client })}`);
  if (!dades) return <p className="text-[13px] text-muted">Un moment…</p>;
  if (dades.error) return <p className="text-[13px] text-marca">{dades.error}</p>;
  const atributs = dades.valor?.atributs ?? [];
  if (atributs.length === 0) return <p className="text-[13px] text-muted">Aquest client ja no té cap atribut.</p>;
  return (
    <ul className="divide-y divide-line/60">
      {atributs.map((atribut) => {
        const origen = origenDe(atribut);
        return (
          <li key={atribut.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-marca" />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-[13.5px] leading-snug text-ink">{atribut.text}</span>
              {origen ? <span className="mt-0.5 block break-words text-[11.5px] text-muted">{origen}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** La «A» del costat del nom d'un client que té atributs, a les llistes. */
export function BotoAtributs({ client, nom, mida = "petita" }: { client: string; nom: string; mida?: "petita" | "gran" }) {
  return (
    <BotoModal
      marca="A"
      etiqueta={`Atributs de ${nom}`}
      apartat="Atributs"
      nom={nom}
      to="bg-marca-clar text-marca-fosc hover:bg-marca hover:text-cream"
      mida={mida}
      enllac={{ href: rutaDelClient(client), text: "Obre la fitxa del client" }}
    >
      <AtributsDelModal client={client} />
    </BotoModal>
  );
}
