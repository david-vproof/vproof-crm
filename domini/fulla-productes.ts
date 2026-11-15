/**
 * La fulla de productes d'una activitat: el PDF amb els productes presentats,
 * per deixar al client o enviar-li. Aquí hi ha com s'escriu cada dada; qui la
 * reuneix és `serveis/fulla-productes.ts` i qui la dibuixa, `components/pdf/FullaProductes.tsx`.
 *
 * Per a cada producte: la categoria, el nom i el principi actiu amb la foto;
 * l'espècie i el preu sense IVA; la forma farmacèutica i el format; i un espai
 * per a observacions.
 */
import { clauDeValor, nomDeFormat, nomDeTipus } from "./cataleg-articles";

/** El preu d'un producte a la fulla: el de venda sense IVA i, si n'hi ha, el descompte en percentatge. */
export type PreuDeLinia = { preu: number; descompte: number };

/** Un producte tal com surt a la fulla. La foto va a part: és un fitxer, no text. */
export type ProducteDeFulla = {
  id: string;
  nom: string;
  principiActiu: string | null;
  /** La categoria (la família del producte). */
  tipus: string | null;
  especie: string | null;
  /** La forma farmacèutica i, entre parèntesis, la via d'administració. */
  forma: string | null;
  format: string | null;
  /** Preu unitari sense IVA, o null si no n'hi ha. */
  preu: number | null;
  /** El descompte de línia, si el comercial n'hi posa. */
  descompte: number | null;
  /** El que el comercial hi vol dir, a la columna d'observacions. */
  observacions: string | null;
};

/**
 * El que el comercial retoca abans de treure el PDF: un preu posat a mà, un
 * descompte que no és el de l'ERP, o unes observacions. Un camp absent es
 * queda com estava; una cadena buida al preu o al descompte el treu.
 */
export type AjustDeProducte = {
  preu?: string | number | null;
  descompte?: string | number | null;
  observacions?: string | null;
};

/** «9,5» és 9.5; buit o res que no sigui un número, null. */
function numeroDAjust(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined) return null;
  const numero = typeof valor === "number" ? valor : Number(String(valor).trim().replace(",", "."));
  return Number.isFinite(numero) && String(valor).trim() !== "" ? numero : null;
}

export function ambAjust(producte: ProducteDeFulla, ajust: AjustDeProducte | undefined): ProducteDeFulla {
  if (!ajust) return producte;
  const retocat = { ...producte };
  if ("preu" in ajust) retocat.preu = numeroDAjust(ajust.preu);
  if ("descompte" in ajust) {
    const descompte = numeroDAjust(ajust.descompte);
    retocat.descompte = descompte && descompte > 0 ? Math.min(100, descompte) : null;
  }
  if ("observacions" in ajust) retocat.observacions = (ajust.observacions ?? "").trim().slice(0, 400) || null;
  return retocat;
}

/** El que el servei llegeix de cada article per fer-ne la fila. */
export type ArticleDeFulla = {
  id: string;
  nom: string | null;
  familia: string | null;
  garantia: string | null;
  camp_programable_1: string | null;
  camp_programable_2: string | null;
  camp_programable_3: string | null;
  camp_programable_4: string | null;
  camp_programable_5: string | null;
};

/** «Comprimit (oral)»: la forma i, entre parèntesis, la via. Si només n'hi ha una, aquella. */
export function formaDeFulla(forma: string | null, via: string | null) {
  const f = (forma ?? "").trim();
  const v = (via ?? "").trim();
  if (f && v && clauDeValor(f) !== clauDeValor(v)) return `${f} (${v.toLocaleLowerCase("ca")})`;
  return f || v || null;
}

