import Link from "next/link";

import { Capcalera, EstatBuit, Etiqueta, Plafo } from "@/components/UI";
import { dataHoraCurta } from "@/lib/format";
import { clientsPerCategoria, frangesDeCategoria } from "@/serveis/crm-categoria";
import { llistaTipusActivitat, usosDelsTipus } from "@/serveis/crm-tipus-activitat";
import { connexioPerAlFormulari, estatErp } from "@/serveis/erp";
import { esAdministrador } from "@/lib/sessio";
import { sessioActual } from "@/lib/sessio-actual";
import { darreresSincros, hiHaSincroEnCurs } from "@/serveis/erp-sincro";

import { BotoSincronitza } from "./BotoSincronitza";
import { FormulariConnexioErp } from "./FormulariConnexioErp";

import { FormulariCategoria } from "./FormulariCategoria";
import { FormulariTipusActivitat } from "./FormulariTipusActivitat";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export const metadata = { title: "Configuració · vproof CRM" };

/** Els valors que governen el CRM i l'estat de la connexió amb l'ERP. */
const PESTANYES = [
  { clau: "valors", etiqueta: "Valors CRM" },
  { clau: "erp", etiqueta: "Connexió amb l'ERP" },
] as const;

type Pestanya = (typeof PESTANYES)[number]["clau"];

