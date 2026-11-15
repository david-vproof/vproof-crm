import { NextResponse, type NextRequest } from "next/server";

import { MAXIM_CLIENTS_PRESENTACIONS, productesCompratsPer, productesHistoricsEntre, productesPresentatsPer } from "@/serveis/crm-productes";

const UUID = /^[0-9a-f-]{36}$/i;

const idsDe = (brut: string | null) =>
  (brut ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => UUID.test(id))
    .slice(0, MAXIM_CLIENTS_PRESENTACIONS);

/**
 * Què han presentat i què han comprat uns clients i uns leads, per al selector de
 * productes: `?clients=id,id,…&leads=id,id,…`. Un lead no és a l'ERP i no té
 * compres. També porta els productes històrics que hi surten: són els únics que el
 * selector ensenya sense demanar-los, i no té sentit que en baixi els milers que
 * hi ha per trobar-los. Va pel servidor, com tota la resta, i el middleware ja
 * exigeix sessió.
 */
export async function GET(peticio: NextRequest) {
  const clients = idsDe(peticio.nextUrl.searchParams.get("clients"));
  const leads = idsDe(peticio.nextUrl.searchParams.get("leads"));
  try {
    const [presentacions, compres] = await Promise.all([productesPresentatsPer(clients, leads), productesCompratsPer(clients)]);
    const historics = await productesHistoricsEntre([...Object.keys(presentacions), ...Object.keys(compres)]);
    return NextResponse.json({ presentacions, compres, historics });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
