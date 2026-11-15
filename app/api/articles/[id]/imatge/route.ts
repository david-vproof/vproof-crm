import { NextResponse, type NextRequest } from "next/server";

import { midaDImatge } from "@/domini/imatge-article";
import { imatgeDArticle } from "@/serveis/articles";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * La foto d'un article. Com la resta, va pel servidor: el navegador no parla
 * mai amb Directus. El middleware ja exigeix sessió.
 *
 * `mida=petita` és la miniatura dels llistats; sense, la foto sencera. Quan
 * l'adreça porta l'id del fitxer (`v`) i és el que toca, la resposta es pot
 * guardar sense caducitat: una foto nova vindrà amb un altre `v`.
 */
export async function GET(peticio: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const parametres = peticio.nextUrl.searchParams;
  try {
    const imatge = await imatgeDArticle(id, midaDImatge(parametres.get("mida")));
    if (!imatge) return new NextResponse(null, { status: 404 });

    const fixa = parametres.get("v") === imatge.fitxer;
    return new NextResponse(imatge.resposta.body, {
      headers: {
        "Content-Type": imatge.resposta.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": fixa ? "private, max-age=31536000, immutable" : "private, max-age=300",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
