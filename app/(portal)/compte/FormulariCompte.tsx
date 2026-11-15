"use client";

import { useActionState, type ReactNode } from "react";

import type { PerfilUsuari } from "@/serveis/identitat";

import { desaCompteAccio, type EstatCompte } from "./actions";

function Seccio({ titol, nota, children }: { titol: string; nota?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{titol}</h2>
      {nota ? <p className="mt-1.5 text-[13px] text-muted">{nota}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Camp({
  etiqueta,
  nom,
  ...resta
}: { etiqueta: string; nom: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className">) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={nom} className="block text-[13px] font-medium text-ink">
        {etiqueta}
      </label>
      <input id={nom} name={nom} className="field" {...resta} />
    </div>
  );
}

export function FormulariCompte({ perfil, potCanviarTelefon }: { perfil: PerfilUsuari; potCanviarTelefon: boolean }) {
  const [estat, accio, enviant] = useActionState<EstatCompte, FormData>(desaCompteAccio, {});

  return (
    // La clau fa que, un cop desat, el formulari torni a partir de les dades noves.
    <form key={`${perfil.nom}|${perfil.cognoms}|${perfil.correu}|${perfil.telefon}`} action={accio} className="space-y-4">
      <Seccio titol="Dades personals">
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp etiqueta="Nom" nom="nom" defaultValue={perfil.nom} autoComplete="given-name" required />
          <Camp etiqueta="Cognoms" nom="cognoms" defaultValue={perfil.cognoms} autoComplete="family-name" />
          <Camp etiqueta="Correu electrònic" nom="correu" type="email" defaultValue={perfil.correu} autoComplete="email" required />
          <div className="space-y-1.5">
            <Camp etiqueta="Telèfon" nom="telefon" type="tel" defaultValue={perfil.telefon} autoComplete="tel" disabled={!potCanviarTelefon} />
            <p className="text-[12.5px] text-muted">
              {potCanviarTelefon ? "Surt al peu de la fulla de productes, amb el correu." : "Surt al peu de la fulla de productes, amb el correu. El canvia un administrador."}
            </p>
          </div>
        </div>
      </Seccio>

      <Seccio titol="Contrasenya" nota="Deixa-ho en blanc si no la vols canviar. Mínim 8 caràcters.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp etiqueta="Contrasenya nova" nom="contrasenya_nova" type="password" autoComplete="new-password" minLength={8} />
          <Camp etiqueta="Repeteix la contrasenya nova" nom="contrasenya_repetida" type="password" autoComplete="new-password" />
        </div>
      </Seccio>

      <Seccio titol="Confirmació" nota="Per desar qualsevol canvi cal la contrasenya actual.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp etiqueta="Contrasenya actual" nom="contrasenya_actual" type="password" autoComplete="current-password" required />
        </div>

        {estat.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-marca-clar px-3.5 py-2.5 text-[13px] text-marca-fosc">
            {estat.error}
          </p>
        ) : null}
        {estat.fet ? (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
            {estat.fet}
          </p>
        ) : null}

        <div className="mt-4">
          <button type="submit" disabled={enviant} className="btn-compacte">
            {enviant ? "Desant…" : "Desa els canvis"}
          </button>
        </div>
      </Seccio>
    </form>
  );
}
