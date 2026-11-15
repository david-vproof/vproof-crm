/**
 * Ordre i filtres per columna d'un llistat de fitxes, tal com viatgen a l'URL.
 *
 *   ordre=poblacio      ascendent      ordre=-poblacio   descendent
 *   filtre.poblacio=Vic una condició per columna, amb el prefix «filtre.»
 *
 * Només s'accepten columnes de la fitxa: qualsevol altra cosa s'ignora.
 */
import { FITXES, type Camp, type Fitxa } from "./crm-fitxes";

export const PARAM_ORDRE = "ordre";
export const PREFIX_FILTRE = "filtre.";
/**
 * Un filtre pot tenir més d'un valor triat: a l'URL van junts, separats per
 * aquest signe («filtre.estat=1|2»). Cap valor filtrable el porta: són ids,
 * codis o noms de lloc.
 */
export const SEPARADOR_FILTRE = "|";
export const PARAM_MIDA = "pp";

/** Els filtres actius d'un llistat: per columna, els valors triats (un o més). */
export type Filtres = Record<string, string[]>;

/** Quantes files per pàgina es poden triar. El 0 vol dir totes, i a l'URL s'escriu «tots». */
export const MIDES_PAGINA = [20, 50, 100, 200, 0];
export const MIDA_PER_DEFECTE = 20;

export function llegeixMida(brut: string | string[] | undefined): number {
  const text = (Array.isArray(brut) ? brut[0] : brut ?? "").trim();
  if (text === "tots") return 0;
  const mida = Number(text);
  return mida > 0 && MIDES_PAGINA.includes(mida) ? mida : MIDA_PER_DEFECTE;
}

/**
 * Els llistats que es van allargant en baixar en lloc de paginar: no tenen
 * pàgines ni selector de mida. Es passen aquí a mesura que es van fent.
 */
const LLISTATS_AMB_SCROLL = new Set<string>(["clients", "activitats", "contactes", "leads"]);

export const teScroll = (clau: string) => LLISTATS_AMB_SCROLL.has(clau);

/** Quantes files porta cada tram d'un llistat amb scroll. */
export const TRAM_SCROLL = 50;

export type OrdreLlistat = { camp: string; descendent: boolean };

/** Columna amb la definició del seu camp, per saber quin control de filtre li toca. */
export type ColumnaLlistat = {
  camp: string;
  etiqueta: string;
  /** Va dins de la cel·la del títol en lloc de fer columna. */
  alTitol?: boolean;
  /** Com es diu a la capçalera quan hi va estreta. */
  curta?: string;
  /** A partir de quina amplada surt a la taula. */
  desDe?: "xl" | "2xl";
  definicio: Camp | undefined;
  /** Les opcions (id, text) del desplegable d'una relació amb un catàleg: surten de la base de dades. */
  opcions?: [string, string][];
  /** Els valors existents que el filtre de text ofereix desplegats: vegeu `Camp.suggeriments`. */
  suggeriments?: string[];
};

export function columnesDe(fitxa: Fitxa): ColumnaLlistat[] {
  return fitxa.columnes.map((columna) => ({
    ...columna,
    definicio: fitxa.camps.find((camp) => camp.nom === columna.camp),
  }));
}

/** Si la columna admet filtre i de quina mena. */
export function menaDeFiltre(definicio: Camp | undefined): "text" | "nombre" | "data" | "tria" | "relacio" | "booleà" | null {
  switch (definicio?.tipus) {
    case "text":
    case "area":
      return "text";
    // Una relació amb un catàleg (els tipus de client) es tria d'un desplegable;
    // amb una taula gran, com els comptes, s'escriu el nom.
    case "relacio":
      return definicio?.relacio && FITXES[definicio.relacio].cataleg ? "relacio" : "text";
    case "nombre":
    case "decimal":
    case "import":
      return "nombre";
    case "data":
    case "datahora":
      return "data";
    case "tria":
    // La facturació es filtra per tendència, i la periodicitat, per com es va: amb un desplegable.
    case "facturacio":
    case "periodicitat":
      return "tria";
    case "booleà":
      return "booleà";
    default:
      return null;
  }
}

export function llegeixOrdre(fitxa: Fitxa, brut: string | undefined): OrdreLlistat | null {
  const text = (brut ?? "").trim();
  if (!text) return null;
  const descendent = text.startsWith("-");
  const camp = descendent ? text.slice(1) : text;
  return fitxa.columnes.some((columna) => columna.camp === camp) ? { camp, descendent } : null;
}

export function llegeixFiltres(fitxa: Fitxa, params: Record<string, string | string[] | undefined>): Filtres {
  const filtres: Filtres = {};
  for (const columna of fitxa.columnes) {
    const brut = params[`${PREFIX_FILTRE}${columna.camp}`];
    // El paràmetre pot venir repetit (un formulari) o amb els valors junts (un enllaç): tot val.
    const valors = [
      ...new Set(
        (Array.isArray(brut) ? brut : [brut ?? ""])
          .flatMap((tros) => tros.split(SEPARADOR_FILTRE))
          .map((valor) => valor.trim())
          .filter(Boolean),
      ),
    ];
    if (valors.length > 0 && menaDeFiltre(fitxa.camps.find((camp) => camp.nom === columna.camp))) filtres[columna.camp] = valors;
  }
  // Un filtre tancat no compta encara que arribi per l'URL.
  for (const camp of filtresTancats(filtres)) delete filtres[camp];
  return filtres;
}

/**
 * Filtres que en deixen un altre sense sentit. Un client de categoria A ja és
 * al capdamunt: no té cap potencial per sobre on arribar, així que filtrant
 * per la A el potencial no es pot triar.
 */
export const FILTRES_QUE_EN_TANQUEN: { camp: string; valor: string; tanca: string }[] = [
  { camp: "categoria", valor: "A", tanca: "potencial" },
];

/**
 * Els camps que no es poden filtrar amb els filtres que hi ha posats. Només
 * tanca quan el filtre és exactament aquell valor: amb la A i la B triades, el
 * potencial encara diu alguna cosa.
 */
export function filtresTancats(filtres: Filtres): Set<string> {
  return new Set(
    FILTRES_QUE_EN_TANQUEN.filter((regla) => {
      const valors = filtres[regla.camp];
      return valors?.length === 1 && valors[0] === regla.valor;
    }).map((regla) => regla.tanca),
  );
}

/** Els paràmetres d'URL que conserven l'ordre i els filtres actuals. */
export function paramsDeLlistat(ordre: OrdreLlistat | null, filtres: Filtres, mida = MIDA_PER_DEFECTE): Record<string, string> {
  const params: Record<string, string> = {};
  if (ordre) params[PARAM_ORDRE] = `${ordre.descendent ? "-" : ""}${ordre.camp}`;
  if (mida !== MIDA_PER_DEFECTE) params[PARAM_MIDA] = mida === 0 ? "tots" : String(mida);
  for (const [camp, valors] of Object.entries(filtres)) {
    if (valors.length > 0) params[`${PREFIX_FILTRE}${camp}`] = valors.join(SEPARADOR_FILTRE);
  }
  return params;
}

/** Clicar la capçalera va d'ascendent a descendent i després treu l'ordre. */
export function seguentOrdre(actual: OrdreLlistat | null, camp: string): OrdreLlistat | null {
  if (actual?.camp !== camp) return { camp, descendent: false };
  return actual.descendent ? null : { camp, descendent: true };
}
