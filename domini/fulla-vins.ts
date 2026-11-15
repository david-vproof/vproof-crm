/**
 * La fulla de vins d'una activitat: el PDF amb els vins presentats o tastats,
 * per deixar al client o enviar-li. Aquí hi ha com s'escriu cada dada; qui la
 * reuneix és `serveis/fulla-vins.ts` i qui la dibuixa, `components/pdf/FullaVins.tsx`.
 *
 * Segueix la fulla de la bodega: per a cada vi, el tipus, el nom i les
 * varietats amb la foto; l'anyada i el preu sense IVA; la zona i el volum; i un
 * espai per a observacions.
 */
import { clauDeValor, nomDeFormat, nomDeTipus } from "./cataleg-articles";
/** El preu d'un vi a la fulla: el de venda sense IVA i, si n'hi ha, el descompte en percentatge. */
export type PreuDeLinia = { preu: number; descompte: number };

/** Un vi tal com surt a la fulla. La foto va a part: és un fitxer, no text. */
export type ViDeFulla = {
  id: string;
  nom: string;
  varietat: string | null;
  tipus: string | null;
  anyada: string | null;
  zona: string | null;
  volum: string | null;
  /** Preu unitari sense IVA que FactuSol posaria per a aquest client, o null si no n'hi ha. */
  preu: number | null;
  /** El descompte de línia que hi aplicaria: el del client o el seu especial per a aquest vi. */
  descompte: number | null;
  /** El que el comercial hi vol dir, a la columna d'observacions. */
  observacions: string | null;
};

/**
 * El que el comercial retoca abans de treure el PDF: un preu posat a mà, un
 * descompte que no és el de FactuSol, o unes observacions. Un camp absent es
 * queda com estava; una cadena buida al preu o al descompte el treu.
 */
