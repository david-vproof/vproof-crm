import Link from "next/link";
import { notFound } from "next/navigation";

import { Capcalera, EstatBuit } from "@/components/UI";
import { ROL_MANAGER, esAdministrador } from "@/lib/sessio";
import { sessioActual } from "@/lib/sessio-actual";
import { ErrorUsuaris, usuarisDelPortal, type UsuariPortal } from "@/serveis/usuaris";

import { FormulariRolManager } from "./FormulariRolManager";
import { FormulariUsuari } from "./FormulariUsuari";

export const metadata = { title: "Usuaris · vproof CRM" };

type Parametres = { searchParams: Promise<{ u?: string; nou?: string; fet?: string }> };

const FLASH: Record<string, string> = {
  creat: "Usuari creat. Ja pot entrar al portal amb el seu correu i la contrasenya inicial.",
  desat: "Canvis desats.",
  rol: "Rol Manager creat. Ja es pot donar a qui hagi de veure els clients de tothom.",
  rol_sense_politica:
    "Rol Manager creat, però sense la política de l'equip (wine_users): qui el tingui no podrà entrar fins que es passi scripts/crm-acces.mjs.",
};

const dataHora = new Intl.DateTimeFormat("ca-ES", {
  timeZone: "Europe/Madrid",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function darrerAcces(iso: string | null) {
  if (!iso) return "Mai";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "—" : dataHora.format(data);
}

const TO_ESTAT: Record<UsuariPortal["estat"], string> = {
  actiu: "bg-emerald-50 text-emerald-700",
  suspes: "bg-marca-clar text-marca-fosc",
  altre: "bg-amber-50 text-amber-700",
};

function textEstat(usuari: UsuariPortal) {
  return usuari.estat === "actiu" ? "Actiu" : usuari.estat === "suspes" ? "Suspès" : usuari.estatDirectus;
}

/** Cada usuari s'obre a la seva fitxa; el propi, a «El meu compte». */
function enllacDe(usuari: UsuariPortal, propi: boolean) {
  return propi ? "/compte" : `/usuaris?u=${encodeURIComponent(usuari.id)}`;
}

function Estat({ usuari }: { usuari: UsuariPortal }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${TO_ESTAT[usuari.estat]}`}>
      {textEstat(usuari)}
    </span>
  );
}

function LlistaUsuaris({ usuaris, actual }: { usuaris: UsuariPortal[]; actual: string | undefined }) {
  if (usuaris.length === 0) {
    return <EstatBuit titol="Encara no hi ha cap usuari" text="Comença amb el botó «Nou usuari»." />;
  }

  return (
    <div className="card overflow-hidden">
      {/* Al mòbil la taula no hi cap sense rascar de costat: es plega en fitxes. */}
      <ul className="divide-y divide-line/70 md:hidden">
        {usuaris.map((usuari) => {
          const propi = usuari.id === actual;
          return (
            <li key={usuari.id}>
              <Link href={enllacDe(usuari, propi)} className="block px-4 py-3 transition-colors hover:bg-parchment/40">
                <span className="flex items-center justify-between gap-3">
                  <span className="truncate text-[14px] font-medium text-ink">
                    {`${usuari.nom} ${usuari.cognoms}`.trim() || usuari.correu}
                    {propi ? <span className="ml-1.5 text-[12px] font-normal text-muted">(tu)</span> : null}
                  </span>
                  <Estat usuari={usuari} />
                </span>
                <span className="mt-1 block truncate text-[12.5px] text-muted">{usuari.correu}</span>
                <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
                  {usuari.telefon ? <span>{usuari.telefon}</span> : null}
                  <span>{usuari.rol?.nom ?? "Sense rol"}</span>
                  {usuari.agent ? <span>Agent: {usuari.agent.nom}</span> : null}
                  <span>Darrer accés: {darrerAcces(usuari.darrerAcces)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <table className="hidden w-full border-collapse text-[13px] md:table">
        <thead>
          <tr className="border-b border-line bg-cream/70">
            {["Nom", "Correu i telèfon", "Rol", "Agent", "Estat", "Darrer accés"].map((titol) => (
              <th
                key={titol}
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.07em] text-muted"
              >
                {titol}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usuaris.map((usuari) => {
            const propi = usuari.id === actual;
            return (
              <tr key={usuari.id} className="group border-b border-line/60 transition-colors last:border-0 hover:bg-parchment/40">
                <td className="max-w-[220px] truncate px-3 py-[9px] align-middle">
                  <Link
                    href={enllacDe(usuari, propi)}
                    className="font-medium text-ink underline-offset-2 group-hover:text-marca group-hover:underline"
                  >
                    {`${usuari.nom} ${usuari.cognoms}`.trim() || "Sense nom"}
                  </Link>
                  {propi ? <span className="ml-1.5 text-[12px] text-muted">(tu)</span> : null}
                </td>
                {/* A la mateixa cel·la: una columna més deixaria fora de la taula el darrer accés. */}
                <td className="max-w-[240px] truncate px-3 py-[9px] align-middle text-muted">
                  {usuari.correu}
                  {usuari.telefon ? <span className="block tabular-nums">{usuari.telefon}</span> : null}
                </td>
                <td className="px-3 py-[9px] align-middle">
                  <span className="inline-flex rounded-md bg-parchment px-1.5 py-0.5 text-[12.5px] text-ink-soft">
                    {usuari.rol?.nom ?? "Sense rol"}
                  </span>
                </td>
                <td className="max-w-[160px] truncate px-3 py-[9px] align-middle text-muted">{usuari.agent?.nom ?? "—"}</td>
                <td className="px-3 py-[9px] align-middle">
                  <Estat usuari={usuari} />
                </td>
                <td className="whitespace-nowrap px-3 py-[9px] align-middle tabular-nums text-muted">
                  {darrerAcces(usuari.darrerAcces)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaUsuaris({ searchParams }: Parametres) {
  const sessio = await sessioActual();
  // Qui no administra no ha de saber ni que la pàgina existeix.
  if (!sessio || !esAdministrador(sessio)) notFound();

  const { u = "", nou = "", fet = "" } = await searchParams;

  let dades: Awaited<ReturnType<typeof usuarisDelPortal>> | null = null;
  let avis: string | null = null;
  try {
    dades = await usuarisDelPortal();
  } catch (error) {
    avis = error instanceof ErrorUsuaris ? error.message : "No s'han pogut llegir els usuaris.";
  }

  const editant = dades?.usuaris.find((usuari) => usuari.id === u && usuari.id !== sessio.id) ?? null;
  const formulari = dades !== null && (nou === "1" || editant !== null);

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Capcalera
        titol="Usuaris"
        descripcio="Qui pot entrar al portal i treballar amb el CRM. Els comptes viuen a la base de dades del portal."
        accions={
          dades && !formulari ? (
            <Link href="/usuaris?nou=1" className="btn-compacte">
              + Nou usuari
            </Link>
          ) : null
        }
      />

      <div className="mt-6 space-y-6">
        {FLASH[fet] ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800">
            {FLASH[fet]}
          </p>
        ) : null}

        {avis ? <EstatBuit titol="No s'han pogut llegir els usuaris" text={avis} /> : null}

        {dades && !formulari && !dades.rols.some((rol) => rol.nom.toLowerCase() === ROL_MANAGER) ? <FormulariRolManager /> : null}

        {dades && formulari ? (
          <FormulariUsuari
            usuari={editant}
            rols={dades.rols}
            agents={dades.agents}
            agentsLligats={Object.fromEntries(
              dades.usuaris
                .filter((usuari) => usuari.agent && usuari.id !== editant?.id)
                .map((usuari) => [usuari.agent!.id, `${usuari.nom} ${usuari.cognoms}`.trim() || usuari.correu]),
            )}
          />
        ) : dades ? (
          <>
            <LlistaUsuaris usuaris={dades.usuaris} actual={sessio.id} />
            <p className="text-[13px] text-muted">
              L&apos;administrador i el manager veuen els clients de tothom. La resta només veu els clients del seu agent
              comercial (el vincle amb l&apos;ERP que es tria aquí) i tot el que en penja: leads, contactes, oportunitats,
              activitats i To-Do. Qui no té agent no veu cap client.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
