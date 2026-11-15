import { EnllacFila } from "@/components/crm/EnllacFila";
import { MarquesClient } from "@/components/crm/MarquesClient";
import { BotonsContacte, ValorContacte, teContacte } from "@/components/crm/Contacte";
import { MiniFacturacio } from "@/components/crm/MiniFacturacio";
import { MiniSeguiment } from "@/components/crm/MiniSeguiment";
import { Notes } from "@/components/crm/Notes";
import { Pastilla } from "@/components/crm/Pastilla";
import { TO_LLETRA } from "@/components/crm/Lletres";
import { FONS_VISITA } from "@/components/crm/LlegendaVisites";
import type { ColumnaLlistat } from "@/domini/crm-llistat";
import type { Cel·la, FilaLlistat } from "@/serveis/crm-manteniment";

/*
 * Les files d'un llistat. Aquest fitxer no porta «use client» a posta: les
 * primeres les pinta el servidor (TaulaRegistres) i les que s'hi afegeixen en
 * baixar, el navegador (ScrollRegistres).
 */

/** El fons d'una fila: el de quant fa que no es visita, si la llista ho sap. Les altres llistes van en blanc. */
const fonsDeFila = (fila: FilaLlistat) => (fila.visita ? FONS_VISITA[fila.visita.tram] : "");

/**
 * La fila per on passa el cursor. No se li canvia el fons, que diu quant fa que
 * no es visita el client: s'hi posa a sobre un vel fosc molt lleu i una ratlla a l'esquerra,
 * de manera que es veu quina és i de quin color era. Va amb ombres perquè a les
 * cel·les d'una taula és el que s'hi pinta a sobre del fons sense tapar-lo, i
 * les classes van senceres perquè Tailwind les trobi.
 */
const RESSALT_CELLA = "group-hover:shadow-[inset_0_0_0_999px_rgb(0_0_0/0.05)]";
const RESSALT_PRIMERA = "group-hover:shadow-[inset_3px_0_0_var(--color-ink),inset_0_0_0_999px_rgb(0_0_0/0.05)]";
const RESSALT_TARGETA = "hover:shadow-[inset_3px_0_0_var(--color-ink),inset_0_0_0_999px_rgb(0_0_0/0.05)]";

/** Colors suaus per als estats que es repeteixen a tot el CRM. */
const TO: Record<string, string> = {
  ...TO_LLETRA,
  Guanyada: "bg-emerald-50 text-emerald-700",
  Actiu: "bg-emerald-50 text-emerald-700",
  Habitual: "bg-emerald-50 text-emerald-700",
  Esporàdic: "bg-amber-50 text-amber-700",
  Captació: "bg-sky-50 text-sky-700",
  Positiu: "bg-emerald-50 text-emerald-700",
  Feta: "bg-emerald-50 text-emerald-700",
  Sí: "bg-emerald-50 text-emerald-700",
  Perduda: "bg-wine-tint text-wine-deep",
  Descartat: "bg-wine-tint text-wine-deep",
  Negatiu: "bg-wine-tint text-wine-deep",
  Baixa: "bg-wine-tint text-wine-deep",
  Nou: "bg-sky-50 text-sky-700",
  Contactat: "bg-sky-50 text-sky-700",
  Qualificat: "bg-sky-50 text-sky-700",
  Qualificada: "bg-sky-50 text-sky-700",
  Pendent: "bg-amber-50 text-amber-700",
  Proposta: "bg-amber-50 text-amber-700",
  Negociació: "bg-orange-50 text-orange-700",
  Tast: "bg-violet-50 text-violet-700",
  "Visita amb vi": "bg-violet-50 text-violet-700",
  "Visita del client al celler": "bg-wine-tint text-wine-deep",
  Trucada: "bg-sky-50 text-sky-700",
  Correu: "bg-parchment text-muted",
  Reunió: "bg-amber-50 text-amber-700",
};

/**
 * Les columnes que barregen dos camps —el client o el lead d'una activitat—
 * pinten la cel·la segons d'on surt el valor: verd per als clients, com
 * «Habitual», i blau per als leads, com «Captació». Un to més fosc que el dels
 * estats, perquè un fons de cel·la tan clar no es distingia. Les classes van
 * senceres perquè Tailwind les trobi.
 */
