/**
 * Manteniment del CRM: llegir, desar i esborrar fitxes.
 *
 * Tot surt de les descripcions de `domini/crm-fitxes`. Les pantalles no saben
 * res de la base de dades ni dels noms de les seves col·leccions.
 */
import "server-only";

import {
  type Condicio, type Pagina, actualitzaItem, actualitzaItems, agrupaPer, creaItem, creaItems, darreraActivitatPerClient, esborraFitxer, esborraItem, llistaAmbTotal, obteItem,
} from "@/apis/sqlite/crm";
import { canvisDeClient, type FilaDelLead } from "@/domini/crm-conversio";
import { motiuFotoNoValida, nomTreuFoto } from "@/domini/foto-activitat";
import { senseAbast } from "@/lib/abast-actual";
import { pujaFotoDActivitat } from "@/serveis/fotos-activitats";
import {
  CLAUS_FITXA,
  FITXES,
  campVisible,
  condicionsDeLesOpcions,
  condicionsExcloses,
  esMultiple,
  esVisiblePer,
  filtreDeRelacio,
  idDeRelacio,
  type Camp,
  type ClauFitxa,
  type Fitxa,
  type TipusCamp,
  veDeFactusol,
} from "@/domini/crm-fitxes";
import { descriuHorari, horariBuitDeTot, llegeixHorari } from "@/domini/crm-horaris";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { type ColumnaLlistat, type Filtres, type OrdreLlistat, columnesDe, menaDeFiltre } from "@/domini/crm-llistat";
import { seguimentDe } from "@/domini/crm-periodicitat";
import { type TramVisita, descriuDarreraVisita, tramDeVisita } from "@/domini/crm-visites";
import { nomDeLloc } from "@/lib/format";
import { type ActivitatsDEnguany, activitatsDEnguany } from "@/serveis/crm-periodicitat";
import { fitxaViva } from "@/serveis/crm-tipus-activitat";
import { avuiLocal, instantDeLocal, momentLocal } from "@/domini/crm-planner";
import { VARIABLES, descriuCriteri, llegeixCriteris, variable } from "@/domini/crm-segments";
import { MAXIM_PRODUCTES_PER_ACTIVITAT, desaProductesDeLActivitat, productesDeLActivitat } from "@/serveis/crm-productes";
import { type MarquesClient, marquesDe } from "@/domini/marques-client";
import { clientsMarcats } from "@/serveis/marques-client";

export const PER_PAGINA = 20;

export type ValorsFitxa = Record<string, unknown>;
/** Una opció d'un desplegable. Els productes porten també d'on són i la foto, per al selector. */
export type Opcio = { id: string; text: string; detall?: string; foto?: string | null };
export type OpcionsRelacio = Record<string, Opcio[]>;

/** El text ja formatat i el tipus, perquè la taula sàpiga com pintar-lo. */
export type Cel·la = {
  text: string;
  tipus: TipusCamp;
  buida: boolean;
  etiqueta?: string;
  /** Les dades que calen per pintar-la quan un sol valor no n'hi ha prou: el resum de facturació, el seguiment de la periodicitat. */
  dades?: Record<string, unknown>;
  /** Un telèfon o un correu: la llista hi posa els botons de trucar, WhatsApp o escriure. */
  contacte?: "telefon" | "correu";
  /**
   * D'on surt el valor, quan la columna en barreja dos (`sino`): «client» o
   * «lead» a les activitats. La llista pinta la cel·la segons quin és.
   */
  origen?: string;
  /** Les marques del client de la cel·la, si en té: la «!» dels To-Do i la «A» dels atributs. */
  marques?: MarquesClient;
};

/** Quant fa que no es va a veure un client: el tram pinta el fons de la fila, i el text ho diu en passar-hi per sobre. */
export type VisitaDeFila = { tram: TramVisita; text: string };

export type FilaLlistat = {
  id: string;
  cel·les: Cel·la[];
  /** Només a la llista de clients. */
  visita?: VisitaDeFila;
};

export type Llistat = {
  fitxa: Fitxa;
  /** Les columnes, amb les opcions dels filtres que es trien d'un desplegable de relació. */
  columnes: ColumnaLlistat[];
  files: FilaLlistat[];
  total: number;
  pagina: number;
  perPagina: number;
};

/** Camps a demanar: les relacions es despleguen fins al seu títol. */
function campsDeLlistat(fitxa: Fitxa) {
  const camps = ["id"];
  // Els de la columna i, si en té, els del camp que la supleix quan és buida.
  for (const columna of fitxa.columnes) {
    for (const nom of [columna.camp, ...(columna.sino ? [columna.sino] : [])]) {
      const definicio = fitxa.camps.find((c) => c.nom === nom);
      if (definicio?.tipus === "relacio" && definicio.relacio) {
        camps.push(`${nom}.${FITXES[definicio.relacio].titol}`);
        // D'un client cal l'id, per saber si té atributs.
        if (definicio.relacio === "clients") camps.push(`${nom}.id`);
      } else if (definicio?.tipus === "facturacio") {
        camps.push(...CAMPS_RESUM_FACTURACIO);
      } else {
        camps.push(nom);
      }
    }
  }
  return [...new Set(camps)];
}

function etiquetaOpcio(camp: Camp, valor: unknown) {
  const trobada = camp.opcions?.find(([v]) => v === String(valor));
  return trobada?.[1] ?? String(valor);
}

/** Els llocs arriben de l'ERP escrits de mil maneres: al llistat surten com a nom propi. */
const CAMPS_DE_LLOC = new Set(["poblacio", "comarca", "provincia"]);

