"use client";

import { useActionState } from "react";

import { provaConnexio, type EstatConfiguracio } from "./actions";

export function BotoProva() {
  const [estat, accio, provant] = useActionState<EstatConfiguracio, FormData>(
    async () => provaConnexio(),
    {},
  );

  return (
    <form action={accio} className="space-y-3">
      <button type="submit" disabled={provant} className="btn-compacte">
        {provant ? "Provant…" : "Prova la connexió"}
      </button>

      {estat.missatge ? (
        <p
          role="status"
          className={`rounded-lg px-3.5 py-2.5 text-[13px] ${
            estat.to === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-wine-tint text-wine-deep"
          }`}
        >
          {estat.missatge}
        </p>
      ) : null}
    </form>
  );
}
