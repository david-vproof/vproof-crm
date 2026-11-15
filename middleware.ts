import { NextResponse, type NextRequest } from "next/server";

import {
  COMPROVACIO_MS,
  GALETA_SESSIO,
  REINTENT_MS,
  RENOVACIO_MS,
  opcionsGaleta,
  renovaSessio,
  signaSessio,
  verificaToken,
} from "@/lib/sessio";
import { compteActiu } from "@/serveis/identitat";

/** Cap a l'entrada, recordant d'on venia, i sense la galeta que ja no serveix. */
function capALogin(peticio: NextRequest) {
  const { pathname, search } = peticio.nextUrl;
  const desti = new URL("/login", peticio.url);
  if (pathname !== "/") desti.searchParams.set("des", pathname + search);
  const resposta = NextResponse.redirect(desti);
  resposta.cookies.delete(GALETA_SESSIO);
  return resposta;
}

/** Tot el que penja del portal exigeix sessió; /login exigeix no tenir-ne. */
export async function middleware(peticio: NextRequest) {
  const sessio = await verificaToken(peticio.cookies.get(GALETA_SESSIO)?.value);

  if (peticio.nextUrl.pathname === "/login") {
    if (sessio) return NextResponse.redirect(new URL("/crm", peticio.url));
    return NextResponse.next();
  }

  if (!sessio) return capALogin(peticio);

  // Sessió llarga però vigilada: un cop al dia es mira que el compte segueixi
  // actiu. Si no es pot saber, es conserva i es torna a provar d'aquí a una
  // hora, no a cada petició.
  const ara = Date.now();
  let comprovat = sessio.comprovat;
  // El rol i l'agent es tornen a llegir amb la comprovació: així un canvi fet des d'Usuaris arriba sense tornar a entrar.
  let perfil: NonNullable<Parameters<typeof renovaSessio>[1]>["perfil"];
  // Una galeta d'abans de l'abast per agent no porta el camp «agent»: es completa en aquesta mateixa petició.
  if (ara - sessio.comprovat > COMPROVACIO_MS || sessio.agent === undefined) {
    const compte = await compteActiu(sessio);
    if (compte.actiu === false) return capALogin(peticio);
    comprovat = compte.actiu ? ara : ara - COMPROVACIO_MS + REINTENT_MS;
    perfil = compte.perfil;
  }

  // Lliscant: cada dia d'ús es torna a signar amb la caducitat allargada.
  if (ara - sessio.renovat > RENOVACIO_MS || comprovat !== sessio.comprovat) {
    const nova = renovaSessio(sessio, { comprovat, ara, perfil });
    const signada = await signaSessio(nova);
    // La pàgina d'aquesta mateixa petició ja llegeix la sessió nova: si no, el rol o l'agent frescos arribarien a la següent.
    const capcaleres = new Headers(peticio.headers);
    capcaleres.set(
      "cookie",
      [...peticio.cookies.getAll().filter((g) => g.name !== GALETA_SESSIO).map((g) => `${g.name}=${g.value}`), `${GALETA_SESSIO}=${signada}`].join("; "),
    );
    const resposta = NextResponse.next({ request: { headers: capcaleres } });
    resposta.cookies.set(GALETA_SESSIO, signada, opcionsGaleta(nova.expira, ara));
    return resposta;
  }

  return NextResponse.next();
}

export const config = {
  // Al runtime de Node: la sessió es comprova contra la base de dades SQLite, que no és a l'Edge.
  runtime: "nodejs",
  // S'exclouen els assets, les rutes internes de Next i el que el sistema
  // demana sense galeta en instal·lar l'app: el manifest i les icones.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon/|apple-icon|.*\\.(?:jpg|png|svg|webp|ico|txt)$).*)",
  ],
};