function mostra(camp: Camp | undefined, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (!camp) return String(valor);
  if (CAMPS_DE_LLOC.has(camp.nom)) return nomDeLloc(String(valor)) || "—";

  switch (camp.tipus) {
    case "relacio": {
      const titol = camp.relacio ? FITXES[camp.relacio].titol : "id";
      return typeof valor === "object" ? String((valor as Record<string, unknown>)[titol] ?? "—") : String(valor);
    }
    case "tria":
    case "periodicitat":
      // Al llistat, l'opció pot tenir un nom curt («S/S»); el filtre fa servir l'etiqueta sencera.
      return camp.opcionsCurtes?.[String(valor)] ?? etiquetaOpcio(camp, valor);
    case "booleà":
      return valor ? "Sí" : "No";
    case "criteris": {
      const criteris = llegeixCriteris(valor);
      return criteris.length === 0 ? "—" : criteris.map(descriuCriteri).join(" · ");
    }
    case "horari":
      return descriuHorari(llegeixHorari(valor)) || "—";
    case "import":
    case "facturacio":
      return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(valor));
    case "data":
      return String(valor).slice(0, 10);
    case "datahora": {
      const moment = momentLocal(String(valor));
      return moment ? `${moment.dia} ${moment.hora}` : String(valor);
    }
    default:
      return String(valor);
  }
}

/**
 * El filtre de qui les porta, si la fitxa és de cadascú. Sense comercial a la
 * sessió (credencials locals) no es filtra res: val més veure-ho tot que una
 * llista buida sense explicació.
 */
function deQui(fitxa: Fitxa, comercial: string | null | undefined) {
  return fitxa.perComercial && fitxa.campComercial && comercial
    ? { camp: fitxa.campComercial, id: comercial }
    : undefined;
}

/**
 * Camp pel qual la base de dades ordena: una relació s'ordena pel títol de la fitxa
 * relacionada. Sempre es desempata per l'id: ordenant per un camp de pocs
 * valors (la categoria), l'ordre dels empatats canvia d'una petició a l'altra, i
 * d'una pàgina a la següent se'n repetien unes i se'n perdien d'altres.
 */
function campOrdre(fitxa: Fitxa, ordre: OrdreLlistat | null) {
  if (!ordre) return `${fitxa.ordre},id`;
  const camp = fitxa.camps.find((c) => c.nom === ordre.camp);
  const ruta = camp?.tipus === "relacio" && camp.relacio ? `${ordre.camp}.${FITXES[camp.relacio].titol}` : ordre.camp;
  return `${ordre.descendent ? "-" : ""}${ruta},id`;
}

/**
 * Cada filtre de columna, traduït a una condició de la base de dades segons la mena del
 * camp. Un filtre amb més d'un valor vol dir «qualsevol d'aquests».
 */
function condicionsDeFiltres(fitxa: Fitxa, filtres: Filtres): Condicio[] {
  const condicions: Condicio[] = [];
  for (const [nom, valors] of Object.entries(filtres)) {
    if (valors.length === 0) continue;
    const camp = fitxa.camps.find((c) => c.nom === nom);
    // Com va la periodicitat no és a la base de dades: el filtra `llistaPerSeguiment`.
    if (camp?.tipus === "periodicitat") continue;
    /** Una condició per valor, unides amb «o»; amb un sol valor, la condició sola. */
    const qualsevol = (perValor: (valor: string) => Condicio | null) => {
      const totes = valors.map(perValor).filter((condicio): condicio is Condicio => condicio !== null);
      if (totes.length === 1) condicions.push(totes[0]);
      else if (totes.length > 1) condicions.push({ _or: totes });
    };
    switch (menaDeFiltre(camp)) {
      case "text":
        qualsevol((valor) =>
          camp?.tipus === "relacio" && camp.relacio
            ? { [nom]: { [FITXES[camp.relacio].titol]: { _icontains: valor } } }
            : { [nom]: { _icontains: valor } },
        );
        break;
      case "nombre": {
        const numeros = valors.map((valor) => Number(valor.replace(",", "."))).filter(Number.isFinite);
        if (numeros.length > 0) condicions.push({ [nom]: { _in: numeros } });
        break;
      }
      case "data":
        qualsevol((valor) =>
          /^\d{4}-\d{2}-\d{2}$/.test(valor)
            ? camp?.tipus === "datahora"
              ? { [nom]: { _between: [instantDeLocal(`${valor}T00:00`) ?? `${valor}T00:00:00`, instantDeLocal(`${valor}T23:59`) ?? `${valor}T23:59:59`] } }
              : { [nom]: { _eq: valor } }
            : null,
        );
        break;
      case "tria":
      case "relacio":
        condicions.push({ [camp?.campDelFiltre ?? nom]: { _in: valors } });
        break;
      case "booleà":
        // «Sí» i «no» alhora és com no filtrar.
        if (valors.length === 1) condicions.push({ [nom]: { _eq: valors[0] === "si" } });
        break;
      default:
        break;
    }
  }
  return condicions;
}

