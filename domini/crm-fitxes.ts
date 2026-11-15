/**
 * Què es pot mantenir del CRM des del portal, i com.
 *
 * Una sola descripció per fitxa: d'aquí en surten el llistat, el formulari, la
 * validació i l'escriptura cap a Directus. Afegir un camp és afegir-lo aquí.
 */
import { TENDENCIES } from "./facturacio-tendencia";
import { PERIODICITATS, PERIODICITATS_CURTES, SEGUIMENTS } from "./crm-periodicitat";
import { TIPUS_BASE, VISITA_CELLERS_A_CLIENT, VISITA_CLIENTS_A_CELLER, opcionsDeTipus, valorsAmb } from "./crm-tipus-activitat";
import { ESTATS_CLIENT_CURTS, ESTAT_CLIENT_BAIXA, OPCIONS_ESTAT_CLIENT } from "./factusol-vocabulari";

export type TipusCamp =
  | "text"
  | "area"
  | "nombre"
  | "decimal"
  | "import"
  | "data"
  | "datahora"
  | "tria"
  | "booleà"
  | "relacio"
  /** Llista de condicions sobre les variables del compte, per als segments. */
  | "criteris"
  /** Matriu setmanal amb els blocs horaris i l'estat de cada dia. */
  | "horari"
  /** El resum de facturació del client: es pinta amb barres i tendència. No s'edita. */
  | "facturacio"
  /**
   * Quantes activitats l'any s'hi volen fer. Es tria com una tria, i a la llista
   * es pinta comparat amb les activitats fetes enguany.
   */
  | "periodicitat"
  /**
   * Els vins d'una activitat: es trien del catàleg d'articles amb un modal de
   * cerca, tants com calgui, i es desen a part, a `crm_activitats_vins`. No és
   * cap camp de la col·lecció: vegeu `serveis/crm-vins.ts`.
   */
  | "vins"
  /**
   * Una foto feta amb la càmera o triada de la galeria: el fitxer va a la
   * biblioteca de Directus i el camp en desa l'id. Només es toca si es canvia:
   * vegeu `domini/foto-activitat.ts`.
   */
  | "foto";

export type Camp = {
  nom: string;
  etiqueta: string;
  tipus: TipusCamp;
  /** Valors possibles d'una tria: [valor desat, etiqueta visible]. */
  opcions?: [string, string][];
  /**
   * Opcions que encara es llegeixen i es filtren, però que el formulari ja no
   * ofereix, tret que la fitxa ja en tingui una: un tipus d'activitat desactivat.
   */
  opcionsRetirades?: string[];
  /**
   * Com es diu una opció a les cel·les del llistat, quan l'etiqueta sencera hi
   * ocupa massa: valor desat → text curt. El filtre i el formulari fan servir
   * l'etiqueta sencera.
   */
  opcionsCurtes?: Record<string, string>;
  /** Fitxa amb què es relaciona, per omplir el desplegable. */
  relacio?: ClauFitxa;
  obligatori?: boolean;
  ample?: "mitja" | "sencer";
  nota?: string;
  /** El camp només apareix (i només es desa) si es compleix la condició. */
  nomesSi?: { camp: string; valors: string[] };
  /**
   * Les opcions d'aquesta relació no són totes les de la seva fitxa: es
   * filtren pel que hi hagi en un altre camp del mateix formulari. S'hi proven
   * en ordre i mana el primer que tingui valor, perquè un contacte penja del
   * compte i, si encara no és client, del lead. El nom del camp d'aquí ha de
   * ser el mateix que el de la fitxa relacionada.
   */
  filtradaPer?: string[];
  /**
   * Un cop la fitxa té valor en aquest camp, ja no es canvia: una activitat
   * és d'un compte, i canviar-li'l seria com moure una visita d'un client a
   * un altre. Mentre és buit, sí que es pot omplir.
   */
  fixEnEditar?: boolean;
  /**
   * El camp té amo propi: una acció el manté i el formulari no l'ha de tocar.
   * Ni surt com a camp ni es desa —ni tan sols per buidar-lo—, perquè si no,
   * desar la fitxa desfaria el que ha fet aquella acció.
   */
  extern?: boolean;
  /**
   * El valor no es tria: es copia, en desar, del mateix camp de la fitxa a què
   * apunta la primera d'aquestes relacions que tingui valor. El tipus de client
   * d'una oportunitat és el del seu client (o del lead, si encara no ho és).
   * No surt al formulari. Si després canvia a l'origen (l'agent d'un lead
   * s'informa més tard), es torna a copiar: vegeu `reconciliaHerencies`.
   */
  heretatDe?: string[];
  /**
   * Aquest camp i un altre no poden tenir valor alhora: una activitat és d'un
   * client o d'un lead, no de tots dos. Mentre l'altre en té, aquest es veu
   * desactivat amb l'avís; el servidor també ho comprova. Tots dos només els
   * porta la d'un lead convertit: vegeu `domini/crm-conversio.ts`.
   */
  excloent?: { camp: string; avis: string };
  /**
   * El camp el manté la sincronització amb FactuSol. En una fitxa que ve de
   * l'ERP (vegeu `campFont` de la fitxa) es mostra però no s'edita, perquè
   * a la propera passada l'ERP el tornaria a posar com el té ell.
   */
  deErp?: boolean;
  /**
   * Coordenada que va amb aquesta: la latitud porta el nom del camp de la
   * longitud, i el formulari pinta les dues juntes amb un mapa per triar el
   * punt. El camp de parella no es pinta pel seu compte.
   */
  parella?: string;
  /**
   * En crear la fitxa, i si es compleix la condició, s'hi poden triar diverses
   * fitxes: se'n crea una per cadascuna, lligades pel camp `grup`. És el cas
   * dels clients d'una visita al celler.
   */
  multiple?: { camp: string; valors: string[] };
  /**
   * El filtre de la columna mira un altre camp: la facturació s'ordena per
   * l'acumulat, però es filtra per tendència.
   */
  campDelFiltre?: string;
  /**
   * Les opcions del filtre de la columna, quan no són les del formulari: la
   * periodicitat es tria per freqüència però es filtra per com es va.
   */
  opcionsDelFiltre?: [string, string][];
  /**
   * El filtre de text ofereix, desplegats, els valors que ja hi ha a la
   * col·lecció: la població, la comarca i la província es trien més de pressa
   * que no s'escriuen. Es pot seguir escrivint un tros, igual que abans.
   */
  suggeriments?: boolean;
  /**
   * El calcula el portal i no s'edita mai: es veu a la fitxa però no es desa
   * des del formulari. És la categoria, que surt de la facturació.
   */
  calculat?: boolean;
  /**
   * Un telèfon o un correu: a la llista i a la fitxa porta els botons per
   * trucar, obrir WhatsApp o escriure. Vegeu `domini/contacte.ts`.
   */
  contacte?: "telefon" | "correu";
  /**
   * Un camp d'abans que ja no es fa servir: només es veu a les fitxes que hi
   * tenen alguna cosa, i ni s'edita ni es desa. És el text lliure de vins, que
   * ara es trien del catàleg.
   */
  antic?: boolean;
};

