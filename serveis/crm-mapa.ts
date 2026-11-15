/**
 * Els comptes situats al mapa.
 *
 * Cada client surt als seus establiments, que són les direccions d'entrega de
 * FactuSol (vegeu `domini/establiments.ts`): un punt per establiment, tots
 * lligats al client. El client que no en té cap surt a la seva adreça, com
 * sempre.
 *
 * Les coordenades viuen a Directus, al costat de la resta de la fitxa: el
 * portal no en manté cap còpia. Les que encara no hi són es calculen amb
 * `ubicaComptesPendents`, que pregunta a Nominatim i desa el resultat. Els
 * clients també se situen encara que surtin pels seus establiments: els
 * segments per ubicació i la comarca fan servir l'adreça del client.
 */
import "server-only";

import { geocodifica, type Coordenades } from "@/apis/geocodificacio";
import { actualitzaItem, llistaAmbTotal } from "@/apis/directus/crm";
import { FITXES, condicionsExcloses, esLletra } from "@/domini/crm-fitxes";
import type { PuntCompte } from "@/domini/crm-mapa";
import { COLOR_SENSE_SEGMENT, SENSE_SEGMENT } from "@/domini/crm-planner";
import { CAMPS_VARIABLES, aplanaVariables, pertany, titolDeRelacio } from "@/domini/crm-segments";
import { esUbicable } from "@/domini/establiments";
import { nomDeLloc } from "@/lib/format";
import { COLLECCIO_ESTABLIMENTS, ESTABLIMENTS_DENTREGA, ESTABLIMENTS_VIUS } from "@/serveis/establiments";
import { segmentsActius, type Segment } from "@/serveis/crm-segments";

const COLLECCIO = FITXES.clients.colleccio;

/**
 * Les columnes del mapa, més totes les que un segment pot filtrar: els punts
 * es pinten pel segment on cauen i això s'avalua aquí mateix. El tipus de
 * client hi entra per ser variable de segment, amb el nom de la seva fitxa.
 */
const CAMPS = [
  "id", "nom_comercial", "adreca", "codi_postal", "poblacio", "comarca", "provincia", "pais",
  "categoria", "potencial", "estat", "latitud", "longitud",
  ...CAMPS_VARIABLES,
].filter((nom, i, tots) => tots.indexOf(nom) === i);

/** El que cal d'una fitxa amb adreça per situar-la: un client o un establiment. */
type FilaAmbAdreca = {
  id: string;
  adreca: string | null;
  codi_postal: string | null;
  poblacio: string | null;
  comarca?: string | null;
  provincia: string | null;
  pais: string | null;
  latitud: number | string | null;
  longitud: number | string | null;
};

type FilaCompte = Record<string, unknown> & FilaAmbAdreca & {
  nom_comercial: string | null;
  comarca: string | null;
  /** L'id del tipus de client, un cop aplanada la relació; el nom va a part. */
  tipus_client: string | null;
  categoria: string | null;
  potencial: string | null;
  estat: string | null;
};

type FilaEstabliment = FilaAmbAdreca & { client: string | null; nom: string | null };

const CAMPS_ESTABLIMENT = ["id", "client", "nom", "adreca", "codi_postal", "poblacio", "provincia", "pais", "latitud", "longitud"];

/** Un segment que surt al mapa, per al selector de dalt. */
export type SegmentDelMapa = { id: string; nom: string; color: string; quants: number };

/** Un client o un establiment que no surt al mapa perquè no se sap on és. */
export type PendentDelMapa = {
  id: string;
  /** El client de qui és: on porta l'enllaç. */
  clientId: string;
  nom: string;
  poblacio: string;
  /** Si és un establiment: l'enllaç porta a la seva pestanya. */
  establiment: boolean;
  ubicable: boolean;
  provat: boolean;
};

export type MapaComptes = {
  punts: PuntCompte[];
  /** Els segments amb comptes situats, per poder-los destacar. */
  segments: SegmentDelMapa[];
  /** El que no surt al mapa perquè no té coordenades: o s'ha de provar, o ja s'ha provat sense sort. */
  pendents: PendentDelMapa[];
  /** Quants clients hi ha i quants surten al mapa, per algun establiment o per la seva adreça. */
  total: number;
  situats: number;
  /** Quants es poden provar ara mateix: si és zero, no cal moure res. */
  perProvar: number;
};

