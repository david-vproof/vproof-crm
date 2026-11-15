import { NextResponse, type NextRequest } from "next/server";

import { atributsDelClient } from "@/serveis/atributs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Els atributs d'un client, per al modal de la «A» de les llistes. Es demanen
 * en obrir-lo, no amb la llista: la majoria de vegades no s'obre. El
 * middleware ja exigeix sessió.
 */
export async function GET(peticio: NextRequest) {
  const client = peticio.nextUrl.searchParams.get("client") ?? "";
  if (!UUID.test(client)) return NextResponse.json({ error: "Falta el client." }, { status: 400 });
  try {
    return NextResponse.json({ atributs: await atributsDelClient(client) });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
