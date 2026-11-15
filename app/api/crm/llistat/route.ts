import { NextResponse, type NextRequest } from "next/server";

import { FITXES, esClauFitxa } from "@/domini/crm-fitxes";
import { llegeixFiltres, llegeixOrdre, teScroll } from "@/domini/crm-llistat";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { llistaFitxa } from "@/serveis/crm-manteniment";

/**
 * Més files d'un llistat que es va allargant en baixar: vegeu `ScrollRegistres`.
 * Es llegeix igual que la pàgina (mateixos paràmetres, mateix abast), i només
 * canvia que es diu des de quina fila i quantes.
 */
export async function GET(peticio: NextRequest) {
  const params = Object.fromEntries(peticio.nextUrl.searchParams);
  const clau = params.v ?? "";
  if (!esClauFitxa(clau) || !teScroll(clau)) {
    return NextResponse.json({ error: "Aquest llistat no es carrega a trams." }, { status: 400 });
  }

  const salta = Number(params.salta);
  const quantes = Number(params.quantes);
  if (!Number.isInteger(salta) || salta < 0 || !Number.isInteger(quantes) || quantes < 1) {
    return NextResponse.json({ error: "Tram incorrecte." }, { status: 400 });
  }

  const fitxa = FITXES[clau];
  const abast = await abastDeLaSessio();
  const filtres = llegeixFiltres(fitxa, params);
  // Com a la pàgina: qui només veu els clients del seu agent no filtra per agent.
  if (!abast.totes) delete filtres.agent;

  try {
    const { files, total } = await llistaFitxa(clau, {
      cerca: params.q ?? "",
      comercial: abast.deQui,
      ordre: llegeixOrdre(fitxa, params.ordre),
      filtres,
      perPagina: quantes,
      salta,
      ambColumnes: false,
    });
    return NextResponse.json({ files, total });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
