"use client";

import { type ColumnaLlistat, FILTRES_QUE_EN_TANQUEN, PREFIX_FILTRE, SEPARADOR_FILTRE, menaDeFiltre } from "@/domini/crm-llistat";

import { Multitria, type OpcioTria } from "./Multitria";

/** Els desplegables s'envien sols en canviar; els de text, amb Retorn. */
function enviaElFormulari(element: HTMLSelectElement) {
  element.form?.requestSubmit();
}

const CLASSE = "field-compacte !py-1 !text-[12.5px] w-full min-w-0";

/**
 * El formulari dels filtres. En enviar-se, els camps buits es desactiven
 * perquè no embrutin l'URL amb un paràmetre per columna sense valor.
 */
export function FormulariFiltres({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form
      action="/crm"
      className={className}
      onSubmit={(e) => {
        const formulari = e.currentTarget;
        // El que acaba de tancar un altre filtre (la categoria A, el potencial)
        // no s'envia: si no, aniria a l'URL un filtre que ja no es pot treure.
        for (const regla of FILTRES_QUE_EN_TANQUEN) {
          const origen = formulari.elements.namedItem(`${PREFIX_FILTRE}${regla.camp}`) as HTMLInputElement | null;
          const tancat = formulari.elements.namedItem(`${PREFIX_FILTRE}${regla.tanca}`) as HTMLInputElement | null;
          if (origen?.value === regla.valor && tancat) tancat.disabled = true;
        }
        for (const element of Array.from(formulari.elements)) {
          const camp = element as HTMLInputElement | HTMLSelectElement;
          if (camp.name && camp.value === "") camp.disabled = true;
        }
      }}
    >
      {children}
    </form>
  );
}

/** Les opcions d'una columna que es filtra d'una llista: el catàleg, les de la tria o els valors que hi ha. */
function opcionsDeLaColumna(columna: ColumnaLlistat, mena: ReturnType<typeof menaDeFiltre>): OpcioTria[] | null {
  if (mena === "relacio") return columna.opcions ?? [];
  if (mena === "tria") return columna.definicio?.opcionsDelFiltre ?? columna.definicio?.opcions ?? [];
  if (mena === "text" && columna.suggeriments?.length) return columna.suggeriments.map((text): OpcioTria => [text, text]);
  return null;
}

/**
 * El control de filtre que toca a una columna, o res si no en té. El que es
 * tria d'una llista (estat, tipus, agent, població…) admet més d'un valor i
 * es cerca; la resta (un nom, un import, una data) s'escriu.
 *
 * Tots van amb `key` del valor actual: així, en treure els filtres des d'un
 * enllaç, el control torna a néixer buit en lloc de quedar-se amb el que tenia.
 */
export function FiltreColumna({
  columna,
  valors,
  etiquetat = false,
  tancat = false,
}: {
  columna: ColumnaLlistat;
  /** Els valors triats ara (un o més). */
  valors: string[];
  etiquetat?: boolean;
  /** Un altre filtre el deixa sense sentit: es veu, però no es pot triar. */
  tancat?: boolean;
}) {
  const mena = menaDeFiltre(columna.definicio);
  if (!mena) return null;
  const nom = `${PREFIX_FILTRE}${columna.camp}`;
  const etiqueta = etiquetat ? columna.etiqueta : `Filtra per ${columna.etiqueta.toLowerCase()}`;
  const clau = `${tancat ? "tancat" : "obert"}:${valors.join(SEPARADOR_FILTRE)}`;
  const opcions = opcionsDeLaColumna(columna, mena);
  const valor = valors[0] ?? "";

  const control = opcions ? (
    <Multitria
      key={clau}
      nom={nom}
      etiqueta={etiqueta}
      opcions={opcions}
      valors={tancat ? [] : valors}
      separador={SEPARADOR_FILTRE}
      // A la fila de filtres, «Tots»; a les columnes estretes del títol no hi cap i va un guió, com al telèfon.
      buit={etiquetat || columna.alTitol ? "—" : "Tots"}
      enLinia={etiquetat}
      compacte={!etiquetat && Boolean(columna.alTitol)}
      desactivat={tancat}
      titol={tancat ? "No es pot triar amb el filtre que hi ha posat" : undefined}
    />
  ) : mena === "booleà" ? (
    <select key={clau} name={nom} defaultValue={valor} aria-label={etiqueta} onChange={(e) => enviaElFormulari(e.currentTarget)} className={CLASSE}>
      <option value="">{etiquetat ? "—" : "Tots"}</option>
      <option value="si">Sí</option>
      <option value="no">No</option>
    </select>
  ) : (
    <input
      key={clau}
      type={mena === "nombre" ? "number" : mena === "data" ? "date" : "search"}
      name={nom}
      defaultValue={valor}
      aria-label={etiqueta}
      placeholder={etiquetat ? "" : "Filtra…"}
      {...(mena === "nombre" ? { step: "any" } : {})}
      className={CLASSE}
    />
  );

  if (!etiquetat) return control;
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{columna.etiqueta}</span>
      {control}
    </label>
  );
}

/** L'ordre, com a desplegable, per on no hi ha capçaleres a clicar. */
export function SelectorOrdre({ columnes, valor }: { columnes: ColumnaLlistat[]; valor: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Ordena per</span>
      <select key={valor} name="ordre" defaultValue={valor} onChange={(e) => enviaElFormulari(e.currentTarget)} className={CLASSE}>
        <option value="">Per defecte</option>
        {columnes.map((columna) => (
          <optgroup key={columna.camp} label={columna.etiqueta}>
            <option value={columna.camp}>{columna.etiqueta} ↑</option>
            <option value={`-${columna.camp}`}>{columna.etiqueta} ↓</option>
          </optgroup>
        ))}
      </select>
    </label>
  );
}