export type ClauFitxa =
  | "activitats"
  | "leads"
  | "oportunitats"
  | "clients"
  | "proveidors"
  | "contactes"
  | "segments"
  | "tipus_client"
  | "agents";

export type Fitxa = {
  clau: ClauFitxa;
  colleccio: string;
  singular: string;
  plural: string;
  /** Gènere del nom, per no escriure «nova contacte». */
  article: "nou" | "nova";
  /** Camp que fa de títol al llistat i als desplegables. */
  titol: string;
  /**
   * Les columnes del llistat. Una amb `alTitol` no ocupa columna pròpia: el
   * valor va dins de la cel·la del títol, però s'hi pot ordenar i filtrar igual.
   */
  columnes: {
    camp: string;
    etiqueta: string;
    alTitol?: boolean;
    /** Com es diu a la capçalera quan hi va estreta. L'etiqueta sencera surt en passar-hi per sobre. */
    curta?: string;
    /**
     * A partir de quina amplada surt a la taula. Per sota s'amaga perquè la
     * resta hi càpiga sense rascar de costat; a les fitxes del telèfon hi és sempre.
     */
    desDe?: "xl" | "2xl";
    /**
     * Quan el camp no té valor, s'ensenya aquest altre. Una activitat és d'un
     * client o d'un lead: a la columna hi ha d'anar el que en tingui, que si no
     * les activitats d'un lead no diuen de qui són.
     */
    sino?: string;
  }[];
  cerca: string[];
  ordre: string;
  camps: Camp[];
  /**
   * Com s'agrupen els camps al formulari quan hi ha espai per repartir-los: la
   * fitxa d'un client, que va a pantalla sencera. Cada grup porta els seus
   * camps en l'ordre que diu; els que no surten enlloc van a un grup al final.
   */
  seccions?: { titol: string; camps: string[] }[];
  /** Si la fitxa té comercial propi, s'hi estampa qui l'ha desada. */
  campComercial?: string;
  /**
   * Les fitxes amb comercial només les veu qui les porta; les que no en tenen,
   * tothom. És el cas de les activitats: l'agenda de cadascú és seva, mentre
   * que leads, comptes i oportunitats són de la casa i els veu tothom.
   */
  perComercial?: boolean;
  /** Pestanyes del panell amb el que penja d'aquesta fitxa. */
  relacionades?: { clau: ClauFitxa; camp: string; etiqueta: string }[];
  /**
   * La fitxa té pestanya de deures: els ToDos que li han deixat les seves
   * activitats en tancar-se i els que s'hi han apuntat a mà.
   */
  ambDeures?: boolean;
  /**
   * Camp que diu d'on ve la fitxa. Quan val «factusol», els camps `deErp`
   * queden bloquejats al formulari i no es desen.
   */
  campFont?: string;
  /** Com es diu la pantalla del llistat, si no és el plural: els segments viuen al Planificador. */
  titolVista?: string;
  /**
   * El portal no hi escriu mai: ni en crea, ni n'edita, ni n'esborra. És per a
   * les taules que manté l'ERP senceres, com els cellers (proveïdors de
   * FactuSol): la fitxa es consulta, i qualsevol canvi es fa a l'ERP i arriba
   * per la sincronització. Es comprova també al servidor, no només al
   * formulari: l'acció de desar és una porta oberta.
   */
  nomesLectura?: boolean;
  /**
   * Als desplegables que hi apunten només s'hi ofereixen les fitxes que
   * compleixen això. Les que una fitxa ja té triades es veuen igual.
   */
  opcionsNomes?: { camp: string; valor: boolean };
  /**
   * Taula petita de valors, com els tipus de client. Una relació que hi
   * apunta es filtra i es segmenta triant d'un desplegable, per id, i no
   * escrivint-ne el nom com es fa amb els comptes.
   */
  cataleg?: boolean;
  /**
   * Les fitxes amb aquest valor no surten enlloc del CRM: ni al llistat, ni als
   * desplegables, ni als comptadors, ni als segments. És el cas dels clients de
   * baixa. Una fitxa ja triada en un desplegable es continua veient.
   */
  excloses?: { camp: string; valor: string };
  /**
   * L'altra cara d'`excloses`: només surten al CRM les fitxes que tenen un
   * d'aquests valors, i tampoc surten enlloc les altres. El camp pot anar per
   * una relació, amb un punt: dels clients, només els tipus que es treballen.
   * Una fitxa sense valor en queda fora.
   */
  nomesAmb?: { camp: string; valors: number[] };
};

/**
 * Els tipus de client (TCLCLI de FactuSol, `codi_erp` de la seva còpia) que
 * treballa el CRM: restaurants, botigues especialitzades, distribuïdors i
 * caterings. Els particulars, les empreses i la resta no es visiten i no
 * surten enlloc: ni a la llista de clients, ni al mapa, ni als segments.
 */
export const TIPUS_CLIENT_DEL_CRM = [1, 3, 4, 6];

const FORMES: [string, string][] = [
  ["Comptat", "Comptat"], ["Transferència 30 dies", "Transferència 30 dies"],
  ["Rebut domiciliat 60 dies", "Rebut domiciliat 60 dies"],
  ["Confirming 90 dies", "Confirming 90 dies"], ["Targeta", "Targeta"],
];
const ORIGENS: [string, string][] = [
  ["Fira", "Fira"], ["Recomanació", "Recomanació"], ["Web", "Web"],
  ["Prospecció", "Prospecció"], ["Client existent", "Client existent"], ["Xarxes socials", "Xarxes socials"],
];
const ACTIU: [string, string][] = [["actiu", "Actiu"], ["inactiu", "Inactiu"]];