export default async function PaginaConfiguracio({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  await exigeixVeuTot();
  const { t } = await searchParams;
  const pestanya: Pestanya = PESTANYES.some((x) => x.clau === t) ? (t as Pestanya) : "valors";

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Capcalera titol="Configuració" descripcio="Els valors del CRM i la connexió amb l'ERP." />

      {/* Embolcallen en comptes de rascar: al mòbil no hi ha scroll de costat. */}
      <nav className="mt-5 flex flex-wrap gap-1 border-b border-line" aria-label="Seccions de configuració">
        {PESTANYES.map((x) => {
          const activa = x.clau === pestanya;
          return (
            <Link
              key={x.clau}
              href={x.clau === "valors" ? "/configuracio" : `/configuracio?t=${x.clau}`}
              aria-current={activa ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13.5px] transition-colors ${
                activa
                  ? "border-marca font-medium text-ink"
                  : "border-transparent text-muted hover:border-line hover:text-ink-soft"
              }`}
            >
              {x.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">{pestanya === "valors" ? <SeccioValorsCrm /> : <SeccioErp />}</div>
    </div>
  );
}

/** Un avís de configuració: què passa i, si n'hi ha, el detall de l'error. */
function AvisModel({ titol, text, detall }: { titol: string; text: React.ReactNode; detall?: string | null }) {
  return (
    <div className="card border-marca/30 p-5">
      <p className="text-[14px] font-medium text-marca-fosc">{titol}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{text}</p>
      {detall ? <p className="mt-2 rounded-lg bg-parchment px-3.5 py-2.5 font-mono text-[12.5px] text-ink">{detall}</p> : null}
    </div>
  );
}

/** Els valors que governen el CRM: les franges de la categoria i els tipus d'activitat. Un no s'endú l'altre si falla. */
function SeccioValorsCrm() {
  return (
    <div className="max-w-[820px] space-y-4">
      <PlafoCategoria />
      <PlafoTipusActivitat />
    </div>
  );
}

async function PlafoCategoria() {
  let franges;
  let quants: Record<string, number> = {};
  try {
    [franges, quants] = await Promise.all([frangesDeCategoria(), clientsPerCategoria()]);
  } catch (error) {
    return <EstatBuit titol="No s'han pogut llegir els valors del CRM" text={(error as Error).message} />;
  }

  return (
    <Plafo titol="Categoria dels clients">
      <p className="text-[14px] leading-relaxed text-muted">
        La categoria de cada client es calcula sola amb la facturació de l&apos;exercici passat sencer (base imposable,
        sense IVA): li toca la lletra de la franja on cau. Es posa al dia quan arriba la facturació de l&apos;ERP i, en
        desar aquí, es recalcula a tots els clients de cop. La columna «Clients» compta els que surten al CRM: tots
        menys els de baixa. El potencial és una altra cosa: la mateixa escala, però la posa a mà qui porta el compte,
        a la fitxa del client.
      </p>
      <div className="mt-4">
        <FormulariCategoria franges={franges} quants={quants} />
      </div>
    </Plafo>
  );
}

/** La taula dels tipus d'activitat. Si no es pot llegir, el CRM fa servir els de partida i aquí es diu per què. */
async function PlafoTipusActivitat() {
  let tipus;
  let usos: Record<string, number> = {};
  let detall: string | null = null;
  try {
    [tipus, usos] = await Promise.all([llistaTipusActivitat(), usosDelsTipus()]);
  } catch (error) {
    detall = (error as Error).message;
  }

  if (!tipus || tipus.length === 0) {
    return (
      <AvisModel
        titol="No s'han pogut llegir els tipus d'activitat."
        text="Mentrestant, el CRM fa servir els tipus de partida."
        detall={detall}
      />
    );
  }

  return (
    <Plafo titol="Tipus d'activitat">
      <p className="text-[14px] leading-relaxed text-muted">
        Els tipus que es trien en crear una activitat. Canviar-ne el nom no toca cap activitat: les que ja hi ha surten
        amb el nom nou. Només es poden esborrar els creats aquí que encara no tenen cap activitat. Portar diversos
        clients o laboratoris a la mateixa visita és propi de les visites de client/s a laboratori i de laboratoris a client: en un
        tipus nou, no es pot.
      </p>
      <dl className="mt-3 grid gap-x-2 gap-y-1 text-[13px] leading-relaxed text-muted sm:grid-cols-[max-content_minmax(0,1fr)]">
        <dt className="font-medium text-ink-soft">Compta com a visita</dt>
        <dd className="mb-1 sm:mb-0">Les activitats d&apos;aquest tipus sumen a les visites del tauler.</dd>
        <dt className="font-medium text-ink-soft">Demana productes</dt>
        <dd className="mb-1 sm:mb-0">El formulari de l&apos;activitat mostra el camp dels productes presentats.</dd>
        <dt className="font-medium text-ink-soft">Demana laboratori</dt>
        <dd className="mb-1 sm:mb-0">El formulari de l&apos;activitat mostra el camp del laboratori.</dd>
        <dt className="font-medium text-ink-soft">Es pot triar</dt>
        <dd className="mb-1 sm:mb-0">Surt en crear una activitat. Si el desmarques, les que ja el tenen el conserven.</dd>
        <dt className="font-medium text-ink-soft">Núm. d&apos;activitats</dt>
        <dd>Quantes activitats d&apos;aquest tipus hi ha ara mateix.</dd>
      </dl>
      <div className="mt-4">
        <FormulariTipusActivitat tipus={tipus} usos={usos} />
      </div>
    </Plafo>
  );
}


/** La connexió amb vprooferp: l'estat, la sincronització a mà i com han anat les darreres passades. */
async function SeccioErp() {
  const [estat, connexio, sessio] = await Promise.all([estatErp(), connexioPerAlFormulari(), sessioActual()]);
  let passades: Awaited<ReturnType<typeof darreresSincros>> = [];
  let error: string | null = null;
  try {
    passades = await darreresSincros(8);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="max-w-[820px] space-y-4">
      <Plafo titol="vprooferp">
        <p className="text-[14px] leading-relaxed text-muted">{estat.missatge}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          De l&apos;ERP arriben els tipus de client (grups de client), els agents comercials, els laboratoris (proveïdors), els
          clients amb la seva adreça i els establiments, els productes amb el preu de venda, l&apos;estoc i la foto, els albarans
          d&apos;aquest exercici i del passat, i la facturació mensual de tres exercicis. El que és només del CRM (potencial,
          periodicitat, horaris, notes, activitats…) no es toca. Les fitxes que vénen de l&apos;ERP tenen bloquejats els camps
          que porta l&apos;ERP.
        </p>
        {estat.connectat ? (
          <div className="mt-4">
            <BotoSincronitza enCurs={hiHaSincroEnCurs()} />
          </div>
        ) : null}
      </Plafo>

      <Plafo titol="Connexió">
        <p className="mb-4 text-[13.5px] leading-relaxed text-muted">
          A l&apos;ERP, la clau és la d&apos;un usuari amb permís de lectura (rols Sales User, Stock User, Purchase User i
          Accounts User): a la seva fitxa, «API Access» › «Generate Keys». El secret només es veu un cop, en generar-lo.
        </p>
        <FormulariConnexioErp inicials={connexio} potEditar={esAdministrador(sessio)} />
      </Plafo>

      <Plafo titol="Darreres sincronitzacions">
        {error ? (
          <p className="text-[13.5px] text-muted">{error}</p>
        ) : passades.length === 0 ? (
          <p className="text-[13.5px] text-muted">Encara no se n&apos;ha fet cap.</p>
        ) : (
          <ul className="divide-y divide-line">
            {passades.map((passada) => (
              <li key={passada.inici ?? ""} className="py-3">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px]">
                  <span className="font-medium">{passada.inici ? dataHoraCurta(passada.inici) : "—"}</span>
                  <Etiqueta to={passada.estat === "correcte" ? "verd" : passada.estat === "en_curs" ? "blau" : passada.estat === "parcial" ? "ambre" : "marca"}>
                    {NOM_ESTAT[passada.estat ?? ""] ?? passada.estat}
                  </Etiqueta>
                  <span className="text-muted">{passada.desencadenant === "manual" ? "a mà" : "programada"}</span>
                </p>
                {passada.missatge ? <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-muted">{passada.missatge}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Plafo>
    </div>
  );
}

const NOM_ESTAT: Record<string, string> = { correcte: "Correcta", parcial: "Amb errors", error: "Error", en_curs: "En curs" };
