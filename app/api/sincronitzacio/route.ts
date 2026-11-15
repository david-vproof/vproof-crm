import { NextResponse, type NextRequest } from "next/server";

import type { MissatgeFlux } from "@/app/(portal)/configuracio/flux-sincronitzacio";
import { esTaula } from "@/domini/sincronitzacio";
import { fluxNdjson } from "@/lib/ndjson";
import { ubicaTotsElsPendents } from "@/serveis/crm-mapa";
import {
  type Execucio, estatDesDeRegistre, execucioEnCurs, historialExecucions, seguimentDe, sincronitza,
} from "@/serveis/sincronitzacio";
import { potVeureTot } from "@/lib/sessio-actual";
import { subscriu } from "@/serveis/sincronitzacio-seguiment";

/**
 * La sincronització d'una taula, explicada mentre es fa.
 *
 * POST engega la passada i la fa dins de la mateixa petició, que es queda
 * oberta fins al final: a Cloud Run, és el que garanteix que el procés tingui
 * CPU tota l'estona. Mentrestant hi escriu una línia JSON per cada canvi
 * d'estat (vegeu `EstatEnViu`), un pols cada pocs segons perquè es vegi que
 * el servidor és viu, i al final el resultat.
 *
 * GET s'enganxa a una passada que ja corre —perquè s'ha recarregat la pàgina,
 * perquè l'ha engegat el programador o perquè l'ha engegat algú altre— i
 * n'explica l'estat fins que acaba. Si corre en aquest procés, el té en
 * memòria i el dona al moment; si no, el llegeix del registre de Directus cada
 * pocs segons.
 *
 * El middleware ja exigeix sessió.
 */
export const dynamic = "force-dynamic";

/** Cada quant es diu «soc viu» quan no hi ha cap altre canvi. */
const POLS_MS = 5_000;
/** Cada quant es rellegeix el registre quan la passada corre en una altra instància. */
const RELLEGEIX_MS = 3_000;

export async function POST(peticio: NextRequest) {
  // Llançar una passada és de qui ho veu tot (la Configuració): a un comercial se li nega.
  if (!(await potVeureTot())) return new NextResponse(null, { status: 404 });
  const cos = (await peticio.json().catch(() => null)) as { taula?: unknown } | null;
  const taula = typeof cos?.taula === "string" ? cos.taula : "";
  if (!esTaula(taula)) return NextResponse.json({ error: "Aquesta taula no se sincronitza." }, { status: 400 });

  return fluxNdjson(async (emet) => {
    const deixa = subscriu(taula, (estat) => emet({ tipus: "estat", estat } satisfies MissatgeFlux));
    const pols = setInterval(() => emet({ tipus: "pols", ara: new Date().toISOString() } satisfies MissatgeFlux), POLS_MS);
    try {
      const resultat = await sincronitza(taula, "manual");
      // Els clients i els establiments nous, o amb l'adreça canviada, se situen
      // de seguida en segon pla, sense esperar el programador: pot durar minuts.
      if (taula === "clients" && resultat.correcte) void ubicaTotsElsPendents().catch(() => undefined);
      emet({ tipus: "final", resultat } satisfies MissatgeFlux);
    } finally {
      clearInterval(pols);
      deixa();
    }
  });
}

export async function GET(peticio: NextRequest) {
  if (!(await potVeureTot())) return new NextResponse(null, { status: 404 });
  const taula = peticio.nextUrl.searchParams.get("taula") ?? "";
  if (!esTaula(taula)) return NextResponse.json({ error: "Aquesta taula no se sincronitza." }, { status: 400 });

  return fluxNdjson(async (emet, senyal) => {
    const pols = setInterval(() => emet({ tipus: "pols", ara: new Date().toISOString() } satisfies MissatgeFlux), POLS_MS);
    try {
      const enViu = seguimentDe(taula);
      if (enViu && !enViu.final) {
        emet({ tipus: "estat", estat: enViu } satisfies MissatgeFlux);
        await finsQueAcabi(taula, emet, senyal);
        emet({ tipus: "final" } satisfies MissatgeFlux);
        return;
      }

      // No és d'aquest procés: pel registre, fins que deixi de ser «en curs».
      // Una d'acabada fa poc en aquest procés només val si el registre no en té cap de viva.
      let seguida: Execucio | null = null;
      while (!senyal.aborted) {
        const enCurs = await execucioEnCurs(taula);
        if (!enCurs) break;
        seguida = enCurs;
        emet({ tipus: "estat", estat: estatDesDeRegistre(enCurs) } satisfies MissatgeFlux);
        await espera(RELLEGEIX_MS, senyal);
      }
      // Com ha acabat: el registre que s'estava seguint, ja tancat. Si no se'n
      // seguia cap (ha acabat entre que la pàgina es pintava i s'hi enganxava),
      // el darrer de la taula, que és el que la pantalla espera veure.
      if (!seguida && enViu) {
        emet({ tipus: "estat", estat: enViu } satisfies MissatgeFlux);
        emet({ tipus: "final" } satisfies MissatgeFlux);
        return;
      }
      const [darrera] = senyal.aborted ? [null] : await historialExecucions(taula, 1).catch(() => [null]);
      const acabada = darrera && darrera.estat !== "en_curs" && (!seguida || darrera.id === seguida.id) ? darrera : null;
      emet({ tipus: "final", execucio: acabada } satisfies MissatgeFlux);
    } finally {
      clearInterval(pols);
    }
  });
}

/** Es queda subscrit fins que la passada acaba o qui mira se'n va. */
function finsQueAcabi(taula: Parameters<typeof subscriu>[0], emet: (missatge: unknown) => void, senyal: AbortSignal) {
  return new Promise<void>((resol) => {
    const deixa = subscriu(taula, (estat) => {
      emet({ tipus: "estat", estat } satisfies MissatgeFlux);
      if (estat.final) acaba();
    });
    const acaba = () => {
      deixa();
      senyal.removeEventListener("abort", acaba);
      resol();
    };
    senyal.addEventListener("abort", acaba);
  });
}

function espera(ms: number, senyal: AbortSignal) {
  return new Promise<void>((resol) => {
    const temporitzador = setTimeout(acaba, ms);
    function acaba() {
      clearTimeout(temporitzador);
      senyal.removeEventListener("abort", acaba);
      resol();
    }
    senyal.addEventListener("abort", acaba);
  });
}