/** Com els desa la sincronització de F_PRO: vegeu `domini/sincronitzacio.ts`. */
const TIPUS_PROVEIDOR: [string, string][] = [["proveidor", "Celler o proveïdor"], ["creditor", "Creditor de serveis"]];
const ESTAT_PROVEIDOR: [string, string][] = [["actiu", "Actiu"], ["inactiu", "Inactiu"], ["baixa", "Baixa"]];

export const MODES_SEGMENT: [string, string][] = [
  ["tots", "Compleixen tots els criteris"],
  ["algun", "Compleixen algun criteri"],
];

/**
 * L'escala d'A (el màxim) a E (el mínim) amb què es qualifica un compte. La
 * fan servir dos camps: la categoria, que calcula el portal amb la facturació,
 * i el potencial, que posa a mà qui porta el compte.
 */
export const LLETRES = ["A", "B", "C", "D", "E"] as const;
export type Lletra = (typeof LLETRES)[number];
const OPCIONS_LLETRA: [string, string][] = LLETRES.map((lletra) => [lletra, lletra]);

export function esLletra(valor: unknown): valor is Lletra {
  return typeof valor === "string" && (LLETRES as readonly string[]).includes(valor);
}

/**
 * Com pot acabar una activitat. Mentre el resultat és «Pendent» l'activitat
 * encara és oberta; qualsevol d'aquests la dona per tancada.
 */
export const RESULTATS_TANCAMENT = ["Positiu", "Neutre", "Negatiu", "Sense resposta"] as const;
export type ResultatTancament = (typeof RESULTATS_TANCAMENT)[number];

export const PENDENT = "Pendent";

export function esResultatTancament(valor: unknown): valor is ResultatTancament {
  return typeof valor === "string" && (RESULTATS_TANCAMENT as readonly string[]).includes(valor);
}

/** Una activitat és tancada quan té un resultat que no és «Pendent». */
export function activitatTancada(valors: { resultat?: unknown }) {
  return esResultatTancament(valors.resultat);
}

