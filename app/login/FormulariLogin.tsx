"use client";

import { useActionState, useEffect, useState } from "react";

import { oblidaVistes } from "@/lib/vistes-recordades";

import { iniciaSessio, type EstatLogin } from "./actions";

export function FormulariLogin({ des, ambCorreu }: { des: string; ambCorreu: boolean }) {
  const [estat, accio, enviant] = useActionState<EstatLogin, FormData>(iniciaSessio, {});
  // React 19 buida el formulari en acabar l'acció. Mantenint l'usuari en estat,
  // després d'un intent fallit només cal reescriure la contrasenya.
  const [usuari, setUsuari] = useState("");
  // Qui arriba aquí comença de nou: els filtres que el menú recordava de la sessió anterior s'obliden.
  useEffect(oblidaVistes, []);

  return (
    <form action={accio} className="mt-8 space-y-4">
      <input type="hidden" name="des" value={des} />

      <div className="space-y-1.5">
        <label htmlFor="usuari" className="block text-[13px] font-medium text-ink">
          {ambCorreu ? "Correu electrònic" : "Usuari"}
        </label>
        <input
          id="usuari"
          name="usuari"
          type={ambCorreu ? "email" : "text"}
          autoComplete="username"
          autoFocus
          value={usuari}
          onChange={(esdeveniment) => setUsuari(esdeveniment.target.value)}
          placeholder={ambCorreu ? "nom@exemple.com" : "admin"}
          className="field"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contrasenya" className="block text-[13px] font-medium text-ink">
          Contrasenya
        </label>
        <input
          id="contrasenya"
          name="contrasenya"
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
          className="field"
        />
      </div>

      {estat.error ? (
        <p role="alert" className="rounded-lg bg-marca-clar px-3.5 py-2.5 text-[13px] text-marca-fosc">
          {estat.error}
        </p>
      ) : null}

      <button type="submit" disabled={enviant} className="btn-primary !mt-6">
        {enviant ? "Entrant…" : "Entra"}
      </button>
    </form>
  );
}
