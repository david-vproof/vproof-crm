/**
 * El catàleg de productes: com es filtra i què se n'ensenya. Lògica pura: la
 * pantalla porta tots els productes actius d'un cop (uns centenars) i aquí es
 * filtren, es compten i es paginen.
 *
 * Les característiques d'un producte sanitari veterinari són camps de la fitxa
 * d'article (`crm_articles`): la família és la categoria (antiparasitari,
 * antibiòtic, vacuna…), la «garantia» és el principi actiu, i els cinc camps
 * programables són l'espècie de destí, la forma farmacèutica, la via
 * d'administració, la prescripció i el format. Si l'ERP els fa servir d'una
 * altra manera, només cal tocar `CARACTERISTIQUES` i `CAMPS_DEL_PRODUCTE`.
 */

/** El que el catàleg necessita de cada article. `FitxaArticle` de `serveis/articles.ts` hi encaixa. */
export type ArticleDeCataleg = {
  id: string;
  codi_erp: string | null;
  nom: string | null;
  familia: string | null;
  garantia: string | null;
  codi_barres: string | null;
  imatge: string | null;
  camp_programable_1: string | null;
  camp_programable_2: string | null;
  camp_programable_3: string | null;
  camp_programable_4: string | null;
  camp_programable_5: string | null;
  laboratori: { id: string; nom_comercial: string | null } | null;
  /** Descatalogat o no disponible. Sense el camp, es considera actiu. */
  historic?: boolean;
};

/** Per comparar: sense majúscules, accents ni espais de sobres. «Amoxicil·lina» i «amoxicil·lina» són el mateix. */
export function clauDeValor(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** «ANTIPARASITARI EXTERN» → «Antiparasitari extern». La família pot arribar en majúscules de l'ERP. */
export function nomDeTipus(valor: string | null) {
  const net = (valor ?? "").trim();
  if (!net) return null;
  const minuscules = net.toLocaleLowerCase("ca");
  return minuscules.charAt(0).toLocaleUpperCase("ca") + minuscules.slice(1);
}

/** «100ml», «100 ML» i «100 ml» són el mateix: «100 ml». Els litres, amb L majúscula: «1,5 L»; els quilos, «kg». */
export function nomDeFormat(valor: string | null) {
  const net = (valor ?? "").trim();
  if (!net) return null;
  const mida = /^(\d+(?:[.,]\d+)?)\s*(ml|cl|l|mg|g|kg|u|ut|uts|unitats|comprimits|comp)\.?$/i.exec(net);
  if (!mida) return net;
  const brut = mida[2].toLowerCase();
  const unitat = brut === "l" ? "L" : ["u", "ut", "uts"].includes(brut) ? "u." : brut === "comp" ? "comprimits" : brut;
  return `${mida[1].replace(".", ",")} ${unitat}`;
}

/**
 * Un camp amb diversos valors: els principis actius o les espècies d'un
 * producte. Van en un sol camp i de moltes maneres («Amoxicil·lina, àcid
 * clavulànic», «Gos i gat», «Boví/Oví»): es trossegen perquè el filtre trobi
 * el producte per qualsevol d'ells.
 */
export function valorsMultiples(valor: string | null): string[] {
  const net = (valor ?? "").trim();
  if (!net) return [];
  return net
    .split(/\s*(?:,|\/|;|\+|&|\s+i\s+|\s+y\s+|\s+and\s+|\s+-\s+)\s*/i)
    // «20% amoxicil·lina» és amoxicil·lina; els parèntesis d'una llista partida no hi diuen res.
    .map((tros) => tros.replace(/^\d+(?:[.,]\d+)?\s*%\s*/, "").replace(/[()]/g, "").replace(/\.$/, "").trim())
    .filter(Boolean)
    .map((tros) => tros.charAt(0).toLocaleUpperCase("ca") + tros.slice(1));
}

/** Una característica per la qual es pot filtrar, i com se'n treuen els valors de cada article. */
export type Caracteristica = {
  clau: string;
  etiqueta: string;
  valors: (article: ArticleDeCataleg) => string[];
  /** De més a menys en comptes d'alfabètic. */
  ordre?: "desc";
};

const un = (valor: string | null | undefined) => {
  const net = (valor ?? "").trim();
  return net ? [net] : [];
};

/** Què hi ha a cada camp de la fitxa del producte, per als formularis i les fitxes. */
export const CAMPS_DEL_PRODUCTE = {
  familia: "Categoria",
  garantia: "Principi actiu",
  camp_programable_1: "Espècie",
  camp_programable_2: "Forma farmacèutica",
  camp_programable_3: "Via d'administració",
  camp_programable_4: "Prescripció",
  camp_programable_5: "Format",
} as const;

export const CARACTERISTIQUES: Caracteristica[] = [
  { clau: "tipus", etiqueta: CAMPS_DEL_PRODUCTE.familia, valors: (a) => un(nomDeTipus(a.familia)) },
  { clau: "principi_actiu", etiqueta: CAMPS_DEL_PRODUCTE.garantia, valors: (a) => valorsMultiples(a.garantia) },
  { clau: "especie", etiqueta: CAMPS_DEL_PRODUCTE.camp_programable_1, valors: (a) => valorsMultiples(a.camp_programable_1) },
  { clau: "forma", etiqueta: CAMPS_DEL_PRODUCTE.camp_programable_2, valors: (a) => un(a.camp_programable_2) },
  { clau: "via", etiqueta: CAMPS_DEL_PRODUCTE.camp_programable_3, valors: (a) => un(a.camp_programable_3) },
  { clau: "prescripcio", etiqueta: CAMPS_DEL_PRODUCTE.camp_programable_4, valors: (a) => un(a.camp_programable_4) },
  { clau: "format", etiqueta: CAMPS_DEL_PRODUCTE.camp_programable_5, valors: (a) => un(nomDeFormat(a.camp_programable_5)) },
  { clau: "laboratori", etiqueta: "Laboratori", valors: (a) => un(a.laboratori?.nom_comercial) },
];

/** El que s'ha triat: per a cada característica, un valor (tal com surt al desplegable). */
export type FiltresArticles = {
  cerca: string;
  ambFoto: boolean;
  /** Si també s'ensenyen els històrics (descatalogats o no disponibles). Per defecte, no. */
  ambHistorics: boolean;
  tria: Record<string, string>;
  /** L'ordre del llistat tal com va a l'URL («-format»). No és un filtre, però viatja amb ells perquè canviar-ne un no el perdi. */
  ordre: string;
};

/** Els filtres a partir dels paràmetres de l'adreça. Els que no són característiques s'ignoren. */
export function llegeixFiltres(parametres: Record<string, string | string[] | undefined>): FiltresArticles {
  const text = (clau: string) => {
    const valor = parametres[clau];
    return (Array.isArray(valor) ? valor[0] : valor ?? "").trim();
  };
  const tria: Record<string, string> = {};
  for (const caracteristica of CARACTERISTIQUES) {
    const valor = text(caracteristica.clau);
    if (valor) tria[caracteristica.clau] = valor;
  }
  return { cerca: text("q"), ambFoto: text("foto") === "1", ambHistorics: text("historics") === "1", tria, ordre: text("ordre") };
}

/** On es busca el text de la cerca: el nom, el codi i totes les característiques. */
function textDeCerca(article: ArticleDeCataleg) {
  return clauDeValor(
    [article.nom, article.codi_erp, article.codi_barres, ...CARACTERISTIQUES.flatMap((c) => c.valors(article))].filter(Boolean).join(" "),
  );
}

/** Si l'article passa els filtres. `excepte` en deixa un de banda: és com es compten les opcions d'aquell filtre. */
function passa(article: ArticleDeCataleg, filtres: FiltresArticles, excepte?: string) {
  if (article.historic && !filtres.ambHistorics) return false;
  if (filtres.ambFoto && !article.imatge) return false;
  if (filtres.cerca) {
    const text = textDeCerca(article);
    if (!clauDeValor(filtres.cerca).split(" ").every((mot) => text.includes(mot))) return false;
  }
  return CARACTERISTIQUES.every((caracteristica) => {
    const triat = filtres.tria[caracteristica.clau];
    if (!triat || caracteristica.clau === excepte) return true;
    return caracteristica.valors(article).some((valor) => clauDeValor(valor) === clauDeValor(triat));
  });
}

export function filtraArticles<A extends ArticleDeCataleg>(articles: A[], filtres: FiltresArticles): A[] {
  return articles
    .filter((article) => passa(article, filtres))
    .sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? "", "ca"));
}

