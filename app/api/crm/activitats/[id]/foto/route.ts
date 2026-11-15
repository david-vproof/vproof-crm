import { NextResponse, type NextRequest } from "next/server";

import { abastDeLaSessio } from "@/lib/sessio-actual";
import { fotoDActivitat } from "@/serveis/fotos-activitats";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * La foto d'una activitat. Com la dels articles, va pel servidor: el navegador
 * no parla mai amb Directus. El middleware ja exigeix sessió, i l'activitat d'un
 * client que no és de qui la demana no surt.
 *
 * Quan l'adreça porta l'id del fitxer (`v`) i és el que toca, la resposta es pot
 * guardar sense caducitat: una foto nova vindrà amb un altre `v`.
 */
export async function GET(peticio: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  try {
    const { deQui } = await abastDeLaSessio();
    const foto = await fotoDActivitat(id, deQui);
    if (!foto) return new NextResponse(null, { status: 404 });

    const fixa = peticio.nextUrl.searchParams.get("v") === foto.fitxer;
    return new NextResponse(foto.resposta.body, {
      headers: {
        "Content-Type": foto.resposta.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": fixa ? "private, max-age=31536000, immutable" : "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
