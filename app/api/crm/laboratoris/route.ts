import { NextResponse, type NextRequest } from "next/server";

import { cercaLaboratoris, provinciesDeLaboratoris } from "@/serveis/laboratoris";

/**
 * Cerca de laboratoris per al selector de l'activitat. Com la resta, va pel
 * servidor: el navegador no parla mai amb la base de dades. El middleware ja exigeix
 * sessió.
 *
 * Amb `provincies=1` la resposta hi porta també les províncies que hi ha, que
 * el selector demana un sol cop, en obrir-se.
 */
export async function GET(peticio: NextRequest) {
  const parametres = peticio.nextUrl.searchParams;
  const tipus = parametres.get("tipus") ?? "";

  try {
    const [resultat, provincies] = await Promise.all([
      cercaLaboratoris({
        cerca: parametres.get("q") ?? "",
        // Només els dos valors que desa la sincronització.
        tipus: tipus === "proveidor" || tipus === "creditor" ? tipus : "",
        provincia: parametres.get("provincia") ?? "",
      }),
      parametres.get("provincies") === "1" ? provinciesDeLaboratoris(tipus) : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...resultat, ...(provincies ? { provincies } : {}) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