function coordenada(valor: number | string | null) {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** Les coordenades d'una fitxa, o null si no en té. */
function coordenades(fila: FilaAmbAdreca): Coordenades | null {
  const latitud = coordenada(fila.latitud);
  const longitud = coordenada(fila.longitud);
  return latitud !== null && longitud !== null ? { latitud, longitud } : null;
}

/**
 * Adreces que OpenStreetMap no ha sabut situar, per no tornar-hi a cada tanda.
 * Es recorda amb quina adreça va fallar: si algú la corregeix, la signatura
 * canvia i es torna a provar. Viu en memòria del procés, de manera que un
 * reinici del servei també li dona una altra oportunitat. Hi van clients i
 * establiments, que tenen ids diferents.
 */
const fallits = new Map<string, string>();

/** Oblida els fallits: tot el que no té coordenades es torna a provar. */
export function reiniciaFallits() {
  fallits.clear();
}

function signaturaAdreca(fila: FilaAmbAdreca) {
  return [fila.adreca, fila.codi_postal, fila.poblacio, fila.comarca, fila.provincia, fila.pais]
    .map((tros) => (tros ?? "").trim().toLowerCase())
    .join("|");
}

function provat(fila: FilaAmbAdreca) {
  return fallits.get(fila.id) === signaturaAdreca(fila);
}

/**
 * Els comptes que surten al CRM: sense els de baixa i només dels tipus de
 * client que es treballen. El mapa és de la cartera viva, i els altres tampoc
 * cal ubicar-los, perquè no entren a cap segment.
 */
const DEL_CRM = condicionsExcloses(FITXES.clients);

function llegeixClients() {
  return llistaAmbTotal<FilaCompte>(COLLECCIO, { camps: CAMPS, ordre: "nom_comercial", limit: -1, condicions: DEL_CRM });
}

/**
 * Els establiments vius, agrupats per client. Si la col·lecció encara no hi és
 * (no s'ha executat l'script de Directus), el mapa surt com abans: cada client
 * a la seva adreça.
 */
async function establimentsPerClient(): Promise<Map<string, FilaEstabliment[]>> {
  let files: FilaEstabliment[];
  try {
    ({ files } = await llistaAmbTotal<FilaEstabliment>(COLLECCIO_ESTABLIMENTS, {
      camps: CAMPS_ESTABLIMENT,
      ordre: "erp_codi",
      limit: -1,
      // Les adreces marcades a FactuSol per a parts de reparació no són punts
      // d'entrega: ni es pinten ni es geocodifiquen. Un client que només en té
      // d'aquestes surt a la seva adreça, com si no tingués cap establiment.
      condicions: [ESTABLIMENTS_VIUS, ESTABLIMENTS_DENTREGA],
    }));
  } catch {
    return new Map();
  }
  const perClient = new Map<string, FilaEstabliment[]>();
  for (const establiment of files) {
    if (!establiment.client) continue;
    const llista = perClient.get(establiment.client);
    if (llista) llista.push(establiment);
    else perClient.set(establiment.client, [establiment]);
  }
  return perClient;
}

/** L'adreça d'un punt en una línia, per al rètol: el carrer i el poble. */
function adrecaEnUnaLinia(fila: FilaAmbAdreca) {
  return [fila.adreca?.trim(), nomDeLloc(fila.poblacio)].filter(Boolean).join(", ");
}

export async function comptesDelMapa(): Promise<MapaComptes> {
  const [{ files }, perClient, segments] = await Promise.all([llegeixClients(), establimentsPerClient(), segmentsActius()]);

  const vius = files.map(aplanaVariables);
  const punts: PuntCompte[] = [];
  const pendents: PendentDelMapa[] = [];
  const compta = new Map<string, number>();
  let situats = 0;
  // Els clients que la tanda situarà encara que no surtin a la llista de pendents.
  let clientsPerProvar = 0;

  /** El de més prioritat: al mapa un punt només pot dur un color. */
  const segmentDe = (fila: FilaCompte): Segment | undefined =>
    segments.find((segment) => pertany(segment, fila));

  for (const fila of vius) {
    const nom = fila.nom_comercial ?? "Sense nom";
    const segment = segmentDe(fila);
    const puntDe = (lloc: FilaAmbAdreca, on: Coordenades, establiment: string | null): PuntCompte => ({
      id: lloc.id,
      clientId: fila.id,
      nom,
      establiment,
      adreca: adrecaEnUnaLinia(lloc),
      latitud: on.latitud,
      longitud: on.longitud,
      poblacio: nomDeLloc(lloc.poblacio),
      tipusClient: titolDeRelacio(fila, "tipus_client"),
      agentId: typeof fila.agent === "string" ? fila.agent : "",
      agent: titolDeRelacio(fila, "agent"),
      categoria: esLletra(fila.categoria) ? fila.categoria : null,
      potencial: esLletra(fila.potencial) ? fila.potencial : null,
      segmentId: segment?.id ?? "",
      segment: segment?.nom ?? SENSE_SEGMENT,
      color: segment?.color ?? COLOR_SENSE_SEGMENT,
    });

    // Un establiment sense carrer ni poble no es pot situar: és com si no hi fos.
    const propis = (perClient.get(fila.id) ?? []).filter(esUbicable);
    const ambPunt = propis.flatMap((establiment) => {
      const on = coordenades(establiment);
      return on ? [puntDe(establiment, on, establiment.nom?.trim() || "Establiment")] : [];
    });
    const delClient = coordenades(fila);

    // Mentre cap establiment no té punt, el client surt a la seva adreça, si en té.
    const alMapa = ambPunt.length > 0 ? ambPunt : delClient ? [puntDe(fila, delClient, null)] : [];
    punts.push(...alMapa);
    if (alMapa.length > 0) {
      situats += 1;
      if (segment) compta.set(segment.id, (compta.get(segment.id) ?? 0) + 1);
    }

    for (const establiment of propis) {
      if (coordenades(establiment)) continue;
      pendents.push({
        id: establiment.id,
        clientId: fila.id,
        nom: `${nom} · ${establiment.nom?.trim() || "Establiment"}`,
        poblacio: nomDeLloc(establiment.poblacio),
        establiment: true,
        ubicable: true,
        provat: provat(establiment),
      });
    }

    if (!delClient) {
      const ubicable = esUbicable(fila);
      // Amb establiments, el client no falta al mapa: només se'l situa per als segments.
      if (propis.length > 0) {
        if (ubicable && !provat(fila)) clientsPerProvar += 1;
      } else {
        pendents.push({ id: fila.id, clientId: fila.id, nom, poblacio: nomDeLloc(fila.poblacio), establiment: false, ubicable, provat: provat(fila) });
      }
    }
  }

  return {
    punts,
    // Al selector, només els segments que tenen algun compte situat.
    segments: segments
      .filter((segment) => (compta.get(segment.id) ?? 0) > 0)
      .map(({ id, nom, color }) => ({ id, nom, color, quants: compta.get(id) ?? 0 })),
    pendents,
    total: vius.length,
    situats,
    perProvar: pendents.filter((pendent) => pendent.ubicable && !pendent.provat).length + clientsPerProvar,
  };
}

export type ResultatUbicacio = { ubicats: number; fallits: number; queden: number };

/**
 * Situa el que encara no ho està, per tandes: Nominatim admet una consulta per
 * segon, així que una tanda gran deixaria la petició penjada massa estona. Qui
 * la crida va repetint mentre `queden` sigui més gran que zero.
 *
 * Cada tanda deixa cada fitxa resolta o marcada com a fallida, de manera que
 * la llista de pendents sempre minva i les rondes s'acaben.
 */
export function ubicaComptesPendents(maxim = 6): Promise<ResultatUbicacio> {
  // Una tanda alhora a tot el procés: el mapa obert i el programador no s'han
  // de trepitjar, que situarien el mateix compte dues vegades.
  const tanda = cuaUbicacio.then(() => tandaUbicacio(maxim));
  cuaUbicacio = tanda.catch(() => undefined);
  return tanda;
}

let cuaUbicacio: Promise<unknown> = Promise.resolve();
let seguidaEnMarxa = false;
/** Final segur, com al mapa: a sis per tanda, són uns 3.000 comptes i establiments. */
const RONDES_MAXIMES = 500;

/**
 * Tandes seguides fins que no en queda cap per provar, sense ningú mirant.
 * Així un client o un establiment nou, o que ha canviat d'adreça, té
 * coordenades aviat i surt al mapa (i als segments per ubicació) encara que
 * ningú l'obri. Si ja n'hi ha una en marxa, no se n'engega una altra. El límit
 * d'OpenStreetMap es propaga.
 */
export async function ubicaTotsElsPendents(): Promise<ResultatUbicacio> {
  const total: ResultatUbicacio = { ubicats: 0, fallits: 0, queden: 0 };
  if (seguidaEnMarxa) return total;
  seguidaEnMarxa = true;
  try {
    for (let ronda = 0; ronda < RONDES_MAXIMES; ronda += 1) {
      const tanda = await ubicaComptesPendents();
      total.ubicats += tanda.ubicats;
      total.fallits += tanda.fallits;
      total.queden = tanda.queden;
      if (tanda.queden === 0 || (tanda.ubicats === 0 && tanda.fallits === 0)) break;
    }
    return total;
  } finally {
    seguidaEnMarxa = false;
  }
}

const pla = (valor: string | null | undefined) => (valor ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Si un establiment és a la mateixa adreça que el seu client: el carrer i el
 * poble iguals, i el codi postal també si tots dos en tenen. Passa sovint (el
 * local és on factura) i llavors el punt es copia sense preguntar a ningú.
 */
function mateixaAdreca(establiment: FilaAmbAdreca, client: FilaAmbAdreca) {
  if (!pla(establiment.adreca) || pla(establiment.adreca) !== pla(client.adreca)) return false;
  if (pla(establiment.poblacio) !== pla(client.poblacio)) return false;
  const [a, b] = [pla(establiment.codi_postal), pla(client.codi_postal)];
  return !a || !b || a === b;
}

type PerUbicar = { colleccio: string; fila: FilaAmbAdreca; client: FilaCompte | null };

async function tandaUbicacio(maxim: number): Promise<ResultatUbicacio> {
  const [{ files: clients }, perClient] = await Promise.all([llegeixClients(), establimentsPerClient()]);

  // Primer els clients, com sempre; després els establiments dels clients que surten al mapa.
  const perUbicar: PerUbicar[] = [
    ...clients.map((fila) => ({ colleccio: COLLECCIO, fila, client: null })),
    ...clients.flatMap((client) =>
      (perClient.get(client.id) ?? []).map((fila) => ({ colleccio: COLLECCIO_ESTABLIMENTS, fila, client })),
    ),
  ].filter(({ fila }) => !coordenades(fila) && esUbicable(fila) && !provat(fila));

  let ubicats = 0;
  let errats = 0;
  let consultes = 0;

  for (const { colleccio, fila, client } of perUbicar) {
    // Els que es copien del client no pregunten a ningú: només les consultes compten per a la tanda.
    const copiat = client && mateixaAdreca(fila, client) ? coordenades(client) : null;
    if (!copiat && consultes >= maxim) break;

    let trobat = copiat;
    if (!trobat) {
      consultes += 1;
      // Si OpenStreetMap talla l'aixeta, `geocodifica` llança l'error i la tanda
      // s'atura aquí: el que queda no és culpa de l'adreça i no es marca fallit.
      trobat = await geocodifica({
        adreca: fila.adreca,
        codiPostal: fila.codi_postal,
        poblacio: fila.poblacio,
        // Un establiment no té comarca: si és al poble del client, val la seva, que desfà homònims.
        comarca: fila.comarca ?? (client && pla(fila.poblacio) === pla(client.poblacio) ? client.comarca : null),
        provincia: fila.provincia,
        pais: fila.pais,
      });
    }

    if (!trobat) {
      fallits.set(fila.id, signaturaAdreca(fila));
      errats += 1;
      continue;
    }

    await actualitzaItem(colleccio, fila.id, { latitud: trobat.latitud, longitud: trobat.longitud });
    // També aquí: els establiments del mateix client que venen després ja el poden copiar.
    fila.latitud = trobat.latitud;
    fila.longitud = trobat.longitud;
    fallits.delete(fila.id);
    ubicats += 1;
  }

  return { ubicats, fallits: errats, queden: Math.max(0, perUbicar.length - ubicats - errats) };
}
