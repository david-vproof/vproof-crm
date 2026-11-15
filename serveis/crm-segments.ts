/**
 * Els segments i qui hi encaixa.
 *
 * Un segment és una consulta desada, no una etiqueta enganxada a cada fitxa:
 * es llegeixen els segments, es llegeixen els comptes i s'avalua. Els criteris
 * arriben d'un camp JSON de Directus, així que sempre es tornen a validar.
 */
import "server-only";

import { activitatsPerCompte, llistaAmbTotal, oportunitatsObertesPerCompte } from "@/apis/directus/crm";
import { FITXES, condicionsExcloses } from "@/domini/crm-fitxes";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { nomDeLloc } from "@/lib/format";
import { llegeixHorari, type Horari } from "@/domini/crm-horaris";
import { colorSegment } from "@/domini/crm-planner";
import {
  CAMPS_VARIABLES,
  aplanaVariables,
  llegeixCriteris,
  titolDeRelacio,
  llegeixMode,
  pertany,
  type Criteri,
  type DefinicioSegment,
  type Mode,
} from "@/domini/crm-segments";
import { type MarquesClient, marquesDe } from "@/domini/marques-client";
import { type ClientsMarcats, clientsMarcats } from "@/serveis/marques-client";

const COLLECCIO = FITXES.segments.colleccio;
const COLLECCIO_COMPTES = FITXES.clients.colleccio;

/**
 * Els camps del compte que fan falta per avaluar qualsevol criteri, més els que
 * la pantalla ensenya al costat. L'horari no és filtrable però sí que cal per
 * avisar quan una visita cau quan el compte és tancat.
 */
const CAMPS_COMPTE = ["id", "nom_comercial", "horari_comercial", "notes", ...CAMPS_VARIABLES, ...CAMPS_RESUM_FACTURACIO].filter(
  (nom, i, tots) => tots.indexOf(nom) === i,
);

export type Segment = {
  id: string;
  nom: string;
  codi: string;
  color: string;
  ordre: number;
  mode: Mode;
  criteris: Criteri[];
};

export type CompteSegmentable = Record<string, unknown> & { id: string; nom_comercial: string | null };

type FilaSegment = {
  id: string;
  nom: string | null;
  codi: string | null;
  estat: string | null;
  ordre: number | null;
  mode: string | null;
  criteris: unknown;
};

/**
 * Els segments actius, en ordre de prioritat. El color surt de l'ordre d'alta i
 * no del nom ni de la prioritat, així que reordenar-los no els canvia el color.
 */
export async function segmentsActius(): Promise<Segment[]> {
  const { files } = await llistaAmbTotal<FilaSegment>(COLLECCIO, {
    camps: ["id", "nom", "codi", "estat", "ordre", "mode", "criteris"],
    ordre: "date_created",
    limit: -1,
  });

  return files
    .map((fila, posicio) => ({
      id: fila.id,
      nom: fila.nom ?? "Sense nom",
      codi: fila.codi ?? "",
      color: colorSegment(posicio),
      ordre: fila.ordre ?? 100,
      mode: llegeixMode(fila.mode),
      criteris: llegeixCriteris(fila.criteris),
      actiu: fila.estat !== "inactiu",
    }))
    .filter((segment) => segment.actiu)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "ca"));
}

export async function comptesPerSegmentar(): Promise<CompteSegmentable[]> {
  const { files } = await llistaAmbTotal<CompteSegmentable>(COLLECCIO_COMPTES, {
    camps: CAMPS_COMPTE,
    ordre: "nom_comercial",
    limit: -1,
    // Els clients de baixa, i els dels tipus que no es treballen, no entren a cap segment.
    condicions: condicionsExcloses(FITXES.clients),
  });
  return files.map(aplanaVariables);
}

/**
 * A quin segment va cada compte. Un compte pot complir més d'un segment; es
 * queda amb el de més prioritat, perquè el calendari l'ha de pintar d'un color.
 */
export function repartimentPerSegment(comptes: CompteSegmentable[], segments: Segment[]) {
  const dequi = new Map<string, Segment>();

  for (const compte of comptes) {
    const trobat = segments.find((segment) => pertany(segment, compte));
    if (trobat) dequi.set(compte.id, trobat);
  }

  return dequi;
}

/** El compte tal com surt al llistat d'un segment, amb el que se'n vol saber. */
export type CompteDelSegment = {
  id: string;
  nom: string;
  tipusClient: string;
  categoria: string;
  potencial: string;
  poblacio: string;
  comarca: string;
  estat: string;
  activitats: number;
  darrera: string | null;
  oportunitats: number;
  /** Quan s'hi pot anar a vendre, per avisar si la ronda cau a fora. */
  horariComercial: Horari;
  /** El resum de facturació, per pintar-lo com a la llista de clients. */
  facturacio: Record<string, unknown>;
  /** El que s'ha anotat del client: es llegeix també aquí, retallat i desplegable. */
  notes: string;
  /** Les seves marques, si en té: la «!» dels To-Do i la «A» dels atributs. */
  marques?: MarquesClient;
};

export type SegmentAmbComptes = Segment & { comptes: CompteDelSegment[] };