export function producteDeFulla(article: ArticleDeFulla, preu: PreuDeLinia | null): ProducteDeFulla {
  return {
    id: article.id,
    nom: (article.nom ?? "").trim() || "Sense nom",
    principiActiu: (article.garantia ?? "").trim() || null,
    tipus: nomDeTipus(article.familia),
    especie: (article.camp_programable_1 ?? "").trim() || null,
    forma: formaDeFulla(article.camp_programable_2, article.camp_programable_3),
    format: nomDeFormat(article.camp_programable_5),
    preu: preu?.preu ?? null,
    descompte: preu?.descompte || null,
    observacions: null,
  };
}

const DECIMALS = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * «9,90€ (-5% descompte)». El preu i el descompte són els de la línia
 * d'albarà que faria l'ERP: el descompte s'escriu al costat i no es resta.
 * L'euro va enganxat al número, com a la fulla de l'empresa.
 */
export function preuDeFulla(preu: number | null, descompte: number | null) {
  if (preu === null) return null;
  const base = `${DECIMALS.format(preu)}€`;
  return descompte ? `${base} (-${String(descompte).replace(".", ",")}% descompte)` : base;
}

// -------------------------------------------------------------------- ordre

/**
 * En quin ordre van els productes a la fulla: per categoria (el
 * predeterminat), alfabètic, i dins d'una categoria per preu de més barat a
 * més car; o tal com s'han triat. El valor «color» és el de sempre: les
 * plantilles i els enllaços desats el porten.
 */
export type OrdreDeFulla = "triat" | "color";

export const ORDRES_DE_FULLA: { valor: OrdreDeFulla; etiqueta: string }[] = [
  { valor: "color", etiqueta: "Per categoria i preu" },
  { valor: "triat", etiqueta: "Com s'han triat" },
];

/** L'ordre tal com arriba d'un paràmetre o d'un JSON: si no és cap dels coneguts, per categoria i preu. */
export function llegeixOrdre(brut: unknown): OrdreDeFulla {
  return ORDRES_DE_FULLA.some((ordre) => ordre.valor === brut) ? (brut as OrdreDeFulla) : "color";
}

/** De menys a més; sense preu, al final. */
const perPreu = (a: { preu: number | null }, b: { preu: number | null }) => {
  if (a.preu === null) return b.preu === null ? 0 : 1;
  if (b.preu === null) return -1;
  return a.preu - b.preu;
};

/** La categoria per ordenar: sense accents ni majúscules, i les que no en tenen, al final. */
const clauDeCategoria = (tipus: string | null) => (tipus ? clauDeValor(tipus) : "\uffff");

/**
 * Els productes en l'ordre demanat: primer la categoria i, dins d'una mateixa
 * categoria, el preu. Si empaten (o no hi ha preus) es queden tal com s'han
 * triat: l'ordenació és estable.
 */
export function ordenaProductes<T extends Pick<ProducteDeFulla, "tipus" | "preu">>(productes: T[], ordre: OrdreDeFulla): T[] {
  if (ordre === "triat") return productes;
  return [...productes].sort((a, b) => clauDeCategoria(a.tipus).localeCompare(clauDeCategoria(b.tipus), "ca") || perPreu(a, b));
}

// ------------------------------------------------------------------ contacte

/** Com localitzar qui treu la fulla: va al peu de cada pàgina. */
export type ContacteDeFulla = { correu: string; telefon: string | null };

/**
 * El de l'empresa, per quan no se sap qui treu la fulla o no se li ha pogut
 * llegir el seu. Buit: el peu llavors només porta la marca.
 */
export const CONTACTE_EMPRESA: ContacteDeFulla = { correu: "", telefon: null };

/** El correu i el telèfon, en aquest ordre. El que no hi és, no hi surt. */
export function liniaDeContacte({ correu, telefon }: ContacteDeFulla) {
  return [correu, telefon].filter(Boolean).join("     ");
}

/** El nom del fitxer: «Productes presentats · Can Josep · 2026-09-28.pdf», sense caràcters que els sistemes no volen. */
export function nomDelFitxer(client: string | null, data: string | null) {
  const net = (text: string) => text.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${["Productes presentats", client ? net(client) : null, data?.slice(0, 10) ?? null].filter(Boolean).join(" · ")}.pdf`;
}
