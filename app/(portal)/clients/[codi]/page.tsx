import Link from "next/link";
import { notFound } from "next/navigation";

import { AvisConnexio } from "@/components/AvisConnexio";
import { ICONES } from "@/components/Icones";
import { Dada, Etiqueta, Plafo } from "@/components/UI";
import { EstatClientFactusol } from "@/app/(portal)/configuracio/TaulaErp";
import { PanellFacturacio } from "@/components/crm/PanellFacturacio";
import { nomTipusClient } from "@/domini/factusol-vocabulari";
import { resumDeFacturacio } from "@/serveis/facturacio";
import {
  carregaCatalegs,
  clientDelPortal,
  nomAgent,
  nomFormaPagament,
  nomTarifa,
} from "@/serveis/clients";

import { dataCurta, euros, iban, percentatge } from "@/lib/format";
import { exigeixVeuTot } from "@/lib/sessio-actual";

const PAISOS: Record<string, string> = { ES: "Espanya", PT: "Portugal", FR: "França", AD: "Andorra" };

export async function generateMetadata({ params }: { params: Promise<{ codi: string }> }) {
  try {
    const client = await clientDelPortal(Number((await params).codi));
    return { title: client ? `${client.NOFCLI} · Clients` : "Client no trobat" };
  } catch {
    return { title: "Clients · Wine Backend" };
  }
}

