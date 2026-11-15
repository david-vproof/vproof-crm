/**
 * La comarca d'un client, deduïda de la seva adreça. Només a Catalunya: fora
 * no hi ha comarques oficials i el camp es deixa com estigui.
 *
 * FactuSol no porta la comarca, i la població hi arriba escrita de mil
 * maneres: en majúscules i sense accents, en castellà, amb l'article al
 * darrere o amb el nom d'un nucli que no és municipi (Llafranc, Cabrianes).
 * Per això es prova en tres passos, del més segur al menys:
 *
 *   1. Pel nom de la població contra els municipis de l'Idescat, dins de la
 *      província que diu el codi postal (hi ha més d'un Sant Martí).
 *   2. Pel codi postal: la comarca que tenen els altres clients del mateix codi.
 *   3. Pel veí: la comarca del client més proper ja resolt, si és a tocar.
 *
 * Tot és càlcul pur; qui llegeix i escriu és la sincronització.
 */
import { MUNICIPIS_CATALUNYA } from "./comarques-catalunya";

/** Fins a quina distància el client més proper ja diu de quina comarca és un altre. */
export const DISTANCIA_VEI_KM = 8;

/** La província pel nom, per als clients sense codi postal. També els noms en castellà. */
const PROVINCIA_PER_NOM: Record<string, string> = {
  barcelona: "08", girona: "17", gerona: "17", lleida: "25", lerida: "25", tarragona: "43",
};

export type UbicacioClient = {
  id: string;
  poblacio: string | null;
  codi_postal: string | null;
  provincia: string | null;
  /** Directus torna els decimals com a text. */
  latitud: number | string | null;
  longitud: number | string | null;
};

/**
 * La forma comparable d'un nom de lloc: sense accents ni majúscules, amb
 * l'article fora («Escala, l'», «L'ESCALA» i «Lescala» no, però «L Escala»
 * sí), i els noms castellans més habituals en català («San» → «Sant»).
 */
export function clauDeLloc(text: unknown): string {
  let net = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`´‘]/g, "'")
    .replace(/l·l|l\.l/g, "ll")
    .trim();
  // L'article al darrere, com l'escriu l'Idescat o com surt d'un llistat ordenat.
  // Hi ha d'haver separador: «Vila» no és «Vi, la».
  const invertit = /^(.+?)[\s,]+\(?\s*(l'|el|la|els|les|los|las)\s*\)?$/.exec(net);
  if (invertit) net = `${invertit[2]} ${invertit[1]}`;
  return net
    .replace(/([ld])\s*'\s*/g, "$1 ")
    .replace(/[^a-z0-9ç]+/g, " ")
    .trim()
    .replace(/^(l|el|la|els|les|los|las) /, "")
    .replace(/\bsan\b/g, "sant")
    .replace(/\by\b/g, "i")
    .replace(/\bde (la|les|l|el|els)\b/g, "de")
    .replace(/\bdel?s?\b/g, "de")
    .replace(/\s+/g, " ");
}

let index: Map<string, { provincia: string; comarca: string }[]> | null = null;

function municipisPerClau() {
  if (index) return index;
  index = new Map();
  for (const [codi, nom, comarca] of MUNICIPIS_CATALUNYA) {
    const clau = clauDeLloc(nom);
    const llista = index.get(clau) ?? [];
    llista.push({ provincia: codi.slice(0, 2), comarca });
    index.set(clau, llista);
  }
  return index;
}

/**
 * La província catalana del client ("08", "17", "25", "43"), o null si no ho és
 * o no se sap. Mana el codi postal; sense, el nom de la província.
 */
export function provinciaCatalana(codiPostal: unknown, provincia: unknown): string | null {
  const cp = String(codiPostal ?? "").trim();
  if (/^\d{4,5}$/.test(cp)) {
    const prefix = cp.padStart(5, "0").slice(0, 2);
    return ["08", "17", "25", "43"].includes(prefix) ? prefix : null;
  }
  return PROVINCIA_PER_NOM[clauDeLloc(provincia)] ?? null;
}

/** Els trossos d'una població composta: «CASC URBA (LLANÇA)», «LA PINYA - VALL D'EN BAS», «Arnes. Terra Alta». */
function trossos(poblacio: string) {
  return poblacio
    .split(/[().\-–/]+/)
    .map((tros) => tros.trim())
    .filter((tros) => tros.length > 2)
    .sort((a, b) => b.length - a.length);
}

/** El pas 1: pel nom, dins de la província. Només si el nom porta a una sola comarca. */
export function comarcaPerNom(poblacio: unknown, provincia: string): string | null {
  const text = String(poblacio ?? "").trim();
  if (!text) return null;
  for (const intent of [text, ...trossos(text)]) {
    const comarques = new Set(
      (municipisPerClau().get(clauDeLloc(intent)) ?? []).filter((m) => m.provincia === provincia).map((m) => m.comarca),
    );
    if (comarques.size === 1) return [...comarques][0];
    if (comarques.size > 1) return null;
  }
  return null;
}

function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function coordenades(client: UbicacioClient) {
  const lat = Number(client.latitud);
  const lon = Number(client.longitud);
  return client.latitud !== null && client.longitud !== null && Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon }
    : null;
}

/**
 * La comarca de cada client que se'n pot deduir, per id. Els de fora de
 * Catalunya i els que no es poden resoldre no hi surten.
 */
export function deduiexComarques(clients: UbicacioClient[]): Map<string, string> {
  const resultat = new Map<string, string>();
  const catalans = clients.flatMap((client) => {
    const provincia = provinciaCatalana(client.codi_postal, client.provincia);
    return provincia ? [{ client, provincia, cp: String(client.codi_postal ?? "").trim().padStart(5, "0") }] : [];
  });

  // 1. Pel nom.
  for (const { client, provincia } of catalans) {
    const comarca = comarcaPerNom(client.poblacio, provincia);
    if (comarca) resultat.set(client.id, comarca);
  }

  // 2. Pel codi postal: la comarca que hi tenen la majoria dels ja resolts, si n'hi ha una que guanyi.
  const perCodi = new Map<string, Map<string, number>>();
  for (const { client, cp } of catalans) {
    const comarca = resultat.get(client.id);
    if (!comarca) continue;
    const recompte = perCodi.get(cp) ?? new Map<string, number>();
    recompte.set(comarca, (recompte.get(comarca) ?? 0) + 1);
    perCodi.set(cp, recompte);
  }
  const perVei: typeof catalans = [];
  for (const entrada of catalans) {
    if (resultat.has(entrada.client.id)) continue;
    const [primera, segona] = [...(perCodi.get(entrada.cp) ?? [])].sort((a, b) => b[1] - a[1]);
    if (primera && (!segona || primera[1] > segona[1])) resultat.set(entrada.client.id, primera[0]);
    else perVei.push(entrada);
  }

  // 3. Pel veí més proper que ja té comarca, si és a prop.
  const referents = catalans.flatMap(({ client }) => {
    const punt = coordenades(client);
    const comarca = resultat.get(client.id);
    return punt && comarca ? [{ punt, comarca }] : [];
  });
  for (const { client } of perVei) {
    const punt = coordenades(client);
    if (!punt) continue;
    let millor: { distancia: number; comarca: string } | null = null;
    for (const referent of referents) {
      const distancia = distanciaKm(punt, referent.punt);
      if (!millor || distancia < millor.distancia) millor = { distancia, comarca: referent.comarca };
    }
    if (millor && millor.distancia <= DISTANCIA_VEI_KM) resultat.set(client.id, millor.comarca);
  }

  return resultat;
}
