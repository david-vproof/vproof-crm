/**
 * Els articles: els vins que es venen. Com els cellers, no es llegeixen de
 * FactuSol en directe sinó de la còpia que en manté la sincronització
 * (`crm_articles`), que porta tot F_ART: els actius i els històrics
 * (descatalogats o no disponibles), aquests marcats.
 *
 * Les lectures d'aquí només porten els actius, si no es demanen els
 * històrics. Un article esborrat de l'ERP queda marcat com a absent i no surt
 * mai.
 */
import "server-only";

import { llegeixFitxer, llistaAmbTotal, obteItem, type Condicio } from "@/apis/directus/crm";
import type { MidaImatge } from "@/domini/imatge-article";

const COLLECCIO = "crm_articles";

/** Tots els que encara són a FactuSol, històrics inclosos. */
export const ARTICLES_VIGENTS: Condicio = { erp_absent_des_de: { _null: true } };
/** Només els que avui són actius a FactuSol: ni esborrats ni històrics. */
export const ARTICLES_ACTIUS: Condicio = { ...ARTICLES_VIGENTS, historic: { _eq: false } };
/** Només els històrics: encara a FactuSol, però descatalogats o no disponibles. */
export const ARTICLES_HISTORICS: Condicio = { ...ARTICLES_VIGENTS, historic: { _eq: true } };
const ACTIUS = ARTICLES_ACTIUS;

/** Els cinc camps programables de la fitxa d'article de FactuSol, de l'1 al 5. */
export type CampProgramable = `camp_programable_${1 | 2 | 3 | 4 | 5}`;

const CAMPS = [
  "id", "codi_erp", "nom", "familia", "codi_barres", "referencia_proveidor", "data_alta", "garantia",
  "camp_programable_1", "camp_programable_2", "camp_programable_3", "camp_programable_4", "camp_programable_5",
  "imatge", "historic", "celler.id", "celler.nom_comercial",
];

export type FitxaArticle = {
  id: string;
  codi_erp: string | null;
  nom: string | null;
  familia: string | null;
  codi_barres: string | null;
  referencia_proveidor: string | null;
  data_alta: string | null;
  garantia: string | null;
  /** L'id del fitxer de la foto a Directus. */
  imatge: string | null;
  /** Descatalogat o no disponible a FactuSol: ja no es ven. */
  historic: boolean;
  celler: { id: string; nom_comercial: string | null } | null;
} & Record<CampProgramable, string | null>;

/**
 * On demana el navegador la foto d'un article: al portal, que la treu de
 * Directus. L'id del fitxer va a l'adreça perquè una foto nova tingui adreça
 * nova, i així la vella es pot guardar a la memòria cau sense caducitat.
 */
export function urlImatge(article: Pick<FitxaArticle, "id" | "imatge">, mida: MidaImatge) {
  if (!article.imatge) return null;
  return `/api/articles/${article.id}/imatge?${new URLSearchParams({ mida, v: article.imatge })}`;
}

/** Quins articles es volen d'un catàleg: els actius (el normal), tots, o només els històrics. */
export type AbastCataleg = "actius" | "tots" | "historics";

/**
 * El catàleg, per a la pantalla d'articles i el selector de vins. Els actius
 * són uns centenars i els històrics, uns milers: es porten d'un cop i els
 * filtres, els comptes de cada opció i la paginació es fan al servidor del
 * portal (vegeu `domini/cataleg-articles.ts`).
 */
export async function catalegArticles(abast: AbastCataleg = "actius"): Promise<FitxaArticle[]> {
  const { files } = await llistaAmbTotal<FitxaArticle>(COLLECCIO, {
    camps: CAMPS,
    ordre: "nom",
    limit: -1,
    condicions: [abast === "tots" ? ARTICLES_VIGENTS : abast === "historics" ? ARTICLES_HISTORICS : ACTIUS],
  });
  return files;
}

/** Quants ids es demanen d'una tirada: van a l'adreça de la consulta. */
const IDS_PER_CONSULTA = 100;

/** D'aquests articles, els que són històrics: per no haver de portar-los tots quan només en calen uns quants. */
export async function historicsEntre(ids: string[]): Promise<FitxaArticle[]> {
  const unics = [...new Set(ids)];
  const lots = Array.from({ length: Math.ceil(unics.length / IDS_PER_CONSULTA) }, (_, i) =>
    unics.slice(i * IDS_PER_CONSULTA, (i + 1) * IDS_PER_CONSULTA),
  );
  const pagines = await Promise.all(
    lots.map((lot) => llistaAmbTotal<FitxaArticle>(COLLECCIO, { camps: CAMPS, limit: -1, condicions: [ARTICLES_HISTORICS, { id: { _in: lot } }] })),
  );
  return pagines.flatMap((pagina) => pagina.files);
}

/** Quants articles d'un celler se n'ensenyen a la seva fitxa. N'hi ha prou per a qualsevol celler real. */
const ARTICLES_PER_CELLER = 100;

/** Els articles actius d'un celler, per nom, per a la seva fitxa. */
export async function articlesDelCeller(celler: string) {
  return llistaAmbTotal<FitxaArticle>(COLLECCIO, {
    camps: CAMPS,
    ordre: "nom",
    limit: ARTICLES_PER_CELLER,
    condicions: [ACTIUS, { celler: { _eq: celler } }],
  });
}

// ------------------------------------------------------------------ fotos

/** Com surt cada mida de Directus: la petita, quadrada i lleugera, per als llistats; la gran, per mirar-la. */
const TRANSFORMACIO: Record<MidaImatge, Record<string, string>> = {
  petita: { width: "160", height: "160", fit: "inside", format: "webp", quality: "80" },
  gran: { width: "1200", height: "1200", fit: "inside", withoutEnlargement: "true" },
};

/**
 * La foto d'un article, per servir-la al navegador. Null si l'article no en
 * té. Si Directus no sap transformar-la, es dona l'original.
 */
export async function imatgeDArticle(id: string, mida: MidaImatge) {
  const article = await obteItem<{ imatge: string | null }>(COLLECCIO, id, ["imatge"]);
  if (!article?.imatge) return null;
  const resposta = await llegeixFitxer(article.imatge, TRANSFORMACIO[mida]).catch(() => llegeixFitxer(article.imatge!));
  return { fitxer: article.imatge, resposta };
}
