import { NextResponse, type NextRequest } from "next/server";

import { llegeixDadesDePlantilla } from "@/app/api/crm/plantilles-productes/dades";
import { ErrorPlantilla, actualitzaPlantilla, esborraPlantilla, obtePlantilla } from "@/serveis/plantilles-productes";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

/** Una plantilla sencera: criteris i línies, per carregar-la a la cistella. */
export async function GET(_peticio: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Aquesta plantilla no existeix." }, { status: 404 });
  try {
    const plantilla = await obtePlantilla(id);
    if (!plantilla) return NextResponse.json({ error: "Aquesta plantilla ja no existeix." }, { status: 404 });
    return NextResponse.json({ plantilla });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

/** Sobreescriu la plantilla amb la cistella d'ara. */
export async function PUT(peticio: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Aquesta plantilla no existeix." }, { status: 404 });
  try {
    await actualitzaPlantilla(id, llegeixDadesDePlantilla(await peticio.json().catch(() => null)));
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ErrorPlantilla) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

export async function DELETE(_peticio: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Aquesta plantilla no existeix." }, { status: 404 });
  try {
    await esborraPlantilla(id);
    return NextResponse.json({ fet: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
