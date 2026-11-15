import { NextResponse, type NextRequest } from "next/server";

import { catalegDeVins } from "@/serveis/crm-vins";

/**
 * El catàleg per al configurador de vins: els actius, o amb `?historics=1`
 * només els històrics, que el configurador demana quan es marca la casella.
 * Va pel servidor, com tota la resta, i el middleware ja exigeix sessió.
 */
export async function GET(peticio: NextRequest) {
  try {
    const historics = peticio.nextUrl.searchParams.get("historics") === "1";
    return NextResponse.json({ vins: await catalegDeVins(historics ? "historics" : "actius") });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