export const FITXES: Record<ClauFitxa, Fitxa> = {
  activitats: {
    clau: "activitats",
    colleccio: "crm_activitats",
    singular: "Activitat",
    article: "nova",
    plural: "Activitats",
    titol: "assumpte",
    ordre: "-data",
    cerca: ["assumpte", "resum"],
    campComercial: "comercial",
    perComercial: true,
    columnes: [
      { camp: "data", etiqueta: "Data" },
      // De qui és, just després de quan: és el que es busca primer en repassar la llista.
      { camp: "client", etiqueta: "Client o lead", curta: "Client/Lead", sino: "lead" },
      { camp: "tipus", etiqueta: "Tipus" },
      { camp: "assumpte", etiqueta: "Assumpte" },
      { camp: "agent", etiqueta: "Agent", desDe: "xl" },
      { camp: "celler", etiqueta: "Celler" },
      { camp: "resultat", etiqueta: "Resultat" },
    ],
    camps: [
      // Els de partida: els de debò els hi posa `ambTipusActivitat`, també a les condicions de sota.
      { nom: "tipus", etiqueta: "Tipus", tipus: "tria", opcions: opcionsDeTipus(TIPUS_BASE), obligatori: true },
      // Es pot posar al passat: també s'apunta el que ja s'ha fet.
      { nom: "data", etiqueta: "Data i hora", tipus: "datahora", obligatori: true },
      { nom: "assumpte", etiqueta: "Assumpte", tipus: "text", obligatori: true, ample: "sencer" },
      {
        nom: "client", etiqueta: "Client", tipus: "relacio", relacio: "clients", fixEnEditar: true,
        // A una visita de clients al celler n'hi poden anar diversos: una activitat per client.
        multiple: { camp: "tipus", valors: [VISITA_CLIENTS_A_CELLER] },
        excloent: { camp: "lead", avis: "Ja és d'un lead: treu-lo per triar un client." },
      },
      {
        nom: "lead", etiqueta: "Lead", tipus: "relacio", relacio: "leads", nota: "Si encara no és client.", fixEnEditar: true,
        excloent: { camp: "client", avis: "Ja és d'un client: treu-lo per triar un lead." },
      },
      {
        // No es tria: és el del client (o el del lead). Així l'agenda es pot
        // filtrar per agent sense haver-lo d'anar posant a cada activitat.
        nom: "agent", etiqueta: "Agent comercial", tipus: "relacio", relacio: "agents", heretatDe: ["client", "lead"],
      },
      {
        // Només la gent d'aquest compte: la llista sencera de contactes de la
        // casa no vol dir res quan s'apunta amb qui s'ha parlat en una visita.
        nom: "contacte", etiqueta: "Contacte", tipus: "relacio", relacio: "contactes",
        filtradaPer: ["client", "lead"],
      },
      { nom: "oportunitat", etiqueta: "Oportunitat", tipus: "relacio", relacio: "oportunitats" },
      {
        nom: "celler", etiqueta: "Celler", tipus: "relacio", relacio: "proveidors",
        // Només quan hi ha un celler pel mig: a una visita amb vins normal no cal.
        nomesSi: { camp: "tipus", valors: valorsAmb(TIPUS_BASE, "ambCeller") },
        // A una visita de cellers a client n'hi poden anar diversos: una activitat per celler.
        multiple: { camp: "tipus", valors: [VISITA_CELLERS_A_CLIENT] },
        nota: "Quin celler ha anat al client, o a quin celler han anat els clients.",
      },
      {
        // Del catàleg d'articles, no text lliure: així se sap quins vins s'han ensenyat i a qui.
        nom: "vins", etiqueta: "Vins presentats o tastats", tipus: "vins", ample: "sencer",
        nomesSi: { camp: "tipus", valors: valorsAmb(TIPUS_BASE, "ambVi") },
      },
      {
        // El text lliure d'abans: només a les activitats que el tenen, per no perdre'l.
        nom: "referencies", etiqueta: "Vins (text d'abans)", tipus: "area", ample: "sencer", antic: true,
        nomesSi: { camp: "tipus", valors: valorsAmb(TIPUS_BASE, "ambVi") },
        nota: "Ja no s'edita: els vins es trien del catàleg, al camp de dalt.",
      },
      {
        nom: "assistents", etiqueta: "Assistents del client", tipus: "nombre",
        nomesSi: { camp: "tipus", valors: [VISITA_CLIENTS_A_CELLER] },
      },
      { nom: "durada_minuts", etiqueta: "Durada (minuts)", tipus: "nombre" },
      { nom: "cost", etiqueta: "Cost", tipus: "import", nota: "Mostres, desplaçament, àpat." },
      {
        // Qui el mou és el botó de tancar l'activitat, no el formulari: tancar
        // és una cosa que es fa, no una casella que s'omple.
        nom: "resultat", etiqueta: "Resultat", tipus: "tria", extern: true,
        opcions: [["Pendent", "Pendent"], ...RESULTATS_TANCAMENT.map((r) => [r, r] as [string, string])],
      },
      { nom: "resum", etiqueta: "Resum", tipus: "area", ample: "sencer" },
      { nom: "foto", etiqueta: "Foto", tipus: "foto", ample: "sencer" },
      { nom: "proper_pas", etiqueta: "Proper pas", tipus: "text", ample: "sencer" },
      { nom: "data_proper_pas", etiqueta: "Data del proper pas", tipus: "data" },
      // El posa el portal quan una visita de clients al celler es desa per a diversos clients.
      { nom: "grup", etiqueta: "Visita compartida", tipus: "text", extern: true },
    ],
  },

  leads: {
    clau: "leads",
    colleccio: "crm_leads",
    singular: "Lead",
    article: "nou",
    plural: "Leads",
    titol: "nom",
    ordre: "-date_created",
    cerca: ["nom", "persona_contacte", "correu", "poblacio", "comarca", "provincia"],
    campComercial: "comercial",
    columnes: [
      { camp: "nom", etiqueta: "Negoci" },
      { camp: "estat", etiqueta: "Estat" },
      { camp: "origen", etiqueta: "Origen" },
      { camp: "tipus_client", etiqueta: "Tipus de client" },
      { camp: "agent", etiqueta: "Agent" },
      { camp: "poblacio", etiqueta: "Població" },
      // Com als clients: amb poca amplada la població ja situa el lead, i la comarca i la província cedeixen el lloc.
      { camp: "comarca", etiqueta: "Comarca", desDe: "xl" },
      { camp: "provincia", etiqueta: "Província", desDe: "xl" },
      { camp: "valor_estimat", etiqueta: "Valor estimat" },
    ],
    camps: [
      { nom: "nom", etiqueta: "Nom del negoci", tipus: "text", obligatori: true, ample: "sencer" },
      {
        nom: "estat", etiqueta: "Estat", tipus: "tria",
        opcions: [["nou", "Nou"], ["contactat", "Contactat"], ["qualificat", "Qualificat"], ["convertit", "Convertit"], ["descartat", "Descartat"]],
      },
      { nom: "origen", etiqueta: "Origen", tipus: "tria", opcions: ORIGENS },
      { nom: "tipus_client", etiqueta: "Tipus de client", tipus: "relacio", relacio: "tipus_client" },
      // A mà: un lead encara no és a FactuSol i no en pot heretar l'agent.
      { nom: "agent", etiqueta: "Agent comercial", tipus: "relacio", relacio: "agents" },
      { nom: "persona_contacte", etiqueta: "Persona de contacte", tipus: "text" },
      { nom: "carrec", etiqueta: "Càrrec", tipus: "text" },
      { nom: "correu", etiqueta: "Correu", tipus: "text", contacte: "correu" },
      { nom: "telefon", etiqueta: "Telèfon", tipus: "text", contacte: "telefon" },
      { nom: "poblacio", etiqueta: "Població", tipus: "text", suggeriments: true },
      { nom: "comarca", etiqueta: "Comarca", tipus: "text", suggeriments: true },
      { nom: "provincia", etiqueta: "Província", tipus: "text", suggeriments: true },
      { nom: "pais", etiqueta: "País", tipus: "text" },
      { nom: "valor_estimat", etiqueta: "Valor estimat", tipus: "import" },
      { nom: "data_alta", etiqueta: "Data d'alta", tipus: "data" },
      { nom: "data_conversio", etiqueta: "Data de conversió", tipus: "data" },
      {
        nom: "client",
        etiqueta: "Client resultant",
        tipus: "relacio",
        relacio: "clients",
        nota: "En què s'ha convertit. Les seves activitats, amb els vins i els To-Do, passen a aquest client.",
        obligatori: true,
        nomesSi: { camp: "estat", valors: ["convertit"] },
      },
      { nom: "motiu_descart", etiqueta: "Motiu del descart", tipus: "text", ample: "sencer", nomesSi: { camp: "estat", valors: ["descartat"] } },
      { nom: "notes", etiqueta: "Notes", tipus: "area", ample: "sencer" },
    ],
  },

  oportunitats: {
    clau: "oportunitats",
    colleccio: "crm_oportunitats",
    singular: "Oportunitat",
    article: "nova",
    plural: "Oportunitats",
    titol: "titol",
    ordre: "-date_created",
    cerca: ["titol"],
    campComercial: "comercial",
    columnes: [
      { camp: "titol", etiqueta: "Oportunitat" },
      { camp: "etapa", etiqueta: "Etapa" },
      { camp: "client", etiqueta: "Client" },
      { camp: "valor", etiqueta: "Valor" },
      { camp: "probabilitat", etiqueta: "Probabilitat" },
      { camp: "tancament_previst", etiqueta: "Tancament previst" },
    ],
    camps: [
      { nom: "titol", etiqueta: "Títol", tipus: "text", obligatori: true, ample: "sencer" },
      {
        nom: "etapa", etiqueta: "Etapa", tipus: "tria",
        opcions: [["contacte", "Contacte"], ["qualificada", "Qualificada"], ["tast", "Tast"], ["proposta", "Proposta"], ["negociacio", "Negociació"], ["guanyada", "Guanyada"], ["perduda", "Perduda"]],
      },
      { nom: "client", etiqueta: "Client", tipus: "relacio", relacio: "clients" },
      { nom: "lead", etiqueta: "Lead", tipus: "relacio", relacio: "leads" },
      { nom: "tipus_client", etiqueta: "Tipus de client", tipus: "relacio", relacio: "tipus_client", heretatDe: ["client", "lead"] },
      { nom: "valor", etiqueta: "Valor", tipus: "import" },
      { nom: "probabilitat", etiqueta: "Probabilitat (%)", tipus: "nombre" },
      { nom: "data_obertura", etiqueta: "Data d'obertura", tipus: "data" },
      { nom: "tancament_previst", etiqueta: "Tancament previst", tipus: "data" },
      { nom: "data_tancament", etiqueta: "Data de tancament", tipus: "data" },
      { nom: "etapa_assolida", etiqueta: "Etapa assolida", tipus: "nombre", nota: "Fins on va arribar (1-5). Cal per dibuixar l'embut de les perdudes." },
      {
        nom: "motiu_perdua", etiqueta: "Motiu de la pèrdua", tipus: "tria", ample: "sencer",
        opcions: [["Preu", "Preu"], ["Competència", "Competència"], ["Sense pressupost", "Sense pressupost"], ["No respon", "No respon"], ["Producte no encaixa", "Producte no encaixa"], ["Altres", "Altres"]],
        nomesSi: { camp: "etapa", valors: ["perduda"] },
      },
      { nom: "notes", etiqueta: "Notes", tipus: "area", ample: "sencer" },
    ],
  },

  clients: {
    clau: "clients",
    colleccio: "crm_clients",
    singular: "Client",
    article: "nou",
    plural: "Clients",
    titol: "nom_comercial",
    ordre: "nom_comercial",
    cerca: ["nom_comercial", "rao_social", "nif", "poblacio", "comarca", "correu"],
    campComercial: "comercial",
    ambDeures: true,
    campFont: "font",
    excloses: { camp: "estat", valor: ESTAT_CLIENT_BAIXA.valor },
    nomesAmb: { camp: "tipus_client.codi_erp", valors: TIPUS_CLIENT_DEL_CRM },
    relacionades: [
      { clau: "activitats", camp: "client", etiqueta: "Activitats" },
      { clau: "contactes", camp: "client", etiqueta: "Contactes" },
      { clau: "leads", camp: "client", etiqueta: "Leads convertits" },
    ],
    columnes: [
      { camp: "nom_comercial", etiqueta: "Nom comercial" },
      // La categoria, el potencial, el tipus i la facturació es llegeixen amb el nom: van a sota seu, amb l'ordre i el filtre de sempre.
      // Les dues lletres van juntes i en aquest ordre: primer la categoria, després el potencial.
      { camp: "categoria", etiqueta: "Categoria", curta: "Cat.", alTitol: true },
      { camp: "potencial", etiqueta: "Potencial", curta: "Pot.", alTitol: true },
      { camp: "tipus_client", etiqueta: "Tipus de client", curta: "Tipus", alTitol: true },
      { camp: "facturacio_periode", etiqueta: "Facturació", alTitol: true },
      { camp: "estat", etiqueta: "Estat" },
      { camp: "periodicitat", etiqueta: "Periodicitat" },
      { camp: "agent", etiqueta: "Agent" },
      { camp: "poblacio", etiqueta: "Població" },
      // Amb poca amplada, la població ja situa el client: la comarca i la província cedeixen el lloc.
      { camp: "comarca", etiqueta: "Comarca", desDe: "xl" },
      { camp: "provincia", etiqueta: "Província", desDe: "xl" },
      // Les notes són llargues: a la llista se'n veu el principi i s'obren amb un clic.
      { camp: "notes", etiqueta: "Notes" },
    ],
    camps: [
      // La font la posa la sincronització: el formulari només la fa servir per bloquejar els camps de l'ERP.
      { nom: "font", etiqueta: "Font de les dades", tipus: "tria", opcions: [["factusol", "FactuSol"], ["portal", "Portal"]], extern: true },
      { nom: "nom_comercial", etiqueta: "Nom comercial", tipus: "text", obligatori: true, ample: "sencer", deErp: true },
      { nom: "rao_social", etiqueta: "Raó social", tipus: "text", deErp: true },
      { nom: "nif", etiqueta: "NIF", tipus: "text", deErp: true },
      // A FactuSol, TCLCLI apunta a la taula de tipus (F_TCL); aquí, a la seva còpia.
      { nom: "tipus_client", etiqueta: "Tipus de client", tipus: "relacio", relacio: "tipus_client", deErp: true },
      // AGECLI apunta a F_AGE; aquí, a la seva còpia.
      { nom: "agent", etiqueta: "Agent comercial", tipus: "relacio", relacio: "agents", deErp: true },
      { nom: "estat", etiqueta: "Estat", tipus: "tria", opcions: OPCIONS_ESTAT_CLIENT, opcionsCurtes: ESTATS_CLIENT_CURTS, deErp: true },
      {
        nom: "categoria", etiqueta: "Categoria", tipus: "tria", opcions: OPCIONS_LLETRA, calculat: true,
        nota: "Es calcula sola amb la facturació de l'exercici passat, per les franges de Configuració › Valors CRM.",
      },
      {
        nom: "potencial", etiqueta: "Potencial", tipus: "tria", opcions: OPCIONS_LLETRA,
        nota: "El que es creu que pot arribar a comprar, d'A (màxim) a E (mínim). El posa qui porta el compte.",
      },
      {
        // La llista la compara amb les activitats fetes enguany i s'hi filtra per com es va, no per la freqüència.
        nom: "periodicitat", etiqueta: "Periodicitat", tipus: "periodicitat", opcions: PERIODICITATS,
        opcionsCurtes: PERIODICITATS_CURTES, opcionsDelFiltre: SEGUIMENTS,
        nota: "Quantes activitats l'any s'hi volen fer. La llista de clients diu si les d'enguany hi van al dia.",
      },
      { nom: "correu", etiqueta: "Correu", tipus: "text", deErp: true, contacte: "correu" },
      { nom: "telefon", etiqueta: "Telèfon", tipus: "text", deErp: true, contacte: "telefon" },
      { nom: "web", etiqueta: "Web", tipus: "text", deErp: true },
      { nom: "adreca", etiqueta: "Adreça", tipus: "text", ample: "sencer", deErp: true },
      { nom: "poblacio", etiqueta: "Població", tipus: "text", deErp: true, suggeriments: true },
      { nom: "comarca", etiqueta: "Comarca", tipus: "text", suggeriments: true },
      { nom: "codi_postal", etiqueta: "Codi postal", tipus: "text", deErp: true },
      { nom: "provincia", etiqueta: "Província", tipus: "text", deErp: true, suggeriments: true },
      { nom: "pais", etiqueta: "País", tipus: "text", deErp: true },
      { nom: "forma_pagament", etiqueta: "Forma de pagament", tipus: "tria", opcions: FORMES, deErp: true },
      {
        nom: "horari_comercial", etiqueta: "Horari d'atenció comercial", tipus: "horari", ample: "sencer",
        nota: "Quan s'hi pot anar a vendre.",
      },
      {
        nom: "horari_entregues", etiqueta: "Horari d'entregues", tipus: "horari", ample: "sencer",
        nota: "Quan s'hi pot entregar, si no coincideix amb l'anterior.",
      },
      { nom: "tarifa", etiqueta: "Tarifa", tipus: "nombre", nota: "Llista de preus (1-6).", deErp: true },
      { nom: "codi_erp", etiqueta: "Codi a FactuSol", tipus: "nombre", nota: "CODCLI, per lligar-lo amb l'ERP. Amb codi, la sincronització hi porta les dades de l'ERP.", deErp: true },
      {
        nom: "latitud", etiqueta: "Ubicació al mapa", tipus: "decimal", ample: "sencer", parella: "longitud",
        nota: "Buida, es calcula de l'adreça. Si el punt no cau on toca, tria'l al mapa.",
      },
      { nom: "longitud", etiqueta: "Longitud", tipus: "decimal" },
      {
        // El resum que calcula la sincronització: a la llista es pinta amb barres i
        // tendència, s'ordena per l'acumulat d'enguany i es filtra per tendència.
        // Al filtre, «Nou» i «Perdut» no hi són: només es filtra per com va.
        nom: "facturacio_periode", etiqueta: "Facturació", tipus: "facturacio", extern: true,
        opcions: TENDENCIES, campDelFiltre: "facturacio_tendencia",
        opcionsDelFiltre: TENDENCIES.filter(([valor]) => valor !== "nou" && valor !== "perdut"),
      },
      { nom: "data_alta", etiqueta: "Data d'alta", tipus: "data", deErp: true },
      { nom: "notes", etiqueta: "Notes", tipus: "area", ample: "sencer" },
    ],
    seccions: [
      { titol: "Identificació", camps: ["nom_comercial", "rao_social", "nif", "tipus_client", "estat", "codi_erp", "data_alta"] },
      { titol: "Comercial", camps: ["agent", "periodicitat", "categoria", "potencial", "tarifa", "forma_pagament", "notes"] },
      {
        titol: "Contacte i adreça",
        camps: ["telefon", "correu", "web", "adreca", "codi_postal", "poblacio", "comarca", "provincia", "pais", "latitud"],
      },
      { titol: "Horaris", camps: ["horari_comercial", "horari_entregues"] },
    ],
  },

  /**
   * Els cellers: de qui es compra. No són una taula del portal sinó els
   * proveïdors de FactuSol, que la sincronització manté al dia. La clau és
   * «proveidors» perquè és el que són a l'ERP, però a la gent se'ls ensenya
   * com a cellers, que és com se'n parla a la casa.
   */
  proveidors: {
    clau: "proveidors",
    colleccio: "crm_proveidors",
    singular: "Celler",
    article: "nou",
    plural: "Cellers",
    nomesLectura: true,
    titol: "nom_comercial",
    ordre: "nom_comercial",
    cerca: ["nom_comercial", "rao_social", "nif", "poblacio", "provincia", "correu"],
    campFont: "font",
    relacionades: [{ clau: "activitats", camp: "celler", etiqueta: "Activitats" }],
    columnes: [
      { camp: "nom_comercial", etiqueta: "Celler" },
      { camp: "tipus", etiqueta: "Tipus" },
      { camp: "poblacio", etiqueta: "Població" },
      { camp: "provincia", etiqueta: "Província" },
      { camp: "telefon", etiqueta: "Telèfon" },
      { camp: "forma_pagament", etiqueta: "Forma de pagament" },
      { camp: "codi_erp", etiqueta: "Codi ERP" },
      { camp: "estat", etiqueta: "Estat" },
    ],
    camps: [
      // La font la posa la sincronització: el formulari només la fa servir per bloquejar els camps de l'ERP.
      { nom: "font", etiqueta: "Font de les dades", tipus: "tria", opcions: [["factusol", "FactuSol"], ["portal", "Portal"]], extern: true },
      { nom: "nom_comercial", etiqueta: "Nom comercial", tipus: "text", obligatori: true, ample: "sencer", deErp: true },
      { nom: "rao_social", etiqueta: "Raó social", tipus: "text", deErp: true },
      { nom: "nif", etiqueta: "NIF", tipus: "text", deErp: true },
      { nom: "tipus", etiqueta: "Tipus", tipus: "tria", opcions: TIPUS_PROVEIDOR, deErp: true, nota: "Qui ven mercaderia i qui ven serveis." },
      { nom: "estat", etiqueta: "Estat", tipus: "tria", opcions: ESTAT_PROVEIDOR, deErp: true },
      { nom: "persona_contacte", etiqueta: "Persona de contacte", tipus: "text", deErp: true },
      { nom: "telefon", etiqueta: "Telèfon", tipus: "text", deErp: true, contacte: "telefon" },
      { nom: "mobil", etiqueta: "Mòbil", tipus: "text", deErp: true, contacte: "telefon" },
      { nom: "correu", etiqueta: "Correu", tipus: "text", deErp: true, contacte: "correu" },
      { nom: "web", etiqueta: "Web", tipus: "text", deErp: true },
      { nom: "adreca", etiqueta: "Adreça", tipus: "text", ample: "sencer", deErp: true },
      { nom: "poblacio", etiqueta: "Població", tipus: "text", deErp: true, suggeriments: true },
      { nom: "codi_postal", etiqueta: "Codi postal", tipus: "text", deErp: true },
      { nom: "provincia", etiqueta: "Província", tipus: "text", deErp: true, suggeriments: true },
      { nom: "pais", etiqueta: "País", tipus: "text", deErp: true },
      { nom: "forma_pagament", etiqueta: "Forma de pagament", tipus: "text", deErp: true },
      { nom: "retencio", etiqueta: "Retenció (%)", tipus: "decimal", deErp: true },
      { nom: "descompte", etiqueta: "Descompte (%)", tipus: "decimal", deErp: true },
      { nom: "iban", etiqueta: "IBAN", tipus: "text", ample: "sencer", deErp: true },
      { nom: "bic", etiqueta: "BIC", tipus: "text", deErp: true },
      { nom: "banc", etiqueta: "Banc", tipus: "text", deErp: true },
      { nom: "compte_comptable", etiqueta: "Compte comptable", tipus: "text", deErp: true },
      { nom: "codi_erp", etiqueta: "Codi a FactuSol", tipus: "nombre", nota: "CODPRO, per lligar-lo amb l'ERP.", deErp: true },
      { nom: "data_alta", etiqueta: "Data d'alta", tipus: "data", deErp: true },
      { nom: "erp_modificat_el", etiqueta: "Darrer moviment a l'ERP", tipus: "data", deErp: true },
      { nom: "observacions", etiqueta: "Observacions de l'ERP", tipus: "area", ample: "sencer", deErp: true },
      { nom: "notes", etiqueta: "Notes", tipus: "area", ample: "sencer", nota: "Del portal: la sincronització no les toca." },
    ],
  },

  /**
   * Els tipus de client de FactuSol (F_TCL). Els porta la passada de clients i
   * no s'editen des del portal. Quins surten als desplegables del CRM es tria a
   * Directus, amb «Es fa servir al CRM»: la taula és sencera, com a l'ERP.
   */
  tipus_client: {
    clau: "tipus_client",
    colleccio: "crm_tipus_client",
    singular: "Tipus de client",
    article: "nou",
    plural: "Tipus de client",
    nomesLectura: true,
    titol: "nom",
    ordre: "codi_erp",
    cerca: ["nom"],
    campFont: "font",
    opcionsNomes: { camp: "usat_crm", valor: true },
    cataleg: true,
    columnes: [
      { camp: "nom", etiqueta: "Tipus de client" },
      { camp: "codi_erp", etiqueta: "Codi ERP" },
      { camp: "usat_crm", etiqueta: "Al CRM" },
    ],
    camps: [
      { nom: "font", etiqueta: "Font de les dades", tipus: "tria", opcions: [["factusol", "FactuSol"], ["portal", "Portal"]], extern: true },
      { nom: "nom", etiqueta: "Nom", tipus: "text", obligatori: true, ample: "sencer", deErp: true },
      { nom: "codi_erp", etiqueta: "Codi a FactuSol", tipus: "nombre", nota: "CODTCL, el que desa TCLCLI a la fitxa del client.", deErp: true },
      { nom: "usat_crm", etiqueta: "Es fa servir al CRM", tipus: "booleà", nota: "Si surt als desplegables. Es canvia a Directus." },
    ],
  },

  agents: {
    clau: "agents",
    colleccio: "crm_agents",
    singular: "Agent comercial",
    article: "nou",
    plural: "Agents comercials",
    nomesLectura: true,
    titol: "nom",
    ordre: "nom",
    cerca: ["nom"],
    campFont: "font",
    cataleg: true,
    columnes: [
      { camp: "nom", etiqueta: "Agent" },
      { camp: "codi_erp", etiqueta: "Codi ERP" },
    ],
    camps: [
      { nom: "font", etiqueta: "Font de les dades", tipus: "tria", opcions: [["factusol", "FactuSol"], ["portal", "Portal"]], extern: true },
      { nom: "nom", etiqueta: "Nom", tipus: "text", obligatori: true, ample: "sencer", deErp: true },
      { nom: "codi_erp", etiqueta: "Codi a FactuSol", tipus: "nombre", nota: "CODAGE, el que desa AGECLI a la fitxa del client.", deErp: true },
    ],
  },

  segments: {
    clau: "segments",
    colleccio: "crm_segments",
    singular: "Segment",
    article: "nou",
    plural: "Segments",
    titolVista: "Planificador",
    titol: "nom",
    ordre: "ordre",
    cerca: ["nom", "codi"],
    campComercial: "comercial",
    columnes: [
      { camp: "nom", etiqueta: "Segment" },
      { camp: "codi", etiqueta: "Codi" },
      { camp: "mode", etiqueta: "Combinació" },
      { camp: "criteris", etiqueta: "Criteris" },
      { camp: "estat", etiqueta: "Estat" },
    ],
    camps: [
      { nom: "nom", etiqueta: "Nom", tipus: "text", obligatori: true, ample: "sencer" },
      { nom: "codi", etiqueta: "Codi", tipus: "text", nota: "Abreujament per als llistats." },
      { nom: "estat", etiqueta: "Estat", tipus: "tria", opcions: ACTIU },
      {
        nom: "ordre", etiqueta: "Prioritat", tipus: "nombre",
        nota: "Quan un client encaixa en més d'un segment, es queda amb el de número més baix.",
      },
      { nom: "mode", etiqueta: "Combinació", tipus: "tria", opcions: MODES_SEGMENT },
      { nom: "criteris", etiqueta: "Criteris", tipus: "criteris", ample: "sencer" },
      { nom: "notes", etiqueta: "Notes", tipus: "area", ample: "sencer" },
    ],
  },

  contactes: {
    clau: "contactes",
    colleccio: "crm_contactes",
    singular: "Contacte",
    article: "nou",
    plural: "Contactes",
    titol: "nom",
    ordre: "nom",
    cerca: ["nom", "cognoms", "correu", "carrec"],
    columnes: [
      { camp: "nom", etiqueta: "Nom" },
      { camp: "cognoms", etiqueta: "Cognoms" },
      { camp: "carrec", etiqueta: "Càrrec" },
      { camp: "client", etiqueta: "Client" },
      // El mòbil primer, que és el que té WhatsApp; si no n'hi ha, el fix.
      { camp: "mobil", etiqueta: "Telèfon", sino: "telefon" },
      { camp: "correu", etiqueta: "Correu" },
      { camp: "principal", etiqueta: "Principal" },
    ],
    camps: [
      { nom: "nom", etiqueta: "Nom", tipus: "text", obligatori: true },
      { nom: "cognoms", etiqueta: "Cognoms", tipus: "text" },
      { nom: "carrec", etiqueta: "Càrrec", tipus: "text" },
      { nom: "correu", etiqueta: "Correu", tipus: "text", contacte: "correu" },
      { nom: "telefon", etiqueta: "Telèfon", tipus: "text", contacte: "telefon" },
      { nom: "mobil", etiqueta: "Mòbil", tipus: "text", contacte: "telefon" },
      { nom: "client", etiqueta: "Client", tipus: "relacio", relacio: "clients" },
      { nom: "lead", etiqueta: "Lead", tipus: "relacio", relacio: "leads" },
      { nom: "principal", etiqueta: "Interlocutor principal", tipus: "booleà" },
      { nom: "notes", etiqueta: "Notes", tipus: "area", ample: "sencer" },
    ],
  },
};

