/**
 * Les fotos dels articles. FactuSol en desa el nom del fitxer a F_ART (IMGART),
 * amb la data i l'hora dins del nom: «00011_0_20191230115305.jpg». Per això
 * n'hi ha prou de comparar aquest nom per saber si la foto ha canviat, sense
 * haver-la de baixar. La foto en si arriba per una crida a part de l'API
 * (ArticulosImagen), en base64.
 *
 * Aquí només hi ha la lògica pura: què cal copiar, què cal treure i quina foto
 * es tria. Qui baixa i desa és `serveis/imatges-articles.ts`.
 */

/** Una fila d'ArticulosImagen: l'article, el nom del fitxer i el fitxer en base64. */
export type ImatgeArticleErp = { CODART: string; IMGART: string; I64ART: string };

/** El que cal saber d'un article de Directus per decidir què fer amb la seva foto. */
export type ArticlePerImatge = {
  id: string;
  codi_erp: string | null;
  /** IMGART de FactuSol, tal com l'ha copiat la sincronització. */
  erp_imatge: string | null;
  /** La foto copiada a Directus: l'id del fitxer. */
  imatge: string | null;
  /** L'IMGART amb què es va copiar la foto que hi ha. */
  imatge_copiada_de: string | null;
  erp_absent_des_de: string | null;
  /** Els històrics no es toquen: són milers i la foto d'un vi que ja no es ven no val una petició cadascuna. */
  historic?: boolean;
};

/**
 * Què cal fer amb les fotos dels articles actius. Se'n copia una quan FactuSol
 * n'anuncia una que encara no s'ha copiat; es treu quan FactuSol ja no en té.
 * Els absents no es toquen: conserven la foto que tenien.
 */
export function planificaImatges(articles: ArticlePerImatge[]) {
  const actius = articles.filter((article) => !article.erp_absent_des_de && !article.historic && article.codi_erp);
  return {
    copiar: actius.filter((article) => article.erp_imatge && article.imatge_copiada_de !== article.erp_imatge),
    treure: actius.filter((article) => !article.erp_imatge && (article.imatge || article.imatge_copiada_de)),
  };
}

/**
 * La foto que va a la fitxa. Un article en pot tenir més d'una (el número del
 * mig del nom); es tria la que F_ART diu que és la seva i, si no hi és, la
 * primera per ordre de nom, que és la de número més baix.
 */
export function triaImatge(files: ImatgeArticleErp[], nomErp: string | null): ImatgeArticleErp | null {
  const ambDades = files.filter((fila) => String(fila.I64ART ?? "").trim() !== "");
  if (ambDades.length === 0) return null;
  const nom = String(nomErp ?? "").trim();
  const exacta = nom ? ambDades.find((fila) => fila.IMGART === nom || nom.endsWith(`\\${fila.IMGART}`) || nom.endsWith(`/${fila.IMGART}`)) : null;
  return exacta ?? [...ambDades].sort((a, b) => String(a.IMGART).localeCompare(String(b.IMGART)))[0];
}

const TIPUS_PER_EXTENSIO: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
};

/** El tipus MIME pel nom del fitxer. FactuSol les desa en JPEG, així que és el que es pren si no se sap. */
export function tipusDImatge(nom: string) {
  const extensio = /\.([a-z0-9]+)$/i.exec(nom)?.[1]?.toLowerCase() ?? "";
  return TIPUS_PER_EXTENSIO[extensio] ?? "image/jpeg";
}

/** Com es demana una foto al portal: en miniatura per als llistats o sencera. */
export type MidaImatge = "petita" | "gran";

export function midaDImatge(valor: string | null | undefined): MidaImatge {
  return valor === "petita" ? "petita" : "gran";
}
