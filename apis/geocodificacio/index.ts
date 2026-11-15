/**
 * Adreces a coordenades, amb Nominatim (OpenStreetMap).
 *
 * És el servei públic d'OSM: la seva política d'ús demana identificar-se amb
 * un User-Agent propi i no fer més d'una consulta per segon, i les dues coses
 * es respecten aquí. Per això la geocodificació no es fa mai al render d'una
 * pàgina, sinó per tandes (des del mapa obert, en segon pla des del
 * programador o després de desar un client), i el resultat es desa a Directus
 * perquè no s'hagi de tornar a preguntar.
 */
import "server-only";

import { carrerPerGeocodificar } from "@/domini/adreces";

const BASE = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
/**
 * Photon (Komoot) també va sobre OpenStreetMap, però cerca pel nom del lloc i
 * tolera errors d'escriptura: és el que troba «El Celleret» quan Nominatim,
 * pensat per a adreces, no en treu res. Es prioritza Catalunya perquè els
 * homònims d'arreu del món quedin al final.
 */
const BASE_PHOTON = process.env.PHOTON_URL ?? "https://photon.komoot.io";
const CENTRE_CERCA = { lat: "41.7", lon: "1.8" };
/** Catalunya (esquerra, dalt, dreta, baix): Nominatim posa primer el que hi cau, sense descartar la resta. */
const MARC_CERCA = "0.16,42.86,3.33,40.52";
const AGENT = process.env.NOMINATIM_AGENT ?? "WineBackend/1.0 (portal de gestió comercial)";
const ESPERA_MS = 8_000;
/** Interval mínim entre consultes, per la política d'ús de Nominatim. */
const PAUSA_MS = 1_100;

export type Coordenades = { latitud: number; longitud: number };

/**
 * Nominatim ha tallat l'aixeta (429 o 403): no és que l'adreça no existeixi,
 * és que ara no respon a ningú. Es distingeix perquè qui geocodifica no marqui
 * el compte com a impossible de situar.
 */
export class ErrorLimitGeocodificacio extends Error {
  constructor(readonly estat: number) {
    super(`OpenStreetMap ha limitat les consultes (HTTP ${estat}). Deixa passar una estona i torna-ho a provar.`);
    this.name = "ErrorLimitGeocodificacio";
  }
}

/** Adreça en trossos, del més precís al més general. */
export type AdrecaCercable = {
  adreca?: string | null;
  codiPostal?: string | null;
  poblacio?: string | null;
  comarca?: string | null;
  provincia?: string | null;
  pais?: string | null;
};

let darrera = 0;

async function espera() {
  const fa = Date.now() - darrera;
  if (fa < PAUSA_MS) await new Promise((seguir) => setTimeout(seguir, PAUSA_MS - fa));
  darrera = Date.now();
}

type FilaNominatim = {
  lat?: string;
  lon?: string;
  category?: string;
  addresstype?: string;
  address?: { city?: string; town?: string; village?: string; municipality?: string; postcode?: string };
};

