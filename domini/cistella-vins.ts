/**
 * El configurador de vins: una cistella que s'omple del catàleg amb criteris
 * de selecció, i que es pot desar com a plantilla. Lògica pura, sense
 * Directus: el navegador té tot el catàleg actiu (uns centenars de vins) i
 * aquí es filtra, es compten les opcions i es porta la cistella.
 *
 * Els criteris són les mateixes característiques del catàleg d'articles
 * (`CARACTERISTIQUES` de `domini/cataleg-articles.ts`: tipus, varietat,
 * productor, anyada, regió, zona, format i proveïdor), però aquí cada una
 * admet més d'un valor: «negre o blanc», «2021 o 2022». Dins d'una mateixa
 * característica els valors s'uneixen (O); entre característiques, es
 * creuen (I).
 */
import { CARACTERISTIQUES, clauDeValor, type ArticleDeCataleg, type Opcio } from "@/domini/cataleg-articles";

/** Un vi tal com el té el configurador: amb els valors de cada característica ja extrets. */
export type ViDeCataleg = {
  id: string;
  nom: string;
  codi: string | null;
  /** D'on és: celler i tipus, com al selector de vins de les activitats. */
  detall: string;
  foto: string | null;
  /** Descatalogat o no disponible a FactuSol: ja no es ven. Quan surt, ho diu `viVisible`. */
  historic: boolean;
  /** Per clau de característica, els valors del vi: una varietat pot ser-ne més d'una. */
  caracteristiques: Record<string, string[]>;
};

/** El que s'ha triat per filtrar: la cerca, «només amb foto», «amb els històrics» i, per característica, els valors que valen. */
export type CriterisVins = {
  cerca: string;
  ambFoto: boolean;
  /** Si tots els vins històrics (que ja no es venen) també hi entren. Per defecte, només els dels clients triats: vegeu `viVisible`. */
  ambHistorics: boolean;
  tria: Record<string, string[]>;
};

export const CRITERIS_BUITS: CriterisVins = { cerca: "", ambFoto: false, ambHistorics: false, tria: {} };

/** Una línia de la cistella: un vi. Només es marca quin: la cistella no porta quantitats. */
export type LiniaCistella = { vi: ViDeCataleg };

/** Quants vins pot portar una plantilla. */
export const MAXIM_VINS_PER_PLANTILLA = 200;

/** Quants vins pot portar una activitat. Més que això és un error de clic, no una visita. */
export const MAXIM_VINS_PER_ACTIVITAT = 60;

const un = (valor: string | null | undefined) => {
  const net = (valor ?? "").trim();
  return net ? [net] : [];
};

/** Del catàleg al configurador: s'extreuen les característiques una vegada i prou. */
export function viDeCataleg(article: ArticleDeCataleg, foto: string | null): ViDeCataleg {
  const caracteristiques: Record<string, string[]> = {};
  for (const caracteristica of CARACTERISTIQUES) caracteristiques[caracteristica.clau] = caracteristica.valors(article);
  return {
    id: article.id,
    nom: article.nom?.trim() || "Sense nom",
    codi: article.codi_erp,
    detall: [article.celler?.nom_comercial, ...un(caracteristiques.tipus?.[0])]
      .map((tros) => (tros ?? "").trim())
      .filter(Boolean)
      .join(" · "),
    foto,
    historic: article.historic === true,
    caracteristiques,
  };
}

/** On es busca el text de la cerca: el nom, el codi i totes les característiques. */
function textDeCerca(vi: ViDeCataleg) {
  return clauDeValor([vi.nom, vi.codi, ...Object.values(vi.caracteristiques).flat()].filter(Boolean).join(" "));
}

/** Si el vi passa els criteris. `excepte` en deixa un de banda: és com es compten les opcions d'aquell. */
export function passaCriteris(vi: ViDeCataleg, criteris: CriterisVins, excepte?: string) {
  if (criteris.ambFoto && !vi.foto) return false;
  if (criteris.cerca.trim()) {
    const text = textDeCerca(vi);
    if (!clauDeValor(criteris.cerca).split(" ").every((mot) => text.includes(mot))) return false;
  }
  return CARACTERISTIQUES.every((caracteristica) => {
    const triats = criteris.tria[caracteristica.clau] ?? [];
    if (triats.length === 0 || caracteristica.clau === excepte) return true;
    const claus = new Set(triats.map(clauDeValor));
    return (vi.caracteristiques[caracteristica.clau] ?? []).some((valor) => claus.has(clauDeValor(valor)));
  });
}

export function filtraVins(vins: ViDeCataleg[], criteris: CriterisVins): ViDeCataleg[] {
  return vins.filter((vi) => passaCriteris(vi, criteris)).sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
}

/**
 * Les opcions de cada característica amb quants vins hi quedarien: es compten
 * amb els altres criteris posats però no el mateix, perquè marcar «negre» no
 * amagui «blanc». Els valors escrits diferent (majúscules, accents) van junts.
 */