const TO_ORIGEN: Record<string, { fons: string; text: string; punt: string; pastilla: string; etiqueta: string }> = {
  client: { fons: "bg-emerald-100", text: "text-emerald-900", punt: "bg-emerald-600", pastilla: "bg-emerald-100 text-emerald-800", etiqueta: "Client" },
  lead: { fons: "bg-sky-100", text: "text-sky-900", punt: "bg-sky-600", pastilla: "bg-sky-100 text-sky-800", etiqueta: "Lead" },
};

const toDOrigen = (valor: Cel·la) => (valor.origen ? TO_ORIGEN[valor.origen] : undefined);

function Cella({ valor }: { valor: Cel·la }) {
  if (valor.buida) return <span className="text-line">—</span>;

  if (valor.contacte) return <ValorContacte mena={valor.contacte} text={valor.text} />;

  if (valor.tipus === "area") return <Notes text={valor.text} />;

  if (valor.tipus === "tria" || valor.tipus === "booleà") {
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${TO[valor.text] ?? "bg-parchment text-muted"}`}>
        {valor.text}
      </span>
    );
  }

  if (valor.tipus === "facturacio") {
    return <MiniFacturacio dades={valor.dades ?? {}} />;
  }

  if (valor.tipus === "periodicitat") {
    return <MiniSeguiment dades={valor.dades} text={valor.text} />;
  }

  if (valor.tipus === "relacio") {
    const origen = toDOrigen(valor);
    // Sobre el fons de color de la cel·la, la pastilla s'aclareix i el punt diu de qui és.
    const pastilla = (
      <span
        title={origen ? `${origen.etiqueta}: ${valor.text}` : undefined}
        className={`inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-[12.5px] ${
          origen ? `bg-white/70 ${origen.text}` : "bg-parchment text-ink-soft"
        }`}
      >
        <span className={`size-1.5 shrink-0 rounded-full ${origen?.punt ?? "bg-muted/50"}`} />
        {origen ? <span className="sr-only">{origen.etiqueta}: </span> : null}
        <span className="truncate">{valor.text}</span>
      </span>
    );
    if (!valor.marques) return pastilla;
    return (
      <span className="inline-flex max-w-full items-center gap-1">
        {pastilla}
        <MarquesClient marques={valor.marques} nom={valor.text} />
      </span>
    );
  }

  if (valor.tipus === "import" || valor.tipus === "nombre" || valor.tipus === "decimal") {
    return <span className="tabular-nums text-ink-soft">{valor.text}</span>;
  }

  return <span className="text-muted">{valor.text}</span>;
}

/**
 * Un valor que va a sota del títol: una tria curta (la lletra de la categoria
 * o del potencial) com a marca de color, una relació (el tipus de client) com
 * a pastilla petita i la facturació amb les seves barres. Un buit no hi surt,
 * tret d'una lletra: les dues es llegeixen per posició, i la que falta deixa
 * un guionet perquè l'altra no es mogui.
 */
function ValorDelTitol({ valor, compacte = false }: { valor: Cel·la; compacte?: boolean }) {
  if (valor.buida && valor.tipus === "tria") {
    return (
      <span className="inline-flex shrink-0 rounded bg-parchment px-1.5 py-0.5 text-[11.5px] font-semibold text-muted" title={`Sense ${valor.etiqueta?.toLowerCase() ?? "valor"}`}>
        <span className="sr-only">Sense {valor.etiqueta?.toLowerCase() ?? "valor"}</span>–
      </span>
    );
  }
  if (valor.buida) return null;
  if (valor.tipus === "facturacio") {
    return (
      <span className="min-w-0 text-[12px] font-normal">
        <MiniFacturacio dades={valor.dades ?? {}} compacte={compacte} />
      </span>
    );
  }
  if (valor.tipus === "relacio") return <Pastilla text={valor.text} etiqueta={valor.etiqueta} />;
  return (
    <span
      title={valor.etiqueta ? `${valor.etiqueta} ${valor.text}` : undefined}
      className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${TO[valor.text] ?? "bg-parchment text-muted"}`}
    >
      {valor.etiqueta ? <span className="sr-only">{valor.etiqueta} </span> : null}
      {valor.text}
    </span>
  );
}

/** Al telèfon, els valors del títol van seguits, sense caselles, i baixen de línia si no hi caben. */
function DinsDelTitol({ cel·les }: { cel·les: Cel·la[] }) {
  return cel·les.map((valor, i) => <ValorDelTitol key={i} valor={valor} compacte />);
}

