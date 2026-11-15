/**
 * El costat del navegador del flux de `/api/sincronitzacio`: engegar una
 * passada o enganxar-se a una que ja corre, i rebre'n cada canvi d'estat.
 * El tipus dels missatges és el mateix que escriu la ruta.
 */
import type { EstatEnViu, Taula } from "@/domini/sincronitzacio";
import { llegeixNdjson } from "@/lib/ndjson";
import type { Execucio, ResultatSincronitzacio } from "@/serveis/sincronitzacio";

/** Com acaba el flux: el resultat (si l'ha engegat aquest), el registre tancat (si s'hi ha enganxat) o un error. */
export type FinalFlux = { resultat?: ResultatSincronitzacio; execucio?: Execucio | null; error?: string };

export type MissatgeFlux =
  | { tipus: "estat"; estat: EstatEnViu }
  | { tipus: "pols"; ara: string }
  | ({ tipus: "final" } & FinalFlux);

export type OientsFlux = {
  alEstat: (estat: EstatEnViu) => void;
  /** Qualsevol senyal del servidor, també el pols: per saber que és viu. */
  alSenyal: () => void;
  alFinal: (final: FinalFlux) => void;
};

/** Engega la passada d'una taula i la segueix. Resol en tancar-se el flux: `true` si ha arribat el final. */
export function engegaISegueix(taula: Taula, oients: OientsFlux) {
  return segueixResposta(
    fetch("/api/sincronitzacio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taula }) }),
    oients,
  );
}

/** S'enganxa a la passada d'una taula que ja corre. Resol en tancar-se el flux: `true` si ha arribat el final. */
export function segueix(taula: Taula, oients: OientsFlux) {
  return segueixResposta(fetch(`/api/sincronitzacio?taula=${encodeURIComponent(taula)}`, { cache: "no-store" }), oients);
}

async function segueixResposta(peticio: Promise<Response>, oients: OientsFlux): Promise<boolean> {
  const resposta = await peticio;
  if (!resposta.ok) {
    const cos = (await resposta.json().catch(() => ({}))) as { error?: string };
    throw new Error(cos.error ?? `El servidor ha respost ${resposta.status}.`);
  }

  let final = false;
  await llegeixNdjson(resposta, (brut) => {
    const missatge = brut as MissatgeFlux;
    oients.alSenyal();
    if (missatge.tipus === "estat") oients.alEstat(missatge.estat);
    else if (missatge.tipus === "final") {
      final = true;
      oients.alFinal(missatge);
    }
  });
  return final;
}
