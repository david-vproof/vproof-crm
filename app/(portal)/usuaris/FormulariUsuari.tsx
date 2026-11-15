"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import { ROL_MANAGER, ROL_MANAGER_NOU } from "@/domini/rols";
import type { AgentPortal, RolPortal, UsuariPortal } from "@/serveis/usuaris";

import { desaUsuariAccio, type EstatFormulariUsuari } from "./actions";

function Seccio({ titol, nota, children }: { titol: string; nota?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{titol}</h2>
      {nota ? <p className="mt-1.5 text-[13px] text-muted">{nota}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Etiqueta({ per, children }: { per: string; children: ReactNode }) {
  return (
    <label htmlFor={per} className="block text-[13px] font-medium text-ink">
      {children}
    </label>
  );
}

function Camp({
  etiqueta,
  nom,
  ...resta
}: { etiqueta: string; nom: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "className">) {
  return (
    <div className="space-y-1.5">
      <Etiqueta per={nom}>{etiqueta}</Etiqueta>
      <input id={nom} name={nom} className="field" {...resta} />
    </div>
  );
}

/**
 * L'alta o l'edició d'un usuari. Cada canvi es signa amb la contrasenya de
 * l'administrador: és amb les seves credencials que Directus el rep.
 */
export function FormulariUsuari({
  usuari,
  rols,
  agents,
  agentsLligats,
}: {
  usuari: UsuariPortal | null;
  rols: RolPortal[];
  agents: AgentPortal[];
  /** De cada agent ja lligat a un altre compte, el nom de qui el té. */
  agentsLligats: Record<string, string>;
}) {
  const [estat, accio, enviant] = useActionState<EstatFormulariUsuari, FormData>(desaUsuariAccio, {});
  const nou = usuari === null;
  // Un compte nou es proposa amb un rol que no administri: donar l'administració
  // ha de ser una tria expressa. Un rol que ja no existeix no ha de deixar el
  // desplegable sense cap valor.
  const rolProposat = rols.find((rol) => rol.nom.toLowerCase() !== "administrator") ?? rols[0];
  const rolInicial = rols.some((rol) => rol.id === usuari?.rol?.id) ? usuari?.rol?.id : (rolProposat?.id ?? "");

  return (
    <form action={accio} className="space-y-4">
      <input type="hidden" name="id" value={usuari?.id ?? ""} />

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[22px] leading-tight">{nou ? "Nou usuari" : `${usuari.nom} ${usuari.cognoms}`.trim()}</h2>
        <Link href="/usuaris" className="text-[13px] text-muted hover:text-ink">
          ← Torna a la llista
        </Link>
      </div>

      <Seccio titol="Dades del compte">
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp etiqueta="Nom" nom="nom" defaultValue={usuari?.nom ?? ""} autoComplete="off" required />
          <Camp etiqueta="Cognoms" nom="cognoms" defaultValue={usuari?.cognoms ?? ""} autoComplete="off" />
          <Camp etiqueta="Correu electrònic" nom="correu" type="email" defaultValue={usuari?.correu ?? ""} autoComplete="off" required />
          <div className="space-y-1.5">
            <Camp etiqueta="Telèfon" nom="telefon" type="tel" defaultValue={usuari?.telefon ?? ""} autoComplete="off" />
            <p className="text-[12.5px] text-muted">Surt al peu de la fulla de vins que treu aquesta persona, amb el correu.</p>
          </div>
          <div className="space-y-1.5">
            <Etiqueta per="rol">Rol a Directus</Etiqueta>
            <select id="rol" name="rol" defaultValue={rolInicial} className="field" required>
              {rols.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nom}
                </option>
              ))}
              {!rols.some((rol) => rol.nom.toLowerCase() === ROL_MANAGER) ? (
                // Encara no hi és a Directus: triar-lo el crea en desar, amb la contrasenya que ja es demana.
                <option value={ROL_MANAGER_NOU}>Manager (es crearà en desar)</option>
              ) : null}
            </select>
            <p className="text-[12.5px] text-muted">
              Administrator veu els clients de tothom i aquesta pantalla. Manager veu els clients de tothom i l&apos;ERP, sense
              administrar usuaris. La resta només veu els clients del seu agent comercial.
            </p>
          </div>
          <div className="space-y-1.5">
            <Etiqueta per="agent">Agent comercial</Etiqueta>
            <select id="agent" name="agent" defaultValue={usuari?.agent?.id ?? ""} className="field">
              <option value="">No és cap agent</option>
              {agents.map((agent) => (
                // Un agent que ja té un altre compte es veu, però no es pot triar.
                <option key={agent.id} value={agent.id} disabled={Boolean(agentsLligats[agent.id])}>
                  {agentsLligats[agent.id] ? `${agent.nom} · ja és de ${agentsLligats[agent.id]}` : agent.nom}
                </option>
              ))}
            </select>
            <p className="text-[12.5px] text-muted">L&apos;agent de FactuSol que porta els clients d&apos;aquesta persona.</p>
          </div>
          {nou ? null : (
            <div className="space-y-1.5">
              <Etiqueta per="estat">Estat</Etiqueta>
              <select id="estat" name="estat" defaultValue={usuari.estat === "suspes" ? "suspes" : "actiu"} className="field">
                <option value="actiu">Actiu</option>
                <option value="suspes">Suspès (no pot entrar)</option>
              </select>
            </div>
          )}
        </div>
      </Seccio>

      <Seccio
        titol={nou ? "Contrasenya inicial" : "Contrasenya"}
        nota={
          nou
            ? "Mínim 8 caràcters. Un cop dins, la persona la pot canviar des d'«El meu compte»."
            : "Deixa-ho en blanc si no la vols canviar. Mínim 8 caràcters."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp etiqueta="Contrasenya" nom="contrasenya" type="password" autoComplete="new-password" minLength={8} required={nou} />
          <Camp etiqueta="Repeteix la contrasenya" nom="contrasenya_repetida" type="password" autoComplete="new-password" required={nou} />
        </div>
      </Seccio>

      <Seccio titol="Confirmació" nota="Els canvis es fan a Directus amb el teu compte: cal la teva contrasenya.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp etiqueta="La teva contrasenya" nom="contrasenya_admin" type="password" autoComplete="current-password" required />
        </div>

        {estat.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-wine-tint px-3.5 py-2.5 text-[13px] text-wine-deep">
            {estat.error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={enviant} className="btn-compacte">
            {enviant ? "Desant…" : nou ? "Crea l'usuari" : "Desa els canvis"}
          </button>
          <Link href="/usuaris" className="text-[13px] text-muted hover:text-ink">
            Cancel·la
          </Link>
        </div>
      </Seccio>
    </form>
  );
}