export type Opcio = { valor: string; quants: number };

/**
 * Les opcions de cada filtre, amb quants articles hi quedarien si es triessin:
 * es compten amb tots els altres filtres posats, però no el mateix, perquè
 * canviar de tipus no demani treure'l primer. Els valors que s'escriuen
 * diferent (majúscules, accents) van junts, amb la forma més habitual.
 */
export function opcionsDeFiltres(articles: ArticleDeCataleg[], filtres: FiltresArticles): Record<string, Opcio[]> {
  const resultat: Record<string, Opcio[]> = {};
  for (const caracteristica of CARACTERISTIQUES) {
    const perClau = new Map<string, { formes: Map<string, number>; quants: number }>();
    for (const article of articles) {
      if (!passa(article, filtres, caracteristica.clau)) continue;
      // Un producte amb «Garnatxa, Garnatxa negra» compta una vegada per a cada varietat, no dues per a la mateixa.
      const vistes = new Set<string>();
      for (const valor of caracteristica.valors(article)) {
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
    // El valor triat hi ha de ser encara que ara no en quedi cap: si no, el desplegable el perdria.
    const triat = filtres.tria[caracteristica.clau];
    if (triat && !opcions.some((opcio) => clauDeValor(opcio.valor) === clauDeValor(triat))) opcions.push({ valor: triat, quants: 0 });
    resultat[caracteristica.clau] = opcions.sort((a, b) =>
      caracteristica.ordre === "desc" ? b.valor.localeCompare(a.valor, "ca", { numeric: true }) : a.valor.localeCompare(b.valor, "ca"),
    );
  }
  return resultat;
}

/** Quants filtres hi ha posats, per al botó del telèfon. */
export function quantsFiltres(filtres: FiltresArticles) {
  return Object.keys(filtres.tria).length + (filtres.ambFoto ? 1 : 0) + (filtres.ambHistorics ? 1 : 0);
}