/**
 * L'ordre de les pestanyes: primer l'embut comercial —qui encara no compra, qui
 * ja compra, què hi ha obert, de qui és el vi i amb qui es parla— i al final les
 * taules que només s'administren de tant en tant.
 */
export const CLAUS_FITXA: ClauFitxa[] = [
  "leads",
  "clients",
  "oportunitats",
  "proveidors",
  "contactes",
  "activitats",
  "segments",
];

export function esClauFitxa(valor: string): valor is ClauFitxa {
  return (CLAUS_FITXA as string[]).includes(valor);
}

/** Qualsevol fitxa, també les que no tenen pestanya però sí desplegable, com els tipus de client. */
export function esFitxa(valor: string): valor is ClauFitxa {
  return valor in FITXES;
}

/** El valor d'un camp de relació, vingui com a id o com a fitxa desplegada. */
export function idDeRelacio(brut: unknown): string {
  if (typeof brut === "string") return brut;
  if (brut && typeof brut === "object" && "id" in brut) return String((brut as { id: unknown }).id);
  return "";
}

/**
 * Per quin camp s'ha de filtrar una relació, i amb quin valor. `null` vol dir
 * que encara no se sap de qui parlem: llavors val més no oferir res que oferir-ho tot.
 */
export function filtreDeRelacio(
  camp: Camp,
  valors: Record<string, unknown>,
): { camp: string; valor: string } | null {
  for (const nom of camp.filtradaPer ?? []) {
    const valor = idDeRelacio(valors[nom]);
    if (valor) return { camp: nom, valor };
  }
  return null;
}

