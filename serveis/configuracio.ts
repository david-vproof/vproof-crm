/**
 * Estat de la connexió amb l'ERP.
 *
 * Les credencials viuen a l'entorn del servei; el portal no les desa enlloc.
 * Aquí se'n mira l'estat, es comprova que responguin i s'ensenya en cru el
 * que l'API retorna de cada taula, com a pas previ a sincronitzar-la.
 */
import "server-only";

import { llancaConsulta, obtenirCredencials } from "@/apis/factusol/client";
import { comptaArticles, comptaProveidors } from "@/apis/factusol";
import { ESTAT_CLIENT_BAIXA } from "@/domini/factusol-vocabulari";

export type ResultatProva = { correcte: boolean; missatge: string };

export function credencialsActives() {
  return obtenirCredencials();
}

export async function provaConnexio(): Promise<ResultatProva> {
  const credencials = obtenirCredencials();
  if (!credencials) {
    return { correcte: false, missatge: "no hi ha cap credencial a l'entorn del servei." };
  }

  try {
    // Les dues taules que se sincronitzen, per veure-les totes dues d'un cop.
    const [clients, proveidors] = await Promise.all([
      // Sense els de baixa, com a la resta del portal.
      llancaConsulta<{ CODCLI: number }>(credencials, `SELECT CODCLI FROM F_CLI WHERE ESTCLI <> ${ESTAT_CLIENT_BAIXA.codi}`),
      comptaProveidors(),
    ]);
    return {
      correcte: true,
      missatge:
        `Connexió correcta: ${clients.length} fitxes a F_CLI i ${proveidors.total} a F_PRO ` +
        `(${proveidors.homologats} homologats) de l'exercici ${credencials.exercici}.`,
    };
  } catch (error) {
    return { correcte: false, missatge: `l'API respon: ${(error as Error).message}` };
  }
}

export type RecompteArticles = Awaited<ReturnType<typeof comptaArticles>>;

/**
 * Quants articles té F_ART i quants en deixa fora cada marca, per a la
 * pestanya d'articles. Si falla, la pestanya ja ensenya l'error de la taula.
 */
export async function recompteArticles(): Promise<RecompteArticles | null> {
  if (!obtenirCredencials()) return null;
  try {
    return await comptaArticles();
  } catch {
    return null;
  }
}