export async function llistaFitxa(
  clau: ClauFitxa,
  {
    cerca = "",
    pagina = 1,
    comercial = null as string | null,
    ordre = null as OrdreLlistat | null,
    filtres = {} as Filtres,
    /** Files per pàgina; 0 les porta totes d'un cop. */
    perPagina = PER_PAGINA as number,
    /** Des de quina fila, en comptes de la pàgina: per afegir-ne a una llista que ja en té. */
    salta = null as number | null,
    /** Les columnes i les opcions dels seus filtres. Qui només vol més files se les estalvia. */
    ambColumnes = true,
  } = {},
): Promise<Llistat> {
  const fitxa = await fitxaViva(clau);
  const totes = perPagina <= 0;
  const paginaSegura = totes ? 1 : Math.max(1, pagina);
  const tram = { limit: totes ? -1 : perPagina, salta: totes ? 0 : (salta ?? (paginaSegura - 1) * perPagina) };
  const consulta: Consulta = {
    cerca,
    campsCerca: fitxa.cerca,
    ordre: campOrdre(fitxa, ordre),
    deQui: deQui(fitxa, comercial),
    condicions: [...condicionsExcloses(fitxa), ...condicionsDeFiltres(fitxa, filtres)],
  };

  // La periodicitat es compara amb les activitats d'enguany, que es compten a part.
  const periodicitat = fitxa.camps.find((camp) => camp.tipus === "periodicitat");
  const perSeguiment = periodicitat ? (filtres[periodicitat.nom] ?? []) : [];
  const comptades = periodicitat ? activitatsDEnguany() : Promise.resolve(null);

  const llegides: Promise<Pagina<Record<string, unknown>>> =
    periodicitat && perSeguiment.length > 0
      ? comptades.then((activitats) =>
          llistaPerSeguiment(fitxa, periodicitat, perSeguiment, activitats!, consulta, campsDeLlistat(fitxa), tram),
        )
      : llistaAmbTotal<Record<string, unknown>>(fitxa.colleccio, { camps: campsDeLlistat(fitxa), ...consulta, ...tram });
  // Els clients amb marques (atributs, To-Do), si a la llista hi surt algun client: la seva fitxa o una relació.
  const ambClients =
    clau === "clients" ||
    fitxa.columnes.some((columna) =>
      [columna.camp, columna.sino].some((nom) => fitxa.camps.find((c) => c.nom === nom)?.relacio === "clients"),
    );
  // A la llista de clients, el fons de cada fila diu quant fa que no s'hi va: la darrera activitat fins avui.
  const ara = new Date();
  const [{ files, total }, columnes, activitats, marcats, darreres] = await Promise.all([
    llegides,
    ambColumnes ? columnesAmbOpcions(fitxa) : Promise.resolve([]),
    comptades,
    ambClients ? clientsMarcats() : Promise.resolve(null),
    clau === "clients" ? darreraActivitatPerClient(ara.toISOString()) : Promise.resolve(null),
  ]);
  const avui = avuiLocal(ara);
  const visitaDe = (fila: Record<string, unknown>): VisitaDeFila | undefined => {
    if (!darreres) return undefined;
    const darrera = darreres.get(String(fila.id));
    const dia = darrera ? avuiLocal(new Date(darrera)) : null;
    return { tram: tramDeVisita(dia, avui), text: descriuDarreraVisita(dia, avui) };
  };
  /** Les marques del client d'una cel·la: la fila mateixa a la llista de clients, o la relació. */
  const marquesDeCella = (fila: Record<string, unknown>, nom: string, camp: Camp | undefined) => {
    if (!marcats) return undefined;
    const id = clau === "clients" && nom === fitxa.titol ? String(fila.id) : camp?.relacio === "clients" ? idDeRelacio(fila[nom]) : "";
    return marquesDe(id, marcats);
  };
  const seguiment = (fila: Record<string, unknown>) =>
    periodicitat && activitats
      ? seguimentDe(fila[periodicitat.nom], activitats.fetes.get(String(fila.id)) ?? 0, activitats.dia)
      : null;

  return {
    fitxa,
    columnes,
    total,
    pagina: paginaSegura,
    perPagina: totes ? 0 : perPagina,
    files: files.map((fila) => ({
      id: String(fila.id),
      ...(visitaDe(fila) ? { visita: visitaDe(fila) } : {}),
      cel·les: fitxa.columnes.map((columna) => {
        // Amb `sino`, mana el camp de la columna i, si és buit, el que la supleix.
        const nom = columna.sino && mostra(undefined, fila[columna.camp]) === "—" ? columna.sino : columna.camp;
        const camp = fitxa.camps.find((c) => c.nom === nom);
        const text = mostra(camp, fila[nom]);
        return {
          text,
          tipus: camp?.tipus ?? "text",
          buida: text === "—",
          ...(camp?.contacte ? { contacte: camp.contacte } : {}),
          ...(columna.sino && text !== "—" ? { origen: nom } : {}),
          ...(marquesDeCella(fila, nom, camp) ? { marques: marquesDeCella(fila, nom, camp) } : {}),
          ...(camp?.tipus === "facturacio"
            ? { dades: Object.fromEntries(CAMPS_RESUM_FACTURACIO.map((nom) => [nom, fila[nom] ?? null])) }
            : camp?.tipus === "periodicitat"
              ? { dades: seguiment(fila) ?? undefined }
              : {}),
        };
      }),
    })),
  };
}

type Consulta = Pick<Parameters<typeof llistaAmbTotal>[1], "cerca" | "campsCerca" | "ordre" | "deQui" | "condicions">;

/** Quants ids es demanen per petició: més, i l'URL del filtre ja no hi cabria. */
const IDS_PER_PETICIO = 100;

/**
 * Una pàgina filtrada per com va la periodicitat. La base de dades no ho sap filtrar,
 * perquè surt de comptar activitats: es demanen els ids dels que tenen
 * periodicitat i compleixen la resta de filtres, ja en l'ordre de la llista,
 * s'hi tria aquí, i les files de la pàgina es demanen després per lots.
 */
async function llistaPerSeguiment(
  fitxa: Fitxa,
  camp: Camp,
  /** Els estats de seguiment que es volen veure: qualsevol d'ells. */
  estats: string[],
  activitats: ActivitatsDEnguany,
  consulta: Consulta,
  camps: string[],
  { limit, salta }: { limit: number; salta: number },
) {
  const { files: candidats } = await llistaAmbTotal<Record<string, unknown>>(fitxa.colleccio, {
    ...consulta,
    camps: ["id", camp.nom],
    limit: -1,
    condicions: [...(consulta.condicions ?? []), { [camp.nom]: { _nnull: true } }],
  });
  const ids = candidats
    .filter((fila) => {
      const estat = seguimentDe(fila[camp.nom], activitats.fetes.get(String(fila.id)) ?? 0, activitats.dia)?.estat;
      return estat !== undefined && estats.includes(estat);
    })
    .map((fila) => String(fila.id));

  const pagina = limit < 0 ? ids.slice(salta) : ids.slice(salta, salta + limit);
  const lots = await Promise.all(
    Array.from({ length: Math.ceil(pagina.length / IDS_PER_PETICIO) }, (_, i) =>
      llistaAmbTotal<Record<string, unknown>>(fitxa.colleccio, {
        camps,
        ids: pagina.slice(i * IDS_PER_PETICIO, (i + 1) * IDS_PER_PETICIO),
        limit: -1,
      }),
    ),
  );
  const perId = new Map(lots.flatMap((lot) => lot.files).map((fila) => [String(fila.id), fila]));
  return {
    files: pagina.flatMap((id) => {
      const fila = perId.get(id);
      return fila ? [fila] : [];
    }),
    total: ids.length,
  };
}