export default async function DetallClient({ params }: { params: Promise<{ codi: string }> }) {
  await exigeixVeuTot();
  const codi = Number((await params).codi);
  if (!Number.isFinite(codi)) notFound();

  const Enrere = ICONES.enrere;

  let client: Awaited<ReturnType<typeof clientDelPortal>>;
  let catalegs;
  try {
    [client, catalegs] = await Promise.all([clientDelPortal(codi), carregaCatalegs()]);
  } catch (error) {
    return (
      <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
        <Link href="/clients" className="inline-flex items-center gap-1 text-[13.5px] text-muted transition hover:text-ink">
          <Enrere className="size-4" />
          Clients
        </Link>
        <div className="mt-6">
          <AvisConnexio error={error} />
        </div>
      </div>
    );
  }
  if (!client) notFound();
  // La facturació ve de la còpia de Directus: si no es pot llegir, el plafó no surt.
  const facturacio = await resumDeFacturacio({ camp: "codi_client_erp", valor: String(codi) }).catch(() => null);

  const compte = iban(client);
  const contactes = [
    { nom: client.NO1CLI, telefon: client.TF1CLI, correu: client.EM1CLI },
    { nom: client.NO2CLI, telefon: client.TF2CLI, correu: client.EM2CLI },
  ].filter((contacte) => contacte.nom || contacte.telefon || contacte.correu);

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      <Link href="/clients" className="inline-flex items-center gap-1 text-[13.5px] text-muted transition hover:text-ink">
        <Enrere className="size-4" />
        Clients
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-muted">{String(client.CODCLI).padStart(4, "0")}</span>
            {client.TCLCLI ? <Etiqueta>{nomTipusClient(catalegs.tipusClient, client.TCLCLI)}</Etiqueta> : null}
            <EstatClientFactusol codi={client.ESTCLI} />
          </div>
          <h1 className="mt-2 font-display text-[34px] leading-[1.15] tracking-[-0.01em]">{client.NOFCLI}</h1>
          {client.NOCCLI && client.NOCCLI !== client.NOFCLI ? (
            <p className="mt-1 text-[14px] text-muted">{client.NOCCLI}</p>
          ) : null}
        </div>

        <div className="text-right text-[13px] text-muted">
          <p>
            Alta <span className="text-ink">{dataCurta(client.FALCLI) || "—"}</span>
          </p>
          <p className="mt-1">
            Darrer moviment <span className="text-ink">{dataCurta(client.FUMCLI) || "—"}</span>
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Plafo titol="Identificació">
          <Dada etiqueta="NIF / CIF" valor={client.NIFCLI ? <span className="font-mono">{client.NIFCLI}</span> : ""} />
          <Dada etiqueta="Nom fiscal" valor={client.NOFCLI} />
          <Dada etiqueta="Nom comercial" valor={client.NOCCLI} />
          <Dada etiqueta="Tipus de client" valor={nomTipusClient(catalegs.tipusClient, client.TCLCLI) ?? ""} />
        </Plafo>

        <Plafo titol="Adreça fiscal">
          <Dada etiqueta="Domicili" valor={client.DOMCLI} />
          <Dada etiqueta="Població" valor={[client.CPOCLI, client.POBCLI].filter(Boolean).join(" · ")} />
          <Dada etiqueta="Província" valor={client.PROCLI} />
          <Dada etiqueta="País" valor={PAISOS[client.PAICLI] ?? client.PAICLI} />
        </Plafo>

        <Plafo titol="Contacte">
          <Dada etiqueta="Persona" valor={client.PCOCLI} />
          <Dada
            etiqueta="Telèfon"
            valor={client.TELCLI ? <a className="hover:text-wine" href={`tel:${client.TELCLI}`}>{client.TELCLI}</a> : ""}
          />
          <Dada
            etiqueta="Mòbil"
            valor={client.MOVCLI ? <a className="hover:text-wine" href={`tel:${client.MOVCLI}`}>{client.MOVCLI}</a> : ""}
          />
          <Dada
            etiqueta="Correu"
            valor={client.EMACLI ? <a className="hover:text-wine" href={`mailto:${client.EMACLI}`}>{client.EMACLI}</a> : ""}
          />
          <Dada etiqueta="Web" valor={client.WEBCLI} />
        </Plafo>

        <Plafo titol="Condicions comercials">
          <Dada etiqueta="Forma de pagament" valor={nomFormaPagament(catalegs.formesPagament, client.FPACLI)} />
          <Dada etiqueta="Tarifa" valor={nomTarifa(client.TARCLI)} />
          <Dada etiqueta="Descompte" valor={client.DP1CLI ? percentatge(client.DP1CLI) : "Sense descompte"} />
          <Dada etiqueta="Retenció" valor={client.RETCLI ? percentatge(client.RETCLI) : ""} />
          <Dada etiqueta="Risc màxim" valor={client.CRFCLI ? euros(client.CRFCLI) : "Sense límit fixat"} />
          <Dada etiqueta="Agent" valor={nomAgent(catalegs.agents, client.AGECLI)} />
        </Plafo>

        {facturacio ? (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Facturació</h2>
            <div className="mt-4">
              <PanellFacturacio resum={facturacio} />
            </div>
          </section>
        ) : null}

        {compte || client.BANCLI ? (
          <Plafo titol="Dades bancàries">
            <Dada etiqueta="Entitat" valor={client.BANCLI} />
            <Dada etiqueta="IBAN" valor={compte ? <span className="font-mono text-[13.5px]">{compte}</span> : ""} />
          </Plafo>
        ) : null}

        {contactes.length > 0 ? (
          <Plafo titol="Persones de contacte">
            {contactes.map((contacte, index) => (
              <div key={index} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <p className="text-[14px] font-medium">{contacte.nom || "Sense nom"}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {[contacte.telefon, contacte.correu].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </Plafo>
        ) : null}

        {client.ACO1CLI || client.ADO1CLI ? (
          <Plafo titol="Adreça d'enviament">
            <Dada etiqueta="Nom" valor={client.ACO1CLI} />
            <Dada etiqueta="Domicili" valor={client.ADO1CLI} />
            <Dada etiqueta="Població" valor={[client.ACP1CLI, client.APO1CLI].filter(Boolean).join(" · ")} />
            <Dada etiqueta="Província" valor={client.APR1CLI} />
          </Plafo>
        ) : null}


        {client.OBSCLI ? (
          <section className="card p-5 lg:col-span-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Observacions</h2>
            <p className="mt-3 text-[14px] leading-relaxed">{client.OBSCLI}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