export type LlistatSegments = {
  segments: SegmentAmbComptes[];
  /** Comptes que no encaixen en cap segment: convé no perdre'ls de vista. */
  senseSegment: number;
  /** Els mateixos, sencers: fan de segment automàtic, que no s'edita. */
  clientsSenseSegment: CompteDelSegment[];
  totalComptes: number;
};

function text(valor: unknown) {
  return valor === null || valor === undefined ? "" : String(valor);
}

/** El compte tal com surt al llistat d'un segment, amb la seva activitat i el que té obert. */
function enriquit(
  compte: CompteSegmentable,
  activitats: Map<string, { quantes: number; darrera: string | null }>,
  oportunitats: Map<string, number>,
  marcats: ClientsMarcats,
): CompteDelSegment {
  const resum = activitats.get(compte.id);
  return {
    id: compte.id,
    nom: compte.nom_comercial ?? "Sense nom",
    tipusClient: titolDeRelacio(compte, "tipus_client"),
    categoria: text(compte.categoria),
    potencial: text(compte.potencial),
    poblacio: nomDeLloc(text(compte.poblacio)),
    comarca: nomDeLloc(text(compte.comarca)),
    estat: text(compte.estat),
    activitats: resum?.quantes ?? 0,
    darrera: resum?.darrera ?? null,
    oportunitats: oportunitats.get(compte.id) ?? 0,
    horariComercial: llegeixHorari(compte.horari_comercial),
    notes: text(compte.notes),
    facturacio: Object.fromEntries(CAMPS_RESUM_FACTURACIO.map((camp) => [camp, compte[camp] ?? null])),
    marques: marquesDe(compte.id, marcats),
  };
}

/** Fins on arriba una planificació: prou per a qualsevol ronda. */
const MAXIM_PLANIFICACIO = 500;

/**
 * Els clients triats a mà per planificar-los sense crear cap segment, amb el
 * mateix que se'n veu en un segment. Els ids arriben del navegador: només
 * compten els que són clients del CRM (ni de baixa ni d'un altre tipus), en l'ordre rebut.
 */
export async function comptesPerPlanificar(ids: string[]): Promise<CompteDelSegment[]> {
  const unics = [...new Set(ids)].slice(0, MAXIM_PLANIFICACIO);
  const [comptes, activitats, oportunitats, marcats] = await Promise.all([
    comptesPerSegmentar(),
    activitatsPerCompte(),
    oportunitatsObertesPerCompte(),
    clientsMarcats(),
  ]);
  const perId = new Map(comptes.map((compte) => [compte.id, compte]));
  return unics
    .map((id) => perId.get(id))
    .filter((compte): compte is CompteSegmentable => Boolean(compte))
    .map((compte) => enriquit(compte, activitats, oportunitats, marcats));
}

/**
 * Els segments amb la seva gent a dins, i de cada compte el que importa per
 * decidir: tipus de client, categoria i potencial, on és, quanta activitat porta i què hi ha obert.
 *
 * Un compte surt a tots els segments que compleix, no només al de més
 * prioritat: aquí s'està revisant la definició, i amagar-ne la meitat enganya.
 * La prioritat només mana quan cal triar-ne un de sol, com al calendari.
 */
export async function segmentsAmbComptes(cerca = ""): Promise<LlistatSegments> {
  const [segments, comptes, activitats, oportunitats, marcats] = await Promise.all([
    segmentsActius(),
    comptesPerSegmentar(),
    activitatsPerCompte(),
    oportunitatsObertesPerCompte(),
    clientsMarcats(),
  ]);

  const enriqueix = (compte: CompteSegmentable) => enriquit(compte, activitats, oportunitats, marcats);

  const terme = cerca.trim().toLowerCase();
  const triats = terme
    ? segments.filter(
        (segment) =>
          segment.nom.toLowerCase().includes(terme) || segment.codi.toLowerCase().includes(terme),
      )
    : segments;

  const ambComptes: SegmentAmbComptes[] = triats.map((segment) => ({
    ...segment,
    comptes: comptes.filter((compte) => pertany(segment, compte)).map(enriqueix),
  }));

  const encaixats = new Set<string>();
  for (const segment of segments) {
    for (const compte of comptes) if (pertany(segment, compte)) encaixats.add(compte.id);
  }

  return {
    segments: ambComptes,
    senseSegment: comptes.length - encaixats.size,
    clientsSenseSegment: comptes.filter((compte) => !encaixats.has(compte.id)).map(enriqueix),
    totalComptes: comptes.length,
  };
}

export type ResultatProva = {
  total: number;
  deQuants: number;
  comptes: { id: string; nom: string }[];
};

/** Fins on s'estira la llista que es retorna: prou per revisar-la a ull. */
const MAXIM_LLISTA = 300;

/** Qui agafaria una definició, per poder-ho veure mentre es munta. */
export async function provaSegment(definicio: DefinicioSegment): Promise<ResultatProva> {
  const comptes = await comptesPerSegmentar();
  const encaixen = comptes.filter((compte) => pertany(definicio, compte));

  return {
    total: encaixen.length,
    deQuants: comptes.length,
    comptes: encaixen.slice(0, MAXIM_LLISTA).map((compte) => ({
      id: compte.id,
      nom: compte.nom_comercial ?? "Sense nom",
    })),
  };
}
