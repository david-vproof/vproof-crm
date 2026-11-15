/**
 * La cerca del selector de clients: el modal que surt a tot el CRM quan cal
 * triar un client. Filtra amb els filtres de la pantalla de clients, amb un
 * segment desat —o amb els clients que no en tenen cap— i amb els criteris que
 * s'hi retoquin només per a aquesta cerca.
 *
 * S'avalua aquí, sobre els mateixos clients que es llegeixen per als segments:
 * així un filtre i un criteri de segment volen dir exactament el mateix, i els
 * clients de baixa, o dels tipus que no es treballen, ja en queden fora.
 */
import "server-only";

import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { nomDeLloc } from "@/lib/format";
import { compleix, pertany, titolDeRelacio, variable, type Criteri, type DefinicioSegment, type Operador } from "@/domini/crm-segments";
import { opcionsPerFiltrar } from "@/serveis/crm-manteniment";
import { comptesPerSegmentar, segmentsActius } from "@/serveis/crm-segments";

/** Els filtres fixos del selector: els de la pantalla de clients. */
export const FILTRES_CLIENTS = ["tipus_client", "agent", "estat", "categoria", "potencial", "poblacio"];

/** El filtre de tendència de facturació, que va a part: no és cap variable de segment. */
export const FILTRE_TENDENCIA = "facturacio_tendencia";

/** On busca la caixa de text. */
const CAMPS_CERCA = ["nom_comercial", "rao_social", "nif", "poblacio", "comarca"];

/** Fins on s'estira la llista: prou per triar a ull i prou poc per anar lleuger. */
const MAXIM = 200;

export type ClientTrobat = {
  id: string;
  nom: string;
  detall: string;
  /** Les dues lletres que van al costat del nom: la categoria, calculada, i el potencial, posat a mà. */
  categoria: string;
  potencial: string;
  /** Va en pastilla al costat del nom, com a la llista de clients. */
  tipusClient: string;
  /** El que s'ha anotat del client, per llegir-lo sense sortir del selector. */
  notes: string;
  /** El resum de facturació, per pintar-lo com a la llista de clients. */
  facturacio: Record<string, unknown>;
};

export type PeticioClients = {
  cerca: string;
  filtres: Record<string, string>;
  /** Els criteris del segment triat, tal com s'han retocat. Sense segment, res. */
  definicio: DefinicioSegment | null;
  /** Només els clients que no encaixen en cap segment actiu. */
  senseSegment: boolean;
};

function text(valor: unknown) {
  return valor === null || valor === undefined ? "" : String(valor);
}

export async function cercaClients(peticio: PeticioClients): Promise<{ files: ClientTrobat[]; total: number }> {
  const [comptes, segments] = await Promise.all([
    comptesPerSegmentar(),
    peticio.senseSegment ? segmentsActius() : Promise.resolve([]),
  ]);

  const terme = peticio.cerca.trim();
  // Un filtre de desplegable és un «és»; el de població, un «conté».
  const filtres: Criteri[] = Object.entries(peticio.filtres)
    .filter(([camp, valor]) => valor && FILTRES_CLIENTS.includes(camp) && variable(camp))
    .map(([camp, valor]) => ({
      camp,
      operador: (variable(camp)!.tipus === "text" ? "conte" : "es") as Operador,
      valors: [valor],
    }));
  // La tendència de facturació no és cap variable de segment: es compara tal qual, com el filtre de la llista.
  const tendencia = String(peticio.filtres[FILTRE_TENDENCIA] ?? "");
  // Un segment al qual s'han tret tots els criteris no restringeix res.
  const definicio = peticio.definicio && peticio.definicio.criteris.length > 0 ? peticio.definicio : null;

  const trobats = comptes.filter(
    (compte) =>
      (!terme || CAMPS_CERCA.some((camp) => compleix({ camp, operador: "conte", valors: [terme] }, compte))) &&
      filtres.every((criteri) => compleix(criteri, compte)) &&
      (!tendencia || compte.facturacio_tendencia === tendencia) &&
      (!definicio || pertany(definicio, compte)) &&
      (!peticio.senseSegment || !segments.some((segment) => pertany(segment, compte))),
  );

  return {
    total: trobats.length,
    files: trobats.slice(0, MAXIM).map((compte) => ({
      id: compte.id,
      nom: compte.nom_comercial ?? "Sense nom",
      detall: nomDeLloc(text(compte.poblacio)),
      categoria: text(compte.categoria),
      potencial: text(compte.potencial),
      tipusClient: titolDeRelacio(compte, "tipus_client"),
      notes: text(compte.notes),
      facturacio: Object.fromEntries(CAMPS_RESUM_FACTURACIO.map((camp) => [camp, compte[camp] ?? null])),
    })),
  };
}

/** El que el selector necessita abans de cercar: els segments per triar i les opcions de relació. */
export async function dadesSelectorClients() {
  const [segments, tipusClient, agents] = await Promise.all([
    segmentsActius(),
    opcionsPerFiltrar("clients", "tipus_client"),
    opcionsPerFiltrar("clients", "agents"),
  ]);
  return {
    segments: segments.map(({ id, nom, color, mode, criteris }) => ({ id, nom, color, mode, criteris })),
    opcionsRelacio: { tipus_client: tipusClient, agents },
  };
}