/**
 * Les columnes del llistat. Les que apunten a un catàleg porten les seves
 * opcions, totes: també les que el formulari no ofereix, perquè una fitxa que
 * en té una s'ha de poder trobar igual.
 */
async function columnesAmbOpcions(fitxa: Fitxa): Promise<ColumnaLlistat[]> {
  return Promise.all(
    columnesDe(fitxa).map(async (columna) => {
      if (columna.definicio?.suggeriments && menaDeFiltre(columna.definicio) === "text") {
        return { ...columna, suggeriments: await valorsExistents(fitxa, columna.camp) };
      }
      const relacio = columna.definicio?.relacio;
      if (menaDeFiltre(columna.definicio) !== "relacio" || !relacio) return columna;
      // Totes, sí, però no les que la fitxa no ensenya mai: els clients només són d'uns quants tipus.
      const llista = await opcions(relacio, { limit: -1, totes: true, condicions: condicionsDeLesOpcions(fitxa, relacio) });
      return { ...columna, opcions: llista.map((o): [string, string] => [o.id, o.text]) };
    }),
  );
}

/**
 * Els valors diferents d'un camp de text, per al desplegable del seu filtre. Es
 * treuen dels que es veuen (sense els clients de baixa ni els d'altres tipus) i escrits com a la
 * llista: «BARCELONA» i «Barcelona» són una sola opció.
 */
async function valorsExistents(fitxa: Fitxa, camp: string): Promise<string[]> {
  const excloses = condicionsExcloses(fitxa);
  const grups = await agrupaPer(fitxa.colleccio, camp, excloses.length > 0 ? { _and: excloses } : undefined);
  const noms = new Set(grups.map((grup) => nomDeLloc(grup.valor)).filter(Boolean));
  return [...noms].sort((a, b) => a.localeCompare(b, "ca"));
}

export async function obteFitxa(clau: ClauFitxa, id: string): Promise<ValorsFitxa | null> {
  return obteItem<ValorsFitxa>(FITXES[clau].colleccio, id, ["*"]);
}

/** Quantes opcions es porten d'entrada a cada desplegable. */
export const OPCIONS_INICIALS = 25;

/** De qui són les opcions: un contacte es demana filtrat pel seu compte. */
export type FiltreOpcions = { camp: string; valor: string };

async function opcions(
  clau: ClauFitxa,
  filtre: {
    cerca?: string;
    ids?: string[];
    limit?: number;
    de?: FiltreOpcions | null;
    totes?: boolean;
    /** Les que té sentit oferir per a una altra fitxa: vegeu `condicionsDeLesOpcions`. */
    condicions?: Condicio[];
  },
) {
  const fitxa = FITXES[clau];
  // Dels tipus de client, per exemple, només s'ofereixen els que fa servir el CRM.
  const nomes = fitxa.opcionsNomes && !filtre.totes ? [{ [fitxa.opcionsNomes.camp]: { _eq: fitxa.opcionsNomes.valor } }] : [];
  const { files } = await llistaAmbTotal<Record<string, unknown>>(fitxa.colleccio, {
    camps: ["id", fitxa.titol],
    ordre: fitxa.titol,
    limit: filtre.limit ?? OPCIONS_INICIALS,
    cerca: filtre.cerca,
    campsCerca: fitxa.cerca,
    ids: filtre.ids,
    ...(filtre.de ? { filtre: filtre.de } : {}),
    // Les ja triades (`totes`) es demanen per id i hi entren sempre, encara que siguin de les excloses.
    condicions: [...(filtre.totes ? [] : [...condicionsExcloses(fitxa), ...nomes]), ...(filtre.condicions ?? [])],
  });
  return files.map((f) => ({ id: String(f.id), text: String(f[fitxa.titol] ?? "Sense nom") }));
}

/** Cerca al servidor: és el que fa que un desplegable aguanti milers de fitxes. */
export async function cercaOpcions(
  clau: ClauFitxa,
  cerca: string,
  limit = OPCIONS_INICIALS,
  de: FiltreOpcions | null = null,
) {
  return opcions(clau, { cerca, limit, de });
}

/**
 * Totes les opcions d'una relació per filtrar les fitxes d'una altra: els
 * tipus de client per filtrar clients, que són només els que es treballen.
 */
export async function opcionsPerFiltrar(clau: ClauFitxa, relacio: ClauFitxa) {
  return opcions(relacio, { limit: -1, condicions: condicionsDeLesOpcions(FITXES[clau], relacio) });
}

/** Les que la fitxa ja té triades i no surten a la primera pàgina, per no perdre-les. */
async function ambLesTriades(relacio: ClauFitxa, primeres: Opcio[], triats: string[]) {
  const falten = triats.filter((id) => id && !primeres.some((o) => o.id === id));
  // Es demanen per id i sense filtre: si el contacte desat ja no és del compte
  // que hi ha ara, val més que es vegi que no pas que el camp surti buit.
  const afegides = falten.length > 0 ? await opcions(relacio, { ids: falten, limit: falten.length, totes: true }) : [];
  return [...afegides, ...primeres];
}

/**
 * Les primeres opcions de cada desplegable. Hi entren sempre les que la fitxa
 * ja té triades, encara que no surtin a la primera pàgina: si no, en obrir una
 * fitxa el camp sortiria buit.
 *
 * Les relacions filtrades —el contacte, que ha de ser del compte— es demanen a
 * part i van amb la clau del seu camp i no la de la seva fitxa: dos camps que
 * apunten a la mateixa fitxa poden no oferir el mateix.
 */