/** Si un camp admet diverses fitxes amb aquests valors del formulari: vegeu `Camp.multiple`. */
export function esMultiple(camp: Camp, valors: Record<string, unknown>) {
  return Boolean(camp.multiple && camp.multiple.valors.includes(String(valors[camp.multiple.camp] ?? "")));
}

/** Un camp condicional només compta si la condició es compleix. */
export function campVisible(camp: Camp, valors: Record<string, unknown>) {
  if (!camp.nomesSi) return true;
  return camp.nomesSi.valors.includes(String(valors[camp.nomesSi.camp] ?? ""));
}

/** «Nova activitat», «Nou contacte»: el text del botó d'alta, ben concordat. */
export function textAlta(fitxa: Fitxa) {
  const article = fitxa.article === "nou" ? "Nou" : "Nova";
  return `${article} ${fitxa.singular.toLowerCase()}`;
}

/**
 * Si la fitxa ve de FactuSol. Aquestes tenen l'ERP com a amo: els seus camps
 * no s'editen ni es desen, i la fitxa no s'esborra (a la propera passada
 * tornaria, i tot el CRM que hi penja es perdria).
 */
export function veDeFactusol(fitxa: Fitxa, valors: Record<string, unknown> | null | undefined) {
  return Boolean(fitxa.campFont && valors?.[fitxa.campFont] === "factusol");
}