export type AjustDeVi = {
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

export function ambAjust(vi: ViDeFulla, ajust: AjustDeVi | undefined): ViDeFulla {
  if (!ajust) return vi;
  const retocat = { ...vi };
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
  camp_programable_2: string | null;
  camp_programable_3: string | null;
  camp_programable_4: string | null;
  camp_programable_5: string | null;
};

/** «Vallée du Rhône (França)»: la zona i, entre parèntesis, la regió o el país. Si només n'hi ha una, aquella. */
export function zonaDeFulla(zona: string | null, regio: string | null) {
  const z = (zona ?? "").trim();
  const r = (regio ?? "").trim();
  if (z && r && clauDeValor(z) !== clauDeValor(r)) return `${z} (${r})`;
  return z || r || null;
}

/** «VIAMIC ETERN ECO 2025» amb anyada 2025: a la fulla el nom va sense l'any, que ja surt a la seva casella. */
export function nomSenseAnyada(nom: string, anyada: string | null) {
  const any = (anyada ?? "").trim();
  if (!any || !/^\d{4}$/.test(any)) return nom;
  return nom.replace(new RegExp(`[\\s(]*${any}[)\\s]*$`), "").trim() || nom;
}

export function viDeFulla(article: ArticleDeFulla, preu: PreuDeLinia | null): ViDeFulla {
  const anyada = (article.camp_programable_2 ?? "").trim() || null;
  return {
    id: article.id,
    nom: nomSenseAnyada((article.nom ?? "").trim() || "Sense nom", anyada),
    varietat: (article.garantia ?? "").trim() || null,
    tipus: nomDeTipus(article.familia),
    anyada,
    zona: zonaDeFulla(article.camp_programable_3, article.camp_programable_4),
    volum: nomDeFormat(article.camp_programable_5),
    preu: preu?.preu ?? null,
    descompte: preu?.descompte || null,
    observacions: null,
  };
}

const DECIMALS = new Intl.NumberFormat("ca-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * «9,90€ (-5% descompte)». El preu i el descompte són els de la línia
 * d'albarà que faria FactuSol: el descompte s'escriu al costat i no es resta.
 * L'euro va enganxat al número, com a la fulla de la bodega.
 */
export function preuDeFulla(preu: number | null, descompte: number | null) {
  if (preu === null) return null;
  const base = `${DECIMALS.format(preu)}€`;
  return descompte ? `${base} (-${String(descompte).replace(".", ",")}% descompte)` : base;
}

/**
 * El quadrat de cada tipus de vi, amb els colors de la fulla de la bodega:
 * groc pàl·lid per als blancs, taronja per als orange, vermell per als vermells
 * i rosats, i granat per als negres. Els escumosos porten una E dins del
 * quadrat del seu color. Els altres (oxidatius, dolços, vermuts, sidres…) no
 * en porten cap: només el nom del tipus.
 */
export function quadratDeTipus(tipus: string | null): { color: string; lletra: string | null } | null {
  const clau = clauDeValor(tipus ?? "");
  const lletra = clau.startsWith("esc") ? "E" : null;
  if (clau.includes("orange")) return { color: "#F9C06F", lletra };
  if (clau.includes("rosat") || clau.includes("vermell")) return { color: "#D53050", lletra };
  if (clau.includes("blanc")) return { color: "#F8F7C9", lletra };
  if (clau.includes("negre")) return { color: "#832A48", lletra };
  // «ESCUMOS» a seques: escumós blanc.
  if (lletra) return { color: "#F8F7C9", lletra };
  return null;
}

// -------------------------------------------------------------------- ordre

/**
 * En quin ordre van els vins a la fulla: com la fulla de la bodega (el
 * predeterminat), primer per color (els escumosos i després els tranquils,
 * cada grup de blanc a negre) i, dins d'un color, per preu de més barat a més
 * car; o tal com s'han triat.
 */
export type OrdreDeFulla = "triat" | "color";

export const ORDRES_DE_FULLA: { valor: OrdreDeFulla; etiqueta: string }[] = [
  { valor: "color", etiqueta: "Per color i preu" },
  { valor: "triat", etiqueta: "Com s'han triat" },
];

/** L'ordre tal com arriba d'un paràmetre o d'un JSON: si no és cap dels coneguts, per color i preu. */
export function llegeixOrdre(brut: unknown): OrdreDeFulla {
  return ORDRES_DE_FULLA.some((ordre) => ordre.valor === brut) ? (brut as OrdreDeFulla) : "color";
}

/** Els colors en l'ordre de la fulla. «ESC. ROSAT/VERMELL» és rosat: mana el primer color que s'hi llegeix. */
const COLORS = ["blanc", "orange", "rosat", "vermell", "negre"];

/**
 * La posició del tipus en l'ordre de colors: els escumosos (blanc, orange,
 * rosat, vermell, negre) i després els tranquils en el mateix ordre. Un
 * «ESCUMOS» a seques és escumós blanc, com al quadrat. Els que no són cap
 * color (dolços, oxidatius, vermuts, sidres…) van al final.
 */
export function rangDeColor(tipus: string | null) {
  const clau = clauDeValor(tipus ?? "");
  const escumos = clau.startsWith("esc");
  const color = COLORS.findIndex((c) => clau.includes(c));
  if (escumos) return Math.max(color, 0);
  return color === -1 ? 2 * COLORS.length : COLORS.length + color;
}

/** De menys a més; sense preu, al final. */
const perPreu = (a: { preu: number | null }, b: { preu: number | null }) => {
  if (a.preu === null) return b.preu === null ? 0 : 1;
  if (b.preu === null) return -1;
  return a.preu - b.preu;
};

/**
 * Els vins en l'ordre demanat: primer el color i, dins d'un mateix color, el
 * preu. Si empaten (o no hi ha preus) es queden tal com s'han triat:
 * l'ordenació és estable.
 */
export function ordenaVins<T extends Pick<ViDeFulla, "tipus" | "preu">>(vins: T[], ordre: OrdreDeFulla): T[] {
  if (ordre === "triat") return vins;
  return [...vins].sort((a, b) => rangDeColor(a.tipus) - rangDeColor(b.tipus) || perPreu(a, b));
}

// ------------------------------------------------------------------ contacte

/** Com localitzar qui treu la fulla: va al peu de cada pàgina. */
export type ContacteDeFulla = { correu: string; telefon: string | null };

/** El de la bodega, per quan no se sap qui treu la fulla o no se li ha pogut llegir el seu. */
export const CONTACTE_BODEGA: ContacteDeFulla = { correu: "jaume@jaumejorda.com", telefon: "+34 629 766 72" };

const WEB_DE_FULLA = "www.jaumejorda.com";

/** El correu, la web i el telèfon, en aquest ordre, com a la fulla de la bodega. Sense telèfon, no hi surt. */
export function liniaDeContacte({ correu, telefon }: ContacteDeFulla) {
  return [correu, WEB_DE_FULLA, telefon].filter(Boolean).join("     ");
}

/** El nom del fitxer: «Vins tastats · Can Josep · 2026-09-28.pdf», sense caràcters que els sistemes no volen. */
export function nomDelFitxer(client: string | null, data: string | null) {
  const net = (text: string) => text.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `${["Vins tastats", client ? net(client) : null, data?.slice(0, 10) ?? null].filter(Boolean).join(" · ")}.pdf`;
}
