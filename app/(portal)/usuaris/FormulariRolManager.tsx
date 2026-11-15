"use client";

import { useActionState } from "react";

import { creaRolManagerAccio, type EstatFormulariUsuari } from "./actions";

/**
 * Quan a la base de dades encara no hi ha el rol Manager: es crea des d'aquí, amb la
 * contrasenya de l'administrador, com qualsevol altre canvi d'usuaris.
 */
export function FormulariRolManager() {
  const [estat, accio, pendent] = useActionState<EstatFormulariUsuari, FormData>(creaRolManagerAccio, {});

  return (
    <form action={accio} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <p>
        A la base de dades no hi ha el rol <strong>Manager</strong>: qui el té veu els clients de tothom, com l&apos;administrador, però
        sense administrar usuaris. Es pot crear des d&apos;aquí.
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          type="password"
          name="contrasenya_admin"
          autoComplete="current-password"
          placeholder="La teva contrasenya"
          aria-label="La teva contrasenya"
          required
          className="field-compacte w-auto"
        />
        <button type="submit" disabled={pendent} className="btn-compacte">
          {pendent ? "Creant…" : "Crea el rol Manager"}
        </button>
        {estat.error ? <span className="text-marca-fosc">{estat.error}</span> : null}
      </div>
    </form>
  );
}
