/**
 * Entrar i sortir de Directus amb les credencials d'una persona.
 *
 * Els testimonis que en surten viuen només dins d'una crida del servidor: es
 * fan servir per llegir o escriure en nom d'aquella persona i es tanquen de
 * seguida. No es desen enlloc ni arriben mai al navegador.
 */
import "server-only";

import { ErrorDirectus, codiError, demana, estaConfigurat } from "./client";

type RespostaLogin = { data?: { access_token?: string; refresh_token?: string } };

export type Testimonis = { acces: string; refresc?: string };

/** Entra a Directus amb les credencials d'una persona i retorna els seus testimonis. */
export async function entra(correu: string, contrasenya: string): Promise<Testimonis> {
  if (!estaConfigurat()) {
    throw new ErrorDirectus("configuracio", "Falta la variable DIRECTUS_URL.");
  }

  const resposta = await demana("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: correu, password: contrasenya, mode: "json" }),
  });

  if (!resposta.ok) {
    const codi = await codiError(resposta);
    if (codi === "INVALID_CREDENTIALS") {
      throw new ErrorDirectus("credencials", "Les credencials no són correctes.");
    }
    if (codi === "USER_SUSPENDED") {
      throw new ErrorDirectus("suspes", "Aquest compte està suspès.");
    }
    if (resposta.status === 503) {
      throw new ErrorDirectus("servei", "El servei d'identitat no està disponible ara mateix.");
    }
    throw new ErrorDirectus("servei", `L'autenticació ha respost HTTP ${resposta.status}.`);
  }

  const { data } = (await resposta.json()) as RespostaLogin;
  if (!data?.access_token) {
    throw new ErrorDirectus("servei", "L'autenticació ha respost sense testimoni.");
  }
  return { acces: data.access_token, refresc: data.refresh_token };
}

export async function tanca(testimoniRefresc: string) {
  try {
    await demana("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: testimoniRefresc, mode: "json" }),
    });
  } catch {
    // Si no es pot tancar, la sessió de Directus caduca sola.
  }
}
