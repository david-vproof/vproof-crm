"use client";

import { useActionState } from "react";

import { desaConnexio, type EstatConfiguracio } from "./actions";

type Inicials = {
  url: string;
  host: string;
  clau: string;
  teSecret: boolean;
  llistaPreus: string;
  minuts: number;
  deLEntorn: { url: boolean; host: boolean; clau: boolean; secret: boolean };
};

/** La connexió amb l'ERP. Només l'administrador la pot canviar; el secret no es torna a ensenyar mai. */
export function FormulariConnexioErp({ inicials, potEditar }: { inicials: Inicials; potEditar: boolean }) {
  const [estat, accio, pendent] = useActionState<EstatConfiguracio, FormData>(desaConnexio, {});
  const nota = (deLEntorn: boolean) => (deLEntorn ? <span className="text-[12px] text-muted"> · ve de l&apos;entorn del servei</span> : null);

  return (
    <form action={accio} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-[13px] font-medium text-ink">Adreça de l&apos;ERP{nota(inicials.deLEntorn.url)}</span>
          <input name="url" type="url" defaultValue={inicials.url} disabled={!potEditar} placeholder="http://34.175.54.50" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink">Site de Frappe{nota(inicials.deLEntorn.host)}</span>
          <input name="host" defaultValue={inicials.host} disabled={!potEditar} placeholder="Només si l'adreça no és el nom del site" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink">Llista de preus de venda</span>
          <input name="llista_preus" defaultValue={inicials.llistaPreus} disabled={!potEditar} placeholder="Standard Selling" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink">Clau d&apos;API (API Key){nota(inicials.deLEntorn.clau)}</span>
          <input name="clau" defaultValue={inicials.clau} disabled={!potEditar} autoComplete="off" spellCheck={false} className="field font-mono" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink">Secret d&apos;API (API Secret){nota(inicials.deLEntorn.secret)}</span>
          <input
            name="secret"
            type="password"
            disabled={!potEditar}
            autoComplete="new-password"
            placeholder={inicials.teSecret ? "Desat · deixa-ho buit per no canviar-lo" : "Encara no n'hi ha"}
            className="field font-mono"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink">Cada quants minuts se sincronitza</span>
          <input name="minuts" type="number" min={0} max={1440} defaultValue={inicials.minuts} disabled={!potEditar} className="field" />
          <span className="block text-[12px] text-muted">0 atura la sincronització automàtica; a mà es pot fer igualment.</span>
        </label>
      </div>
      {potEditar ? (
        <div className="space-y-2">
          <button type="submit" disabled={pendent} className="btn-compacte">
            {pendent ? "Desant i provant…" : "Desa i prova la connexió"}
          </button>
          {estat.missatge ? (
            <p className={`text-[13px] ${estat.to === "ok" ? "text-emerald-700" : "text-marca-fosc"}`}>{estat.missatge}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[13px] text-muted">Només un administrador pot canviar la connexió.</p>
      )}
    </form>
  );
}
