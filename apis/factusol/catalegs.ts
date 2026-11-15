import "server-only";

import { llancaConsulta, obtenirCredencials } from "./client";

/**
 * Descripcions dels codis que F_CLI i F_ART desen com a claus foranes.
 *
 * Els noms d'aquestes taules segueixen la convenció de FactuSol però no surten
 * a la documentació pública de l'API, així que cada consulta va protegida: si
 * la taula no existeix a la instal·lació, es mostra el codi en cru en comptes
 * de trencar la fitxa.
 */
type Cataleg = Record<string, string>;

let memoria: { formesPagament: Cataleg; agents: Cataleg; tipusClient: Cataleg; families: Cataleg; expira: number } | null = null;
const VIDA_MEMORIA_MS = 10 * 60 * 1000;

async function llegeixCataleg(taula: string, columnaCodi: string, columnaText: string): Promise<Cataleg> {
  const credencials = obtenirCredencials();
  if (!credencials) return {};

  try {
    const files = await llancaConsulta<Record<string, unknown>>(
      credencials,
      `SELECT ${columnaCodi}, ${columnaText} FROM ${taula}`,
    );
    return Object.fromEntries(
      files.map((fila) => [String(fila[columnaCodi]).trim(), String(fila[columnaText] ?? "").trim()]),
    );
  } catch {
    // La taula no existeix o té un altre nom en aquesta instal·lació.
    return {};
  }
}

export function reiniciaCatalegs() {
  memoria = null;
}

export async function carregaCatalegs() {
  if (memoria && memoria.expira > Date.now()) return memoria;

  const [formesPagament, agents, tipusClient, families] = await Promise.all([
    llegeixCataleg("F_FPA", "CODFPA", "DESFPA"),
    llegeixCataleg("F_AGE", "CODAGE", "NOMAGE"),
    llegeixCataleg("F_TCL", "CODTCL", "DESTCL"),
    llegeixCataleg("F_FAM", "CODFAM", "DESFAM"),
  ]);

  memoria = { formesPagament, agents, tipusClient, families, expira: Date.now() + VIDA_MEMORIA_MS };
  return memoria;
}

export function nomFormaPagament(cataleg: Cataleg, codi: string) {
  const clau = String(codi ?? "").trim();
  if (!clau) return "";
  return cataleg[clau] || `Forma de pagament ${clau}`;
}

export function nomAgent(cataleg: Cataleg, codi: number) {
  if (!codi) return "Sense assignar";
  return cataleg[String(codi)] || `Agent ${codi}`;
}

/** A FactuSol la tarifa és el número de llista de preus (PVP1…PVP6) de F_ART. */
export function nomTarifa(codi: number) {
  return codi ? `Tarifa ${codi}` : "Tarifa general";
}