export async function opcionsDeRelacions(clau: ClauFitxa, valors: ValorsFitxa = {}): Promise<OpcionsRelacio> {
  const fitxa = FITXES[clau];
  const deRelacio = fitxa.camps.filter((c) => c.tipus === "relacio" && c.relacio);
  const filtrades = deRelacio.filter((c) => c.filtradaPer);

  // Un segment tria valors de les variables de relació del compte (el tipus de
  // client): el constructor de criteris en necessita la llista sencera.
  const deCriteris = fitxa.camps.filter((c) => c.tipus === "criteris");
  const criteris = deCriteris.flatMap((c) => llegeixCriteris(valors[c.nom]));
  const perSegmentar = deCriteris.length > 0 ? VARIABLES.flatMap((v) => (v.relacio ? [v.relacio] : [])) : [];
  const lliures = [...new Set([...deRelacio.filter((c) => !c.filtradaPer).map((c) => c.relacio!), ...perSegmentar])];

  // Els productes d'una activitat: els que ja té, per al selector. Si la base de dades no respon, la fitxa s'obre igual, sense.
  const deProductes = fitxa.camps.filter((c) => c.tipus === "productes");
  const idFitxa = typeof valors.id === "string" ? valors.id : "";
  const productes = Promise.all(
    deProductes.map(async (camp) => {
      const triats = idFitxa ? await productesDeLActivitat(idFitxa).catch(() => []) : [];
      return [camp.nom, triats.map((producte) => ({ id: producte.id, text: producte.nom, detall: producte.detall, foto: producte.foto }))] as const;
    }),
  );

  const [perFitxa, perCamp] = await Promise.all([
    Promise.all(
      lliures.map(async (relacio) => {
        const triats = [
          ...deRelacio.filter((c) => c.relacio === relacio && !c.filtradaPer).map((c) => idDeRelacio(valors[c.nom])),
          ...criteris.filter((criteri) => variable(criteri.camp)?.relacio === relacio).flatMap((criteri) => criteri.valors),
        ];
        // Un segment és de clients: n'ofereix els tipus que es treballen, com el formulari d'un client.
        const condicions = condicionsDeLesOpcions(perSegmentar.includes(relacio) ? FITXES.clients : fitxa, relacio);
        const primeres = await opcions(relacio, perSegmentar.includes(relacio) ? { limit: -1, condicions } : { condicions });
        return [relacio, await ambLesTriades(relacio, primeres, triats)] as const;
      }),
    ),
    Promise.all(
      filtrades.map(async (camp) => {
        const de = filtreDeRelacio(camp, valors);
        // Sense saber de qui són, no se n'ofereix cap: el formulari ho diu.
        const primeres = de ? await opcions(camp.relacio!, { de }) : [];
        const triat = idDeRelacio(valors[camp.nom]);
        return [camp.nom, await ambLesTriades(camp.relacio!, primeres, [triat])] as const;
      }),
    ),
  ]);

  return Object.fromEntries([...perFitxa, ...perCamp, ...(await productes)]);
}

function valorDesat(camp: Camp, brut: FormDataEntryValue | null): unknown {
  if (camp.tipus === "booleà") return brut === "on" || brut === "true";

  // El constructor de criteris envia JSON. Es torna a validar aquí: el que
  // arriba d'un formulari no és de fiar, encara que l'hagi muntat el portal.
  if (camp.tipus === "criteris") {
    try {
      return llegeixCriteris(JSON.parse(String(brut ?? "[]")));
    } catch {
      return [];
    }
  }

  // Un horari que no diu res enlloc es desa com a buit i no com a set dies
  // d'escombraries: així es distingeix «no informat» de «tancat».
  if (camp.tipus === "horari") {
    try {
      const horari = llegeixHorari(JSON.parse(String(brut ?? "[]")));
      return horariBuitDeTot(horari) ? null : horari;
    } catch {
      return null;
    }
  }

  const text = String(brut ?? "").trim();
  if (text === "") return null;

  switch (camp.tipus) {
    case "nombre":
    case "decimal":
    case "import":
    // La periodicitat es tria d'una llista, però es desa com un enter: activitats l'any.
    case "periodicitat": {
      const numero = Number(text.replace(",", "."));
      return Number.isFinite(numero) ? numero : null;
    }
    case "datahora":
      // L'input dona "2026-09-02T10:30", en hora d'aquí. La conversió a UTC no
      // pot dependre del fus del servidor, que a Cloud Run va en UTC.
      return instantDeLocal(text);
    default:
      return text;
  }
}

export class ErrorFitxa extends Error {}

/** Files per petició quan es recopien els camps heretats. */
const LOT_HERENCIES = 100;

/**
 * Torna a copiar els camps heretats (`heretatDe`) de les fitxes que apunten a
 * les de `clau`: l'agent de les activitats i el tipus de client de les
 * oportunitats d'un lead o d'un client. Es copien en desar-les, i si després
 * canvia l'origen —l'agent d'un lead s'informa més tard, o l'ERP canvia el
 * d'un client— sense això quedarien amb el valor d'abans. Només compta
 * l'origen que mana: el client, i el lead només si no n'hi ha cap.
 *
 * Amb `ids`, només les que apunten a aquestes fitxes. Torna quantes n'ha canviat.
 */
export async function reconciliaHerencies(clau: ClauFitxa, ids?: string[]): Promise<number> {
  if (ids && ids.length === 0) return 0;
  let canviades = 0;

  for (const desti of Object.values(FITXES)) {
    for (const camp of desti.camps) {
      const origens = camp.heretatDe;
      if (!origens) continue;
      for (const [posicio, origen] of origens.entries()) {
        if (desti.camps.find((c) => c.nom === origen)?.relacio !== clau) continue;
        const condicions: Condicio[] = [
          { [origen]: ids ? { _in: ids } : { _nnull: true } },
          // Si un origen d'abans té valor, mana aquell.
          ...origens.slice(0, posicio).map((abans) => ({ [abans]: { _null: true } })),
        ];
        const [{ files }, { files: fonts }] = await Promise.all([
          llistaAmbTotal<Record<string, unknown>>(desti.colleccio, { camps: ["id", origen, camp.nom], limit: -1, condicions }),
          llistaAmbTotal<Record<string, unknown>>(FITXES[clau].colleccio, { camps: ["id", camp.nom], limit: -1, ids }),
        ]);
        const valorDe = new Map(fonts.map((font) => [String(font.id), idDeRelacio(font[camp.nom]) || null]));

        // Les que han de canviar, agrupades pel valor nou.
        const perValor = new Map<string | null, string[]>();
        for (const fila of files) {
          const font = idDeRelacio(fila[origen]);
          if (!valorDe.has(font)) continue;
          const nou = valorDe.get(font) ?? null;
          if ((idDeRelacio(fila[camp.nom]) || null) === nou) continue;
          perValor.set(nou, [...(perValor.get(nou) ?? []), String(fila.id)]);
        }
        for (const [valor, perCanviar] of perValor) {
          for (let i = 0; i < perCanviar.length; i += LOT_HERENCIES) {
            await actualitzaItems(desti.colleccio, perCanviar.slice(i, i + LOT_HERENCIES).map((id) => ({ id, [camp.nom]: valor })));
          }
          canviades += perCanviar.length;
        }
      }
    }
  }
  return canviades;
}

