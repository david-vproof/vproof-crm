"use client";

import { useActionState } from "react";

import { sincronitzaAra, type EstatConfiguracio } from "./actions";

/** El botó de sincronitzar ara amb l'ERP, amb el resultat a sota. */
export function BotoSincronitza({ enCurs }: { enCurs: boolean }) {
  const [estat, accio, pendent] = useActionState<EstatConfiguracio, FormData>(sincronitzaAra, {});
  return (
    <form action={accio} className="space-y-2">
      <button type="submit" disabled={pendent} className="btn-compacte">
        {pendent ? "Sincronitzant… (pot trigar uns minuts)" : enCurs ? "N'hi ha una en marxa: espera-la" : "Sincronitza ara"}
      </button>
      {estat.missatge ? (
        <p className={`text-[13px] ${estat.to === "ok" ? "text-emerald-700" : "text-marca-fosc"}`}>{estat.missatge}</p>
      ) : null}
    </form>
  );
}
