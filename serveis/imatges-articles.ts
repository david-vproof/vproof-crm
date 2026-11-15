/**
 * Les fotos dels articles, de FactuSol a Directus. Va lligat a la passada
 * d'articles i s'hi fa just després: quan els articles ja porten al dia el nom
 * del fitxer de FactuSol (IMGART), es baixen només les fotos que han canviat i
 * es desen com a fitxers de Directus. La decisió de què copiar és a
 * `domini/imatge-article.ts`.
 *
 * Una foto que no es pot baixar no atura res: es compta i es torna a provar a
 * la passada següent.
 */
import "server-only";

import { actualitzaItem, esborraFitxer, idCarpeta, llistaTot, pujaFitxer } from "@/apis/directus/crm";
import { llegeixImatgesArticle } from "@/apis/factusol";
import { type ArticlePerImatge, planificaImatges, tipusDImatge, triaImatge } from "@/domini/imatge-article";

const COLLECCIO = "crm_articles";

/** La carpeta de Directus on van les fotos. La crea `scripts/crm-directus.mjs`; si no hi és, van a l'arrel. */
const CARPETA = "Articles de FactuSol";

/**
 * Quantes fotos es baixen com a màxim en una passada. La primera les porta
 * totes i la passada manual corre dins d'una petició: millor fer-ho a tongades
 * que arriscar-se a passar del temps que Cloud Run li dona.
 */
const MAXIM_PER_PASSADA = 150;

/** Quantes se'n baixen alhora. */
const ALHORA = 4;

export type ResultatImatges = {
  copiades: number;
  tretes: number;
  /** FactuSol n'anuncia una a F_ART però ArticulosImagen no la torna. */
  senseFitxer: number;
  errors: number;
  /** Les que no han cabut en aquesta passada. */
  pendents: number;
  primerError: string | null;
};

/**
 * Executa `feina` per a cada element, com a molt `alhora` a la vegada, i no en
 * comença cap més passat `finsA`. Torna quants n'han quedat sense fer.
 */
async function ambLimit<T>(elements: T[], alhora: number, finsA: number, feina: (element: T) => Promise<void>) {
  let seguent = 0;
  const treballadors = Array.from({ length: Math.min(alhora, elements.length) }, async () => {
    while (seguent < elements.length && Date.now() < finsA) await feina(elements[seguent++]);
  });
  await Promise.all(treballadors);
  return elements.length - seguent;
}

/**
 * `finsA`: l'instant en què la passada deixa de començar feina nova (vegeu la
 * sincronització). `informa` rep quantes fotos van de quantes: cada una és una
 * petició a FactuSol i la tongada pot durar minuts.
 */
export async function copiaImatgesArticles(finsA = Infinity, informa?: (fetes: number, total: number) => void): Promise<ResultatImatges> {
  const articles = await llistaTot<ArticlePerImatge>(COLLECCIO, [
    "id", "codi_erp", "erp_imatge", "imatge", "imatge_copiada_de", "erp_absent_des_de", "historic",
  ]);
  const { copiar, treure } = planificaImatges(articles);
  const resultat: ResultatImatges = {
    copiades: 0, tretes: 0, senseFitxer: 0, errors: 0, pendents: Math.max(0, copiar.length - MAXIM_PER_PASSADA), primerError: null,
  };
  const anotaError = (article: ArticlePerImatge, error: unknown) => {
    resultat.errors += 1;
    resultat.primerError ??= `${article.codi_erp}: ${(error as Error).message}`;
  };

  // FactuSol ja no en té: es desenllaça i s'esborra el fitxer.
  for (const article of treure) {
    try {
      await actualitzaItem(COLLECCIO, article.id, { imatge: null, imatge_copiada_de: null });
      if (article.imatge) await esborraFitxer(article.imatge).catch(() => undefined);
      resultat.tretes += 1;
    } catch (error) {
      anotaError(article, error);
    }
  }

  const carpeta = copiar.length > 0 ? await idCarpeta(CARPETA).catch(() => null) : null;

  const tongada = copiar.slice(0, MAXIM_PER_PASSADA);
  let fetes = 0;
  informa?.(0, tongada.length);
  const sensTemps = await ambLimit(tongada, ALHORA, finsA, async (article) => {
    try {
      const foto = triaImatge(await llegeixImatgesArticle(article.codi_erp!), article.erp_imatge);
      if (!foto) {
        // Es deixa anotat perquè no es torni a demanar a cada passada: si la
        // foto canvia a FactuSol, canviarà el nom i es tornarà a provar.
        await actualitzaItem(COLLECCIO, article.id, { imatge_copiada_de: article.erp_imatge });
        resultat.senseFitxer += 1;
        return;
      }

      const dades = new Uint8Array(Buffer.from(foto.I64ART, "base64"));
      const nou = await pujaFitxer({
        nom: foto.IMGART || `${article.codi_erp}.jpg`,
        tipus: tipusDImatge(foto.IMGART),
        dades,
        titol: `Article ${article.codi_erp}`,
        carpeta,
      });
      await actualitzaItem(COLLECCIO, article.id, { imatge: nou, imatge_copiada_de: article.erp_imatge });
      // La vella, un cop l'article ja apunta a la nova. Si no s'esborra, només queda un fitxer orfe.
      if (article.imatge && article.imatge !== nou) await esborraFitxer(article.imatge).catch(() => undefined);
      resultat.copiades += 1;
    } catch (error) {
      anotaError(article, error);
    } finally {
      fetes += 1;
      informa?.(fetes, tongada.length);
    }
  });

  resultat.pendents += sensTemps;
  return resultat;
}

/** El resum per al registre de la passada, o null si no hi havia res a fer. */
export function descriuImatges(resultat: ResultatImatges): string | null {
  const parts = [
    resultat.copiades ? `${resultat.copiades} copiades` : null,
    resultat.tretes ? `${resultat.tretes} tretes` : null,
    resultat.senseFitxer ? `${resultat.senseFitxer} que l'API de FactuSol no torna` : null,
    resultat.errors ? `${resultat.errors} amb error (${resultat.primerError})` : null,
  ].filter(Boolean);
  if (parts.length === 0 && !resultat.pendents) return null;
  return (
    `Fotos: ${parts.join(", ") || "cap canvi"}.` +
    (resultat.pendents ? ` En queden ${resultat.pendents} per a la propera passada.` : "")
  );
}
