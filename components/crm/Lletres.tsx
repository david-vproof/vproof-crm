import { esLletra, type Lletra } from "@/domini/crm-fitxes";

/** Un to per lletra, d'A (verd) a E (vermell): el mateix semàfor que a la base de dades. */
export const TO_LLETRA: Record<Lletra, string> = {
  A: "bg-emerald-50 text-emerald-700",
  B: "bg-sky-50 text-sky-700",
  C: "bg-amber-50 text-amber-700",
  D: "bg-orange-50 text-orange-700",
  E: "bg-marca-clar text-marca-fosc",
};

/** Els dos camps que van amb l'escala, en l'ordre en què es llegeixen: primer la categoria, després el potencial. */
const QUE = { categoria: "Categoria", potencial: "Potencial" } as const;
type Que = keyof typeof QUE;

const MARCA = "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11.5px] font-semibold";

/** Una lletra com a marca de color. Sense valor, un guionet apagat que en guarda el lloc. */
function Marca({ que, valor }: { que: Que; valor: unknown }) {
  if (!esLletra(valor)) {
    return (
      <span className={`${MARCA} bg-parchment text-muted`} title={`Sense ${QUE[que].toLowerCase()}`}>
        <span className="sr-only">Sense {QUE[que].toLowerCase()}</span>–
      </span>
    );
  }
  return (
    <span className={`${MARCA} ${TO_LLETRA[valor]}`} title={`${QUE[que]} ${valor}`}>
      <span className="sr-only">{QUE[que]} </span>
      {valor}
    </span>
  );
}

/**
 * Les dues lletres d'un compte al costat del nom, a les llistes: primer la
 * categoria (la calcula el portal amb la facturació) i després el potencial
 * (el posa qui porta el compte). Es llegeixen per posició, així que quan una
 * falta hi queda un guionet i l'altra no es mou. Sense cap de les dues, res.
 */
export function Lletres({ categoria, potencial }: { categoria: unknown; potencial: unknown }) {
  if (!esLletra(categoria) && !esLletra(potencial)) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <Marca que="categoria" valor={categoria} />
      <Marca que="potencial" valor={potencial} />
    </span>
  );
}

/**
 * Una de les dues lletres d'un compte, per a la capçalera de la fitxa. Hi és
 * sempre: quan falta, ho diu, perquè un buit no s'entendria com a «pendent de posar».
 */
export function EtiquetaLletra({ que, valor }: { que: Que; valor: unknown }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium";

  if (!esLletra(valor)) {
    return <span className={`${base} bg-parchment text-muted`}>Sense {QUE[que].toLowerCase()}</span>;
  }

  return (
    <span className={`${base} ${TO_LLETRA[valor]}`} title={`${QUE[que]} ${valor}`}>
      <span className="text-[10.5px] font-normal uppercase tracking-[0.08em] opacity-80">{QUE[que]}</span>
      <span className="text-[13px] font-semibold leading-none">{valor}</span>
    </span>
  );
}