/**
 * Posa al dia el que penja d'uns leads amb la seva conversió (vegeu
 * `domini/crm-conversio.ts`): les activitats i els To-Do del lead porten el
 * client que n'ha sortit, o cap si ja no està convertit. Els To-Do hi van perquè
 * es llegeixen pel client: sense, una activitat passada els perdria de vista.
 * L'agent de les activitats es torna a copiar, que ara mana el del client.
 *
 * Es fa sense abast: qui converteix el lead ja s'ha comprovat que el pot tocar,
 * i n'han de passar totes les activitats, també les que hagi fet un altre.
 * Tornar-ho a fer no canvia res. Torna quantes files ha canviat.
 */
export async function passaDelLeadAlClient(leads: string[]): Promise<number> {
  if (leads.length === 0) return 0;
  return senseAbast(async () => {
    const clients = new Set<string>();
    let canviades = 0;
    for (const colleccio of [FITXES.activitats.colleccio, "crm_tasques"]) {
      const { files } = await llistaAmbTotal<FilaDelLead>(colleccio, {
        camps: ["id", "client", "lead.client"],
        limit: -1,
        condicions: [{ lead: { _in: leads } }],
      });
      for (const [client, ids] of canvisDeClient(files)) {
        for (let i = 0; i < ids.length; i += LOT_HERENCIES) {
          await actualitzaItems(colleccio, ids.slice(i, i + LOT_HERENCIES).map((id) => ({ id, client })));
        }
        if (client) clients.add(client);
        canviades += ids.length;
      }
    }
    if (canviades > 0) {
      await reconciliaHerencies("clients", [...clients]);
      await reconciliaHerencies("leads", leads);
    }
    return canviades;
  });
}

/**
 * El valor d'un camp `heretatDe`: el del mateix camp a la fitxa de la primera
 * relació que en tingui. Sense cap relació triada, queda buit.
 */
async function valorHeretat(fitxa: Fitxa, nom: string, origens: string[], dades: Record<string, unknown>) {
  for (const origen of origens) {
    const id = dades[origen];
    const relacio = fitxa.camps.find((camp) => camp.nom === origen)?.relacio;
    if (typeof id !== "string" || !id || !relacio) continue;
    const font = await obteItem<Record<string, unknown>>(FITXES[relacio].colleccio, id, [nom]);
    return idDeRelacio(font?.[nom]) || null;
  }
  return null;
}

/** El camp de la foto i, a les activitats, el grup: les d'una mateixa visita la comparteixen. */
const ambGrup = (fitxa: Fitxa, campFoto: string) => (fitxa.clau === "activitats" ? [campFoto, "grup"] : [campFoto]);

/**
 * Què vol fer el formulari amb la foto, ja comprovat; null si no la toca.
 * `perEsborrar` és el fitxer que quedarà sense ús en desar. Una activitat d'un
 * grup comparteix la foto amb les altres del grup: la seva no s'esborra mai.
 */
async function canviDeFoto(fitxa: Fitxa, id: string | null, formulari: FormData) {
  const camp = fitxa.camps.find((c) => c.tipus === "foto");
  if (!camp) return null;
  const brut = formulari.get(camp.nom);
  const fitxer = brut instanceof File && brut.size > 0 ? brut : null;
  if (!fitxer && formulari.get(nomTreuFoto(camp.nom)) !== "1") return null;

  const bytes = fitxer ? new Uint8Array(await fitxer.arrayBuffer()) : null;
  const motiu = bytes ? motiuFotoNoValida(bytes) : null;
  if (motiu) throw new ErrorFitxa(motiu);

  // Es llegeix abans de pujar res: si el camp encara no existeix a la base de dades,
  // s'atura aquí, amb l'avís de completar el model, i no queda cap fitxer orfe.
  let perEsborrar: string | null = null;
  if (id) {
    const actual = await obteItem<Record<string, unknown>>(fitxa.colleccio, id, ambGrup(fitxa, camp.nom));
    if (!actual?.grup) perEsborrar = idDeRelacio(actual?.[camp.nom]) || null;
  } else {
    await llistaAmbTotal(fitxa.colleccio, { camps: [camp.nom], limit: 1 });
  }
  return { camp: camp.nom, bytes, perEsborrar };
}

/**
 * Desa la fitxa. Els camps condicionals que no toquen es buiden, perquè un
 * canvi de tipus no hi deixi valors orfes (assistents en una trucada, posem).
 */
