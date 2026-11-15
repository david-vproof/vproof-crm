import { NextResponse, type NextRequest } from "next/server";

import { llegeixOrdre } from "@/domini/fulla-productes";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { dadesFullaProductesLliure } from "@/serveis/fulla-productes";

import { UUID, nomesUuids, respostaError, respostaFulla, productesRetocats } from "./comu";

/**
 * La fulla de productes des del selector, sense activitat. El middleware ja exigeix
 * sessió, i el client d'un altre comercial no surt, com a la resta del CRM.
 *
 * GET, amb `productes` (ids d'article separats per comes, en l'ordre de la
 * cistella), `client` (l'id del client, per treure-la amb la seva tarifa) o
 * `lead` (l'id del lead, amb la tarifa de venda al major; sense cap dels dos,
 * va sense preus), `preus=0` per anar sense preus i `ordre` (`triat`: tal com
 * s'han triat; sense, per color i preu):
 * - `format=json`: les dades per revisar-les abans del PDF.
 * - si no, el PDF tal qual; `baixa=1` per descarregar-lo.
 *
 * POST, amb un JSON `{ productes: [{ id, preu, descompte, observacions }], client, lead, ambPreus, ordre }`:
 * el PDF amb els retocs de la revisió.
 */
export async function GET(peticio: NextRequest) {
  const parametres = peticio.nextUrl.searchParams;
  const client = parametres.get("client");
  const lead = parametres.get("lead");
  if ((client && !UUID.test(client)) || (lead && !UUID.test(lead))) return new NextResponse(null, { status: 404 });

  try {
    const { deQui, jo } = await abastDeLaSessio();
    const dades = await dadesFullaProductesLliure({
      productes: nomesUuids((parametres.get("productes") ?? "").split(",")),
      client: client || null,
      lead: lead || null,
      ambPreus: parametres.get("preus") !== "0",
      deQui,
      jo,
      ambFotos: parametres.get("format") !== "json",
      ordre: llegeixOrdre(parametres.get("ordre")),
    });
    return respostaFulla(dades, parametres.get("format") === "json" ? "json" : "pdf", parametres.get("baixa") === "1");
  } catch (error) {
    return respostaError(error);
  }
}

export async function POST(peticio: NextRequest) {
  const cos = ((await peticio.json().catch(() => null)) ?? {}) as { productes?: unknown; client?: unknown; lead?: unknown; ambPreus?: unknown; ordre?: unknown };
  const client = typeof cos.client === "string" && UUID.test(cos.client) ? cos.client : null;
  const lead = typeof cos.lead === "string" && UUID.test(cos.lead) ? cos.lead : null;
  const { ids, ajustos } = productesRetocats(cos);

  try {
    const { deQui, jo } = await abastDeLaSessio();
    const dades = await dadesFullaProductesLliure({ productes: ids, client, lead, ambPreus: cos.ambPreus !== false, deQui, jo, ajustos, ordre: llegeixOrdre(cos.ordre) });
    return respostaFulla(dades, "pdf");
  } catch (error) {
    return respostaError(error);
  }
}