/**
 * L'amplada de la casella de cada valor del títol. És la mateixa a la
 * capçalera, al filtre i a totes les files: així, tingui el nom la llargada que
 * tingui, les lletres, el tipus i la facturació queden en columna. La d'una
 * lletra la marca el seu filtre, que és més ample que la lletra.
 */
export function ampleDelTitol(columna: ColumnaDeFila) {
  switch (columna.definicio?.tipus) {
    case "relacio":
      return "w-28";
    case "facturacio":
      return "w-44";
    default:
      return "w-16";
  }
}

/** Les columnes que només surten a partir d'una amplada: vegeu `desDe`. */
const VISIBILITAT: Record<NonNullable<ColumnaLlistat["desDe"]>, string> = {
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
};

export function visibilitat(columna: ColumnaDeFila) {
  return columna.desDe ? VISIBILITAT[columna.desDe] : "";
}

/** El que una fila necessita saber d'una columna. Les opcions dels filtres són només de la capçalera. */
export type ColumnaDeFila = Pick<ColumnaLlistat, "camp" | "etiqueta" | "alTitol" | "desDe"> & {
  definicio?: { tipus: NonNullable<ColumnaLlistat["definicio"]>["tipus"] };
};

/** Una columna reduïda a això, per passar-la al navegador. */
export const columnaDeFila = ({ camp, etiqueta, alTitol, desDe, definicio }: ColumnaLlistat): ColumnaDeFila => ({
  camp,
  etiqueta,
  alTitol,
  desDe,
  definicio: definicio ? { tipus: definicio.tipus } : undefined,
});

/** Una columna i la seva posició: les cel·les de cada fila arriben en l'ordre de les columnes. */
export type Posicio<C extends ColumnaDeFila = ColumnaDeFila> = { columna: C; i: number };

/** Les columnes que fan columna i les que van dins de la cel·la del títol. */
export function repartimentDeColumnes<C extends ColumnaDeFila>(columnes: C[]) {
  const posicions: Posicio<C>[] = columnes.map((columna, i) => ({ columna, i }));
  return {
    visibles: posicions.filter(({ columna }) => !columna.alTitol),
    delTitol: posicions.filter(({ columna }) => columna.alTitol),
  };
}

/**
 * El tros de l'enllaç d'una fila que es canvia per l'id: el servidor sap on
 * porta, i el navegador només hi posa de quina fila és. Viu aquí, i no a
 * ScrollRegistres, perquè el servidor no pot llegir valors d'un fitxer de client.
 */
export const MARCA_ID = "__id__";

export type PropsFila = { fila: FilaLlistat; visibles: Posicio[]; delTitol: Posicio[]; href: string };

/*
 * Les dues files es poden cridar com a funció i per això ja porten la clau: és
 * com les fa servir el servidor. Com a components, cada fila hi era una entrada a
 * part de la càrrega RSC, la taula s'acabava de rebre l'última i sovint encara no
 * hi era quan el navegador començava a hidratar: «Hydration failed».
 */