export function opcionsDeCriteris(vins: ViDeCataleg[], criteris: CriterisVins): Record<string, Opcio[]> {
  const resultat: Record<string, Opcio[]> = {};
  for (const caracteristica of CARACTERISTIQUES) {
    const perClau = new Map<string, { formes: Map<string, number>; quants: number }>();
    for (const vi of vins) {
      if (!passaCriteris(vi, criteris, caracteristica.clau)) continue;
      const vistes = new Set<string>();
      for (const valor of vi.caracteristiques[caracteristica.clau] ?? []) {
        const clau = clauDeValor(valor);
        if (vistes.has(clau)) continue;
        vistes.add(clau);
        const grup = perClau.get(clau) ?? { formes: new Map<string, number>(), quants: 0 };
        grup.formes.set(valor, (grup.formes.get(valor) ?? 0) + 1);
        grup.quants += 1;
        perClau.set(clau, grup);
      }
    }
    const opcions = [...perClau.values()].map(({ formes, quants }) => ({
      valor: [...formes.entries()].sort((a, b) => b[1] - a[1])[0][0],
      quants,
    }));
    // Un valor triat hi ha de ser encara que ara no en quedi cap: si no, no es podria desmarcar.
    for (const triat of criteris.tria[caracteristica.clau] ?? []) {
      if (!opcions.some((opcio) => clauDeValor(opcio.valor) === clauDeValor(triat))) opcions.push({ valor: triat, quants: 0 });
    }
    resultat[caracteristica.clau] = opcions.sort((a, b) =>
      caracteristica.ordre === "desc" ? b.valor.localeCompare(a.valor, "ca", { numeric: true }) : a.valor.localeCompare(b.valor, "ca"),
    );
  }
  return resultat;
}

/** Si el valor és entre els triats d'una característica, sense mirar majúscules ni accents. */
export function esTriat(criteris: CriterisVins, clau: string, valor: string) {
  return (criteris.tria[clau] ?? []).some((triat) => clauDeValor(triat) === clauDeValor(valor));
}

/** Marca o desmarca un valor d'una característica. */
export function commutaValor(criteris: CriterisVins, clau: string, valor: string): CriterisVins {
  const ara = criteris.tria[clau] ?? [];
  const nous = esTriat(criteris, clau, valor) ? ara.filter((triat) => clauDeValor(triat) !== clauDeValor(valor)) : [...ara, valor];
  const tria = { ...criteris.tria };
  if (nous.length === 0) delete tria[clau];
  else tria[clau] = nous;
  return { ...criteris, tria };
}

/** Quants criteris hi ha posats, per al botó del telèfon: cada valor marcat compta. */
export function quantsCriteris(criteris: CriterisVins) {
  return (
    Object.values(criteris.tria).reduce((suma, valors) => suma + valors.length, 0) + (criteris.ambFoto ? 1 : 0) + (criteris.ambHistorics ? 1 : 0)
  );
}

/** Els criteris tal com arriben d'una plantilla desada (JSON de Directus): només el que té sentit. */
export function llegeixCriteris(brut: unknown): CriterisVins {
  if (!brut || typeof brut !== "object") return CRITERIS_BUITS;
  const cos = brut as Partial<Record<keyof CriterisVins, unknown>>;
  const tria: Record<string, string[]> = {};
  const claus = new Set(CARACTERISTIQUES.map((c) => c.clau));
  if (cos.tria && typeof cos.tria === "object") {
    for (const [clau, valors] of Object.entries(cos.tria as Record<string, unknown>)) {
      if (!claus.has(clau) || !Array.isArray(valors)) continue;
      const nets = valors.filter((valor): valor is string => typeof valor === "string" && valor.trim() !== "");
      if (nets.length > 0) tria[clau] = nets;
    }
  }
  return { cerca: typeof cos.cerca === "string" ? cos.cerca : "", ambFoto: cos.ambFoto === true, ambHistorics: cos.ambHistorics === true, tria };
}

// ----------------------------------------------------------------- cistella

/** Afegeix un vi a la cistella. Si ja hi és, no passa res. */
export function afegeixALaCistella(linies: LiniaCistella[], vi: ViDeCataleg): LiniaCistella[] {
  if (linies.some((linia) => linia.vi.id === vi.id)) return linies;
  return [...linies, { vi }];
}

export function treuDeLaCistella(linies: LiniaCistella[], id: string): LiniaCistella[] {
  return linies.filter((linia) => linia.vi.id !== id);
}

// --------------------------------------------------------------- plantilles

/** Una plantilla a la llista: el nom, qui la va fer i què hi ha. */
export type ResumPlantilla = {
  id: string;
  nom: string;
  descripcio: string;
  qui: string | null;
  creat: string | null;
  modificat: string | null;
  vins: number;
};

/** Una plantilla sencera: els criteris i les línies, en ordre. */
export type Plantilla = ResumPlantilla & {
  criteris: CriterisVins;
  linies: { article: string | null; nom: string | null }[];
};

/** Les línies tal com es desen a una plantilla: l'article i l'ordre. */
export type LiniaPlantilla = { article: string; ordre: number };