export async function desaFitxa(
  clau: ClauFitxa,
  id: string | null,
  formulari: FormData,
  comercial?: string | null,
): Promise<string> {
  // Amb els tipus d'ara: de quin tipus és l'activitat decideix quins camps es desen i quins es buiden.
  const fitxa = await fitxaViva(clau);
  if (fitxa.nomesLectura) {
    throw new ErrorFitxa(`${fitxa.plural} no s'editen des del portal: els manté l'ERP.`);
  }
  const brut: Record<string, unknown> = {};
  for (const camp of fitxa.camps) brut[camp.nom] = formulari.get(camp.nom);

  // El que és fix un cop desat, i d'on ve la fitxa, es mira a la base de dades abans
  // de res: el formulari no ho envia (o no ho ha d'enviar) i mana el que hi ha.
  const fixos = id ? fitxa.camps.filter((camp) => camp.fixEnEditar).map((camp) => camp.nom) : [];
  const perLlegir = [...fixos, ...(id && fitxa.campFont ? [fitxa.campFont] : [])];
  const actual = id && perLlegir.length > 0 ? await obteItem<Record<string, unknown>>(fitxa.colleccio, id, perLlegir) : null;
  // En una fitxa de l'ERP els camps de l'ERP no es validen ni es desen:
  // el formulari els mostra bloquejats i l'ERP els tornaria a posar igualment.
  const deErp = veDeFactusol(fitxa, actual);

  const dades: Record<string, unknown> = {};
  for (const camp of fitxa.camps) {
    // Els camps amb amo propi no es toquen: desar la fitxa no ha de desfer el
    // que hi ha deixat la seva acció (el resultat que hi posa el tancament).
    if (camp.extern) continue;
    // El que es copia d'una altra fitxa es posa més avall, amb tot el formulari llegit.
    if (camp.heretatDe) continue;
    // El que calcula el portal (la categoria) no es desa mai des del formulari.
    if (camp.calculat) continue;
    // Els productes es desen a part, un cop desada l'activitat; el text d'abans ja no
    // es toca. La foto no arriba si no es canvia: es posa més avall.
    if (camp.tipus === "productes" || camp.tipus === "foto" || camp.antic) continue;
    if (deErp && camp.deErp) continue;
    if (!campVisible(camp, brut)) {
      dades[camp.nom] = camp.tipus === "booleà" ? false : null;
      continue;
    }
    const valor = valorDesat(camp, formulari.get(camp.nom));
    if (camp.obligatori && (valor === null || valor === "")) {
      throw new ErrorFitxa(`Cal omplir «${camp.etiqueta}».`);
    }
    dades[camp.nom] = valor;
  }

  // Una activitat és d'un client o d'un lead, no de tots dos: el formulari ho
  // impedeix, però no és l'única porta. L'excepció és la d'un lead convertit, que
  // ja els porta tots dos desats (vegeu `passaDelLeadAlClient`) i no li canvien.
  for (const camp of fitxa.camps) {
    const altre = camp.excloent ? fitxa.camps.find((c) => c.nom === camp.excloent!.camp) : null;
    if (altre && dades[camp.nom] && dades[altre.nom] && !(actual?.[camp.nom] && actual?.[altre.nom])) {
      throw new ErrorFitxa(`No pot tenir alhora «${camp.etiqueta}» i «${altre.etiqueta}»: tria'n només un.`);
    }
  }

  // Una activitat apuntada a un lead ja convertit és, també, del client que n'ha sortit.
  if (clau === "activitats" && dades.lead && !dades.client) {
    const lead = await obteItem<{ client: unknown }>(FITXES.leads.colleccio, String(dades.lead), ["client"]);
    dades.client = idDeRelacio(lead?.client) || null;
  }

  for (const camp of fitxa.camps) {
    if (camp.heretatDe) dades[camp.nom] = await valorHeretat(fitxa, camp.nom, camp.heretatDe, dades);
  }

  // Els productes triats. Si l'activitat ja no és de les que porten producte, se li treuen.
  // Si el formulari no porta el camp, no es toquen: null vol dir «deixa'ls estar».
  const campProductes = fitxa.camps.find((camp) => camp.tipus === "productes");
  const productes = !campProductes
    ? null
    : !campVisible(campProductes, brut)
      ? []
      : formulari.has(campProductes.nom)
        ? [...new Set(formulari.getAll(campProductes.nom).map(String).filter(Boolean))]
        : null;
  if (productes && productes.length > MAXIM_PRODUCTES_PER_ACTIVITAT) {
    throw new ErrorFitxa(`Una activitat pot portar com a molt ${MAXIM_PRODUCTES_PER_ACTIVITAT} productes.`);
  }

  // La foto es puja l'última, amb tot el formulari ja validat. Treure-la és posar-hi null.
  const foto = await canviDeFoto(fitxa, id, formulari);
  if (foto) dades[foto.camp] = foto.bytes ? await pujaFotoDActivitat(foto.bytes, String(dades[fitxa.titol] ?? "")) : null;

  // Una fitxa nova amb diverses fitxes triades en un camp múltiple (els clients
  // d'una visita al laboratori): se'n crea una per cadascuna, amb la resta igual i
  // lligades pel mateix grup. El que depèn d'una sola, com el contacte, es buida.
  const campMultiple = id ? undefined : fitxa.camps.find((camp) => esMultiple(camp, brut));
  const triats = campMultiple ? [...new Set(formulari.getAll(campMultiple.nom).map(String).filter(Boolean))] : [];
  if (campMultiple && triats.length > 1) {
    if (fitxa.campComercial && comercial) dades[fitxa.campComercial] = comercial;
    const dependents = fitxa.camps.filter((camp) => camp.filtradaPer?.includes(campMultiple.nom));
    const grup = crypto.randomUUID();
    const comunes = { ...dades, grup, ...Object.fromEntries(dependents.map((camp) => [camp.nom, null])) };
    await creaItems(fitxa.colleccio, triats.map((valor) => ({ ...comunes, [campMultiple.nom]: valor })));
    // Els mateixos productes a cadascuna: es van presentar a la mateixa visita.
    if (productes && productes.length > 0) {
      const { files: creades } = await llistaAmbTotal<{ id: string }>(fitxa.colleccio, {
        camps: ["id"],
        limit: -1,
        filtre: { camp: "grup", valor: grup },
      });
      for (const creada of creades) await desaProductesDeLActivitat(creada.id, productes);
    }
    return "";
  }

  if (id) {
    // El que és fix un cop desat no s'accepta ni encara que el formulari ho
    // enviï: el que hi ha a la base de dades mana, si hi ha res.
    for (const nom of fixos) {
      const valor = actual?.[nom];
      if (valor !== null && valor !== undefined && valor !== "") delete dades[nom];
    }
    await actualitzaItem(fitxa.colleccio, id, dades);
    if (productes) await desaProductesDeLActivitat(id, productes);
    // La fitxa ja està desada: un fitxer vell que no s'hagi pogut esborrar no la desfà.
    if (foto?.perEsborrar) await esborraFitxer(foto.perEsborrar).catch(() => undefined);
    // Convertit, el lead passa les seves activitats al client. Si falla es diu:
    // sense això, la conversió quedaria a mitges sense que ningú ho sabés. Es pot tornar a desar.
    if (clau === "leads") {
      await passaDelLeadAlClient([id]).catch((error) => {
        throw new ErrorFitxa(`El lead s'ha desat, però les seves activitats no han pogut passar al client. Torna a desar-lo. (${(error as Error).message})`);
      });
    }
    // Si és un lead (o un client) i n'ha canviat l'agent o el tipus, el que en
    // penja se n'assabenta. La fitxa ja està desada: si això falla, no es desfà.
    await reconciliaHerencies(clau, [id]).catch((error) =>
      console.error(`[crm] no s'han pogut recopiar els camps heretats de ${clau} ${id}: ${(error as Error).message}`),
    );
    return id;
  }

  // Qui la crea queda registrat encara que la crida la faci el compte de
  // màquina: l'id surt de la sessió del portal.
  if (fitxa.campComercial && comercial) dades[fitxa.campComercial] = comercial;
  const nou = await creaItem(fitxa.colleccio, dades);
  if (productes && productes.length > 0) await desaProductesDeLActivitat(nou, productes);
  return nou;
}