/** Sense accents, majúscules ni espais de més, per comparar noms de poble. */
const pla = (text?: string | null) =>
  (text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Si el que ha trobat és al poble que es buscava. Una adreça que no existeix
 * en un poble, Nominatim la troba en un altre: «Carrer del Doctor Sobrequés»
 * de Girona surt a Bescanó. Val si el poble coincideix (un dins de l'altre,
 * que «Sant Cugat» i «Sant Cugat del Vallès» són el mateix) o, si el nom no
 * quadra perquè l'un és en castellà i l'altre en català, si el codi postal sí.
 */
function alPoble(fila: FilaNominatim, poblacio: string, codiPostal: string) {
  const buscat = pla(poblacio);
  if (!buscat) return true;
  const trobat = [fila.address?.city, fila.address?.town, fila.address?.village, fila.address?.municipality].map(pla).filter(Boolean);
  if (trobat.some((nom) => nom === buscat || nom.includes(buscat) || buscat.includes(nom))) return true;
  return Boolean(codiPostal) && pla(fila.address?.postcode) === pla(codiPostal);
}

/**
 * Quan la cerca no porta carrer, un resultat de carrer és un fals positiu: hi
 * ha un «Carrer de Copenhaguen» a Sabadell, i un compte de Copenhaguen no hi
 * viu. Quan en porta, el resultat ha de ser al poble que es buscava. Es
 * demanen uns quants resultats i es tria el primer que serveix.
 */
function serveix(fila: FilaNominatim, cerca: Cerca) {
  if (!fila.lat || !fila.lon) return false;
  if (cerca.ambCarrer) return alPoble(fila, cerca.poblacio, cerca.codiPostal);
  return fila.category !== "highway" && fila.addresstype !== "road";
}

type Cerca = { cerca: string; ambCarrer: boolean; poblacio: string; codiPostal: string };

async function consulta(cerca: Cerca): Promise<Coordenades | null> {
  await espera();

  const parametres = new URLSearchParams({ q: cerca.cerca, format: "jsonv2", limit: "5", addressdetails: "1" });
  const resposta = await fetch(`${BASE}/search?${parametres}`, {
    headers: { "User-Agent": AGENT, "Accept-Language": "ca,es,en" },
    cache: "no-store",
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (resposta.status === 429 || resposta.status === 403 || resposta.status === 503) {
    throw new ErrorLimitGeocodificacio(resposta.status);
  }
  if (!resposta.ok) return null;

  const files = (await resposta.json()) as FilaNominatim[];
  const bona = files.find((fila) => serveix(fila, cerca));
  if (!bona) return null;

  const latitud = Number(bona.lat);
  const longitud = Number(bona.lon);
  return Number.isFinite(latitud) && Number.isFinite(longitud) ? { latitud, longitud } : null;
}

/**
 * Prova primer amb l'adreça sencera i, si no la troba, va afluixant fins a la
 * població: val més situar un compte al mig del seu poble que no situar-lo.
 */
export async function geocodifica(adreca: AdrecaCercable): Promise<Coordenades | null> {
  const net = (valor?: string | null) => (valor ?? "").trim();
  const poblacio = net(adreca.poblacio);
  const comarca = net(adreca.comarca);
  const provincia = net(adreca.provincia);
  const pais = net(adreca.pais) || "Espanya";

  // El carrer i el número, sense pis ni porta: amb «4 BX 3» Nominatim no troba res.
  const { carrer, via, nom, numero } = carrerPerGeocodificar(adreca.adreca);
  const codiPostal = net(adreca.codiPostal);
  // El nom de la via sense el tipus: «Calle Bonaventura Carreras» no es troba
  // perquè al mapa és «Carrer de Bonaventura Carreras»; «Bonaventura Carreras» sí.
  const nomINumero = nom && numero ? `${nom}, ${numero}` : null;
  const intents: Cerca[] = [
    { parts: [carrer, codiPostal, poblacio, provincia, pais], ambCarrer: Boolean(carrer) },
    // El codi postal de la fitxa no sempre és el que té OpenStreetMap: sense, el número es troba igual.
    { parts: [carrer, poblacio, pais], ambCarrer: Boolean(carrer) },
    { parts: [nomINumero, poblacio, pais], ambCarrer: Boolean(nomINumero) },
    // Si el número no hi és al mapa, val més el carrer que el mig del poble.
    { parts: [via, poblacio, pais], ambCarrer: Boolean(via) },
    { parts: [nom, poblacio, pais], ambCarrer: Boolean(nom) },
    { parts: [codiPostal, poblacio, pais], ambCarrer: false },
    // Amb comarca es desfan molts homònims: hi ha més d'un Sant Martí.
    { parts: [poblacio, comarca, provincia, pais], ambCarrer: false },
    { parts: [poblacio, provincia, pais], ambCarrer: false },
    { parts: [poblacio, pais], ambCarrer: false },
  ]
    .map(({ parts, ambCarrer }) => ({ cerca: parts.filter(Boolean).join(", "), ambCarrer, poblacio, codiPostal }))
    .filter(
      ({ cerca }, i, totes) => cerca.length > 0 && totes.findIndex((altra) => altra.cerca === cerca) === i,
    );

  for (const cerca of intents) {
    try {
      const trobat = await consulta(cerca);
      if (trobat) return trobat;
    } catch (error) {
      // El límit de peticions atura tota la tanda: insistir només l'allarga.
      if (error instanceof ErrorLimitGeocodificacio) throw error;
      // Xarxa o temps d'espera: es prova la següent forma, més general.
    }
  }
  return null;
}

export type LlocTrobat = Coordenades & { nom: string };

/**
 * Cerca lliure per triar un punt a mà: retorna uns quants candidats amb el nom
 * sencer, perquè qui busca «Sant Martí» pugui triar quin. Primer l'adreça a
 * Nominatim i, si no en surt res, el nom a Photon.
 */
export async function cercaLlocs(text: string, maxim = 5): Promise<LlocTrobat[]> {
  const cerca = text.trim();
  if (!cerca) return [];

  const perAdreca = await cercaANominatim(cerca, maxim);
  if (perAdreca.length > 0) return perAdreca;
  return cercaAPhoton(cerca, maxim);
}

async function cercaANominatim(cerca: string, maxim: number): Promise<LlocTrobat[]> {
  await espera();
  const parametres = new URLSearchParams({ q: cerca, format: "jsonv2", limit: String(maxim), viewbox: MARC_CERCA });
  const resposta = await fetch(`${BASE}/search?${parametres}`, {
    headers: { "User-Agent": AGENT, "Accept-Language": "ca,es,en" },
    cache: "no-store",
    signal: AbortSignal.timeout(ESPERA_MS),
  });
  if (resposta.status === 429 || resposta.status === 403 || resposta.status === 503) {
    throw new ErrorLimitGeocodificacio(resposta.status);
  }
  if (!resposta.ok) return [];

  const files = (await resposta.json()) as (FilaNominatim & { display_name?: string })[];
  return files
    .map((fila) => ({ nom: fila.display_name ?? "", latitud: Number(fila.lat), longitud: Number(fila.lon) }))
    .filter((lloc) => lloc.nom && Number.isFinite(lloc.latitud) && Number.isFinite(lloc.longitud));
}

type TretPhoton = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string; street?: string; housenumber?: string; postcode?: string; city?: string;
    county?: string; state?: string; country?: string; osm_value?: string;
  };
};

/** El nom d'un lloc de Photon, del més concret al més general, sense repetir-se. */
function nomDePhoton(p: NonNullable<TretPhoton["properties"]>) {
  const carrer = [p.street, p.housenumber].filter(Boolean).join(" ");
  const trossos = [p.name, carrer, [p.postcode, p.city].filter(Boolean).join(" "), p.county, p.country]
    .map((tros) => (tros ?? "").trim())
    .filter((tros, i, tots) => tros && tots.indexOf(tros) === i);
  const mena = p.osm_value && p.osm_value !== "yes" ? ` (${p.osm_value.replace(/_/g, " ")})` : "";
  return trossos.join(", ") + mena;
}

async function cercaAPhoton(cerca: string, maxim: number): Promise<LlocTrobat[]> {
  const parametres = new URLSearchParams({
    q: cerca, limit: String(maxim), ...CENTRE_CERCA, zoom: "8", location_bias_scale: "0.6",
  });
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_PHOTON}/api/?${parametres}`, {
      headers: { "User-Agent": AGENT },
      cache: "no-store",
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch {
    return [];
  }
  if (resposta.status === 429 || resposta.status === 403 || resposta.status === 503) {
    throw new ErrorLimitGeocodificacio(resposta.status);
  }
  if (!resposta.ok) return [];

  const cos = (await resposta.json()) as { features?: TretPhoton[] };
  return (cos.features ?? [])
    .map((tret) => ({
      nom: tret.properties ? nomDePhoton(tret.properties) : "",
      longitud: Number(tret.geometry?.coordinates?.[0]),
      latitud: Number(tret.geometry?.coordinates?.[1]),
    }))
    .filter((lloc) => lloc.nom && Number.isFinite(lloc.latitud) && Number.isFinite(lloc.longitud));
}