export function liniesPerDesar(linies: LiniaCistella[]): LiniaPlantilla[] {
  return linies.map((linia, ordre) => ({ article: linia.vi.id, ordre }));
}

/**
 * La cistella a partir d'una plantilla desada, amb els vins del catàleg
 * d'ara. Els que ja no hi són (descatalogats des que es va desar) queden a
 * part, amb el nom, per dir-ho.
 */
export function cistellaDePlantilla(
  linies: { article: string | null; nom?: string | null }[],
  cataleg: ViDeCataleg[],
): { linies: LiniaCistella[]; perduts: string[] } {
  const perId = new Map(cataleg.map((vi) => [vi.id, vi]));
  const resultat: LiniaCistella[] = [];
  const perduts: string[] = [];
  for (const linia of linies) {
    const vi = linia.article ? perId.get(linia.article) : undefined;
    if (!vi) {
      perduts.push(linia.nom?.trim() || "un vi sense nom");
      continue;
    }
    if (resultat.some((posada) => posada.vi.id === vi.id)) continue;
    resultat.push({ vi });
  }
  return { linies: resultat, perduts };
}

/** El nom d'una plantilla, net i amb un límit raonable. */
export function netejaNomDePlantilla(brut: unknown) {
  return String(brut ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

// ------------------------------------------------------- tastos i compres

/**
 * Qui es tria al selector per saber què ja ha tastat: un client o un lead. Un
 * lead ho porta marcat perquè encara no és a FactuSol: no té albarans ni
 * tarifa pròpia.
 */
export type ClientOLead = { id: string; text: string; lead?: boolean };

/** Un client (o lead) dels triats que ja ha tastat (o comprat) un vi, i quan va ser la darrera vegada. */
export type Tast = { client: string; nom: string; data: string | null };

/** Per vi (id d'article), els clients triats que l'han tastat (o comprat). */
export type Tastos = Record<string, Tast[]>;

/** Una compra: com un tast, amb les ampolles que n'ha comprat en total. */
export type Compra = Tast & { ampolles: number };
export type Compres = Record<string, Compra[]>;

/**
 * Un criteri que es mira respecte als clients triats (tastat, comprat): tots
 * els vins, només els que cap d'ells ha tastat, o els que n'ha tastat algun.
 * No hi ha «que han tastat tots»: no es vol cap I entre clients.
 */
export type FiltrePerClients = "tots" | "cap" | "algun";

/** Les opcions del criteri, amb el text per a diversos clients i per a un de sol (null: no surt). */
export type OpcioPerClients = { valor: FiltrePerClients; etiqueta: string; ambUn: string | null };

export const FILTRES_TAST: OpcioPerClients[] = [
  { valor: "tots", etiqueta: "Tant si l'han tastat com si no", ambUn: "Tant si l'ha tastat com si no" },
  { valor: "cap", etiqueta: "Que no ha tastat cap", ambUn: "Que no ha tastat" },
  { valor: "algun", etiqueta: "Que n'ha tastat algun", ambUn: "Que ja ha tastat" },
];

export const FILTRES_COMPRA: OpcioPerClients[] = [
  { valor: "tots", etiqueta: "Tant si l'han comprat com si no", ambUn: "Tant si l'ha comprat com si no" },
  { valor: "cap", etiqueta: "Que no ha comprat cap", ambUn: "Que no ha comprat" },
  { valor: "algun", etiqueta: "Que n'ha comprat algun", ambUn: "Que ja ha comprat" },
];

/** Si el vi passa un criteri per clients. Sense clients, no filtra. */
export function passaFiltrePerClients(vi: ViDeCataleg, perVi: Record<string, unknown[]>, quantsClients: number, filtre: FiltrePerClients) {
  if (quantsClients === 0 || filtre === "tots") return true;
  const quants = perVi[vi.id]?.length ?? 0;
  return filtre === "cap" ? quants === 0 : quants > 0;
}

/**
 * Si un vi es pot ensenyar. Un històric, que ja no es ven, només si es demanen
 * els històrics o si algun dels clients triats ja l'ha tastat o comprat: és el
 * que té sentit tornar a mirar amb aquell client. Els tastos i les compres només
 * porten els dels clients triats, així que sense clients no en surt cap.
 */
export function viVisible(vi: ViDeCataleg, ambHistorics: boolean, tastos: Tastos, compres: Compres) {
  return !vi.historic || ambHistorics || (tastos[vi.id]?.length ?? 0) > 0 || (compres[vi.id]?.length ?? 0) > 0;
}

/** Què dir d'un vi: quins dels clients triats l'han tastat (o comprat), per nom. Null si cap. */
export function resumPerClients<T extends Tast>(vi: ViDeCataleg, perVi: Record<string, T[]>, quantsClients: number): { qui: T[] } | null {
  const qui = perVi[vi.id] ?? [];
  if (quantsClients === 0 || qui.length === 0) return null;
  return { qui: [...qui].sort((a, b) => a.nom.localeCompare(b.nom, "ca")) };
}
