import { NextResponse, type NextRequest } from "next/server";

import { UUID, nomesUuids, respostaError, respostaFulla, productesRetocats } from "@/app/api/crm/fulla-productes/comu";
import { llegeixOrdre } from "@/domini/fulla-productes";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { dadesFullaProductes } from "@/serveis/fulla-productes";

/**
 * La fulla de productes d'una activitat. El middleware ja exigeix sessió, i
 * l'activitat d'un altre comercial no surt, com a la resta del CRM.
 *
 * GET, amb `productes` (ids d'article separats per comes, els triats a la pantalla
 * encara que no s'hagin desat; sense, els de l'activitat), `preus=0` per
 * anar sense preus i `ordre` (`triat`: tal com s'han triat; sense, per
 * color i preu):
 * - `format=json`: les dades de la fulla tal com les posaria l'ERP, sense
 *   fotos, perquè el modal les ensenyi a revisar abans de fer el PDF.
 * - si no, el PDF tal qual; `baixa=1` per descarregar-lo.
 *
 * POST, amb un JSON `{ productes: [{ id, preu, descompte, observacions }], ambPreus, ordre }`:
 * el PDF amb els retocs de la revisió. Preu i descompte buits treuen el valor.
 * La mateixa fulla sense activitat és a `app/api/crm/fulla-productes`.
 */
export async function GET(peticio: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const parametres = peticio.nextUrl.searchParams;

  try {
    const { deQui, jo } = await abastDeLaSessio();
    const dades = await dadesFullaProductes(id, {
      productes: nomesUuids((parametres.get("productes") ?? "").split(",")),
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

export async function POST(peticio: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const cos = ((await peticio.json().catch(() => null)) ?? {}) as { productes?: unknown; ambPreus?: unknown; ordre?: unknown };
  const { ids, ajustos } = productesRetocats(cos);

  try {
    const { deQui, jo } = await abastDeLaSessio();
    const dades = await dadesFullaProductes(id, { productes: ids, ambPreus: cos.ambPreus !== false, deQui, jo, ajustos, ordre: llegeixOrdre(cos.ordre) });
    return respostaFulla(dades, "pdf");
  } catch (error) {
    return respostaError(error);
  }
}
