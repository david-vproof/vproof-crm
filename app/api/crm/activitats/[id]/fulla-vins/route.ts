import { NextResponse, type NextRequest } from "next/server";

import { UUID, nomesUuids, respostaError, respostaFulla, vinsRetocats } from "@/app/api/crm/fulla-vins/comu";
import { llegeixOrdre } from "@/domini/fulla-vins";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { dadesFullaVins } from "@/serveis/fulla-vins";

/**
 * La fulla de vins d'una activitat. El middleware ja exigeix sessió, i
 * l'activitat d'un altre comercial no surt, com a la resta del CRM.
 *
 * GET, amb `vins` (ids d'article separats per comes, els triats a la pantalla
 * encara que no s'hagin desat; sense, els de l'activitat), `preus=0` per
 * anar sense preus i `ordre` (`triat`: tal com s'han triat; sense, per
 * color i preu):
 * - `format=json`: les dades de la fulla tal com les posaria FactuSol, sense
 *   fotos, perquè el modal les ensenyi a revisar abans de fer el PDF.
 * - si no, el PDF tal qual; `baixa=1` per descarregar-lo.
 *
 * POST, amb un JSON `{ vins: [{ id, preu, descompte, observacions }], ambPreus, ordre }`:
 * el PDF amb els retocs de la revisió. Preu i descompte buits treuen el valor.
 * La mateixa fulla sense activitat és a `app/api/crm/fulla-vins`.
 */
export async function GET(peticio: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const parametres = peticio.nextUrl.searchParams;

  try {
    const { deQui, jo } = await abastDeLaSessio();
    const dades = await dadesFullaVins(id, {
      vins: nomesUuids((parametres.get("vins") ?? "").split(",")),
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
  const cos = ((await peticio.json().catch(() => null)) ?? {}) as { vins?: unknown; ambPreus?: unknown; ordre?: unknown };
  const { ids, ajustos } = vinsRetocats(cos);

  try {
    const { deQui, jo } = await abastDeLaSessio();
    const dades = await dadesFullaVins(id, { vins: ids, ambPreus: cos.ambPreus !== false, deQui, jo, ajustos, ordre: llegeixOrdre(cos.ordre) });
    return respostaFulla(dades, "pdf");
  } catch (error) {
    return respostaError(error);
  }
}