/**
 * Si qui només veu les seves pot veure i tocar aquesta fitxa. Amb `deQui` nul
 * (un administrador) ho veu tot; en una fitxa que no és de cadascú, també. Una
 * activitat que no porta ningú és de tothom.
 */
export function esVisiblePer(fitxa: Fitxa, valors: Record<string, unknown> | null | undefined, deQui: string | null) {
  if (!deQui || !fitxa.perComercial || !fitxa.campComercial) return true;
  const de = idDeRelacio(valors?.[fitxa.campComercial]);
  return !de || de === deQui;
}

/** `{ a: { b: condicio } }` a partir de «a.b»: així filtra Directus per una relació. */
function perCami(cami: string, condicio: Record<string, unknown>): Record<string, unknown> {
  return cami
    .split(".")
    .reduceRight<Record<string, unknown>>((dins, tros) => ({ [tros]: dins }), condicio);
}

/**
 * Les condicions de Directus que deixen fora les fitxes que no surten al CRM:
 * les `excloses` i les que no són `nomesAmb`. De les excloses, les que no
 * tenen valor al camp hi entren: un «diferent de» sol també les deixaria fora.
 */
export function condicionsExcloses(fitxa: Fitxa): Record<string, unknown>[] {
  const condicions: Record<string, unknown>[] = [];
  if (fitxa.excloses) {
    const { camp, valor } = fitxa.excloses;
    condicions.push({ _or: [{ [camp]: { _null: true } }, { [camp]: { _neq: valor } }] });
  }
  if (fitxa.nomesAmb) condicions.push(perCami(fitxa.nomesAmb.camp, { _in: fitxa.nomesAmb.valors }));
  return condicions;
}

/**
 * Quines opcions d'una relació té sentit oferir per triar, filtrar o segmentar
 * fitxes d'aquesta: si la fitxa només ensenya uns tipus de client, el
 * desplegable de tipus només ofereix aquests. Torna les condicions sobre la
 * fitxa relacionada, o cap si la relació no hi té res a veure.
 */
export function condicionsDeLesOpcions(fitxa: Fitxa, relacio: ClauFitxa): Record<string, unknown>[] {
  if (!fitxa.nomesAmb) return [];
  const [campRelacio, ...resta] = fitxa.nomesAmb.camp.split(".");
  if (resta.length === 0) return [];
  const camp = fitxa.camps.find((c) => c.nom === campRelacio);
  if (camp?.relacio !== relacio) return [];
  return [perCami(resta.join("."), { _in: fitxa.nomesAmb.valors })];
}