/**
 * Qui només veu les seves activitats tampoc pot desar, tancar ni esborrar les
 * d'un altre, ni enviant-ne l'id a mà: el formulari no és l'única porta.
 */
export async function comprovaQueEsSeva(clau: ClauFitxa, id: string, deQui: string | null) {
  const fitxa = FITXES[clau];
  if (!deQui || !fitxa.perComercial || !fitxa.campComercial) return;
  const actual = await obteItem<Record<string, unknown>>(fitxa.colleccio, id, [fitxa.campComercial]);
  if (actual && !esVisiblePer(fitxa, actual, deQui)) {
    throw new ErrorFitxa(`Aquesta ${fitxa.singular.toLowerCase()} la porta un altre comercial.`);
  }
}

export async function esborraFitxa(clau: ClauFitxa, id: string) {
  const fitxa = FITXES[clau];
  if (fitxa.nomesLectura) {
    throw new ErrorFitxa(`${fitxa.plural} no s'esborren des del portal: els manté l'ERP.`);
  }
  // Una fitxa de l'ERP no s'esborra ni per l'URL: la manté l'ERP.
  if (fitxa.campFont) {
    const actual = await obteItem<Record<string, unknown>>(fitxa.colleccio, id, [fitxa.campFont]);
    if (veDeFactusol(fitxa, actual)) {
      throw new ErrorFitxa("Aquesta fitxa ve de l'ERP i no es pot esborrar des del portal.");
    }
  }
  // Amb la fitxa se'n va la seva foto, si no la comparteix amb el seu grup. Si no
  // es pot llegir (el camp encara no existeix, posem), no ha d'impedir esborrar.
  const campFoto = fitxa.camps.find((camp) => camp.tipus === "foto");
  const ambFoto = campFoto ? await obteItem<Record<string, unknown>>(fitxa.colleccio, id, ambGrup(fitxa, campFoto.nom)).catch(() => null) : null;
  const fitxerFoto = campFoto && !ambFoto?.grup ? idDeRelacio(ambFoto?.[campFoto.nom]) : "";

  await esborraItem(fitxa.colleccio, id);
  if (fitxerFoto) await esborraFitxer(fitxerFoto).catch(() => undefined);
}

/** Quantes fitxes hi ha de cada mena, per als comptadors de les pestanyes. */
export async function comptaFitxes(comercial: string | null = null): Promise<Record<ClauFitxa, number>> {
  const parells = await Promise.all(
    CLAUS_FITXA.map(async (clau) => {
      const fitxa = FITXES[clau];
      const { total } = await llistaAmbTotal<{ id: string }>(fitxa.colleccio, {
        camps: ["id"],
        limit: 0,
        deQui: deQui(fitxa, comercial),
        condicions: condicionsExcloses(fitxa),
      });
      return [clau, total] as const;
    }),
  );
  return Object.fromEntries(parells) as Record<ClauFitxa, number>;
}

/**
 * El que penja d'una fitxa: les activitats d'un compte, per exemple. El títol
 * va primer i la columna que apunta enrere no s'hi repeteix.
 */
export async function llistaRelacionada(
  clau: ClauFitxa,
  camp: string,
  valor: string,
  { limit = 50, comercial = null as string | null } = {},
): Promise<{ fitxa: Fitxa; files: { id: string; "cel·les": Cel·la[] }[]; total: number }> {
  const fitxa = await fitxaViva(clau);
  const columnes = [
    { camp: fitxa.titol, etiqueta: fitxa.singular },
    ...fitxa.columnes.filter((c) => c.camp !== camp && c.camp !== fitxa.titol),
  ];

  const camps = ["id"];
  for (const columna of columnes) {
    // Amb `sino`, també el camp que la supleix quan és buida: el fix, si el contacte no té mòbil.
    for (const nom of [columna.camp, ...(columna.sino ? [columna.sino] : [])]) {
      const definicio = fitxa.camps.find((c) => c.nom === nom);
      camps.push(definicio?.tipus === "relacio" && definicio.relacio ? `${nom}.${FITXES[definicio.relacio].titol}` : nom);
    }
  }

  const { files, total } = await llistaAmbTotal<Record<string, unknown>>(fitxa.colleccio, {
    camps,
    ordre: fitxa.ordre,
    limit,
    filtre: { camp, valor },
    deQui: deQui(fitxa, comercial),
  });

  return {
    fitxa,
    total,
    files: files.map((fila) => ({
      id: String(fila.id),
      "cel·les": columnes.map((columna) => {
        const sino = "sino" in columna ? columna.sino : undefined;
        const nom = sino && mostra(undefined, fila[columna.camp]) === "—" ? sino : columna.camp;
        const definicio = fitxa.camps.find((c) => c.nom === nom);
        const text = mostra(definicio, fila[nom]);
        return {
          text,
          tipus: definicio?.tipus ?? "text",
          buida: text === "—",
          etiqueta: columna.etiqueta,
          ...(definicio?.contacte ? { contacte: definicio.contacte } : {}),
          ...(sino && text !== "—" ? { origen: nom } : {}),
        };
      }),
    })),
  };
}