/** Una fila al telèfon i a la tauleta, on la taula es plega en fitxes. */
export function FilaTargeta({ fila, visibles, delTitol, href }: PropsFila) {
  const [titol, ...resta] = visibles.map(({ i }) => fila["cel·les"][i]);
  // Els telèfons i els correus porten botons, que van al costat i no a dins:
  // la fitxa sencera és un enllaç, i un enllaç dins d'un altre no es pot fer.
  const contactes = resta.filter((valor) => valor.contacte && !valor.buida && teContacte(valor.contacte, valor.text));
  // El client amb marques d'aquesta fitxa, si n'hi ha: el de la mateixa fila o el de la relació.
  const ambMarques = [titol, ...resta].find((valor) => valor.marques);
  return (
    <li key={fila.id} title={fila.visita?.text} className={`flex items-stretch ${fonsDeFila(fila)}`}>
      <EnllacFila href={href} className={`block min-w-0 flex-1 px-4 py-3 transition-shadow ${RESSALT_TARGETA}`}>
        {/* A dalt el nom; a sota, el que va amb ell. */}
        <span className="block truncate text-[14px] font-medium text-ink">
          {titol.buida ? "Sense títol" : titol.text}
        </span>
        {delTitol.length > 0 ? (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <DinsDelTitol cel·les={delTitol.map(({ columna, i }) => ({ ...fila["cel·les"][i], etiqueta: columna.etiqueta }))} />
          </span>
        ) : null}
        {/* Un correu llarg es parteix on calgui: si no, sortiria per sota dels botons. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 [overflow-wrap:anywhere]">
          {resta
            .filter((valor) => !valor.buida)
            .map((valor, i) => (
              <span key={i} className="text-[12px] text-muted">
                {valor.tipus === "area" ? (
                  // Dins la fitxa del telèfon, que és un enllaç, no s'hi poden obrir: es veu el principi.
                  <span className="max-w-[46ch] whitespace-pre-line line-clamp-2">{valor.text}</span>
                ) : valor.tipus === "facturacio" ? (
                  <MiniFacturacio dades={valor.dades ?? {}} compacte />
                ) : valor.tipus === "periodicitat" ? (
                  <MiniSeguiment dades={valor.dades} text={valor.text} compacte />
                ) : valor.tipus === "tria" || valor.tipus === "relacio" || valor.tipus === "booleà" ? (
                  // Al telèfon no hi ha cel·la: el client o el lead es pinta a la seva pastilla.
                  <span
                    title={toDOrigen(valor) ? `${toDOrigen(valor)!.etiqueta}: ${valor.text}` : undefined}
                    className={`rounded px-1.5 py-0.5 ${toDOrigen(valor)?.pastilla ?? TO[valor.text] ?? "bg-parchment text-ink-soft"}`}
                  >
                    {toDOrigen(valor) ? <span className="sr-only">{toDOrigen(valor)!.etiqueta}: </span> : null}
                    {valor.text}
                  </span>
                ) : (
                  valor.text
                )}
              </span>
            ))}
        </span>
      </EnllacFila>
      {contactes.length > 0 || ambMarques ? (
        <div className="flex max-w-[50%] shrink-0 flex-wrap content-center items-center justify-end gap-1.5 py-3 pr-4">
          {ambMarques ? <MarquesClient marques={ambMarques.marques} nom={ambMarques.text} mida="gran" /> : null}
          {contactes.map((valor, i) => (
            <BotonsContacte key={i} mena={valor.contacte!} valor={valor.text} mida="gran" />
          ))}
        </div>
      ) : null}
    </li>
  );
}

/** Una fila de la taula, a partir de tauleta ampla. */
export function FilaTaula({ fila, visibles, delTitol, href }: PropsFila) {
  return (
    <tr key={fila.id} title={fila.visita?.text} className={`group border-b border-line/60 ${fonsDeFila(fila)}`}>
      {visibles.map(({ columna: columnaVisible, i }, posicio) => {
        const valor = fila["cel·les"][i];
        return (
          <td
            key={i}
            className={`${posicio === 0 ? `max-w-[380px] ${RESSALT_PRIMERA}` : `max-w-[220px] ${RESSALT_CELLA}`} ${
              // Les notes van a dues línies i s'obren: retallar-les en una no tindria sentit.
              valor.tipus === "area" ? "min-w-[180px] align-top" : "truncate align-middle"
            } px-3 py-[9px] transition-shadow ${toDOrigen(valor)?.fons ?? ""} ${visibilitat(columnaVisible)}`}
          >
            {posicio === 0 ? (
              // A dalt el nom, que es retalla si no hi cap; a sota, el que va amb ell a caselles fixes.
              <>
                <span className="flex min-w-0 items-center gap-1.5">
                  <EnllacFila
                    href={href}
                    className="block min-w-0 truncate font-medium text-ink underline-offset-2 group-hover:underline"
                  >
                    {valor.buida ? "Sense títol" : valor.text}
                  </EnllacFila>
                  <MarquesClient marques={valor.marques} nom={valor.text} />
                </span>
                {delTitol.length > 0 ? (
                  <span className="mt-1 flex min-w-0 items-center gap-2">
                    {delTitol.map(({ columna, i: posicioCella }) => (
                      <span key={columna.camp} className={`flex min-w-0 shrink-0 ${ampleDelTitol(columna)}`}>
                        <ValorDelTitol valor={{ ...fila["cel·les"][posicioCella], etiqueta: columna.etiqueta }} />
                      </span>
                    ))}
                  </span>
                ) : null}
              </>
            ) : (
              <Cella valor={valor} />
            )}
          </td>
        );
      })}
    </tr>
  );
}
