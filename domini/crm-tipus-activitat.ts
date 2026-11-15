/**
 * Els tipus d'activitat.
 *
 * Viuen a la base de dades (`crm_tipus_activitat`) i es mantenen a Configuració › Valors
 * CRM. Una activitat desa el `valor` del seu tipus, que no canvia mai: per això
 * es pot canviar el nom d'un tipus sense tocar cap activitat. Les marques diuen
 * què porta cada tipus. El que va lligat a un valor concret (els diversos
 * clients d'una visita al laboratori) és a `crm-fitxes.ts` i no s'activa en un de nou.
 */
import type { Camp, Fitxa } from "./crm-fitxes";

export type DefinicioTipus = {
  /** La fila de la base de dades. Null mentre no hi és: un de nou, o si encara no hi ha la taula. */
  id: string | null;
  /** El que es desa a l'activitat. Surt del nom en crear-lo i ja no canvia. */
  valor: string;
  nom: string;
  /** És anar-hi: compta a les visites del tauler. */
  visita: boolean;
  /** Hi ha producte damunt la taula: porta els productes presentats. */
  ambProductes: boolean;
  /** Hi ha un laboratori pel mig: porta el camp del laboratori. */
  ambLaboratori: boolean;
  /** S'ofereix en crear activitats. Les que ja el tenen el conserven igualment. */
  actiu: boolean;
};

/** El que envia la taula de Configuració: el valor no hi és perquè no es tria. */
export type TipusEnviat = Omit<DefinicioTipus, "valor">;

/** La visita en què un o més clients vénen al laboratori: és l'única que en pot portar diversos. */
export const VISITA_CLIENTS_A_LABORATORI = "visita_laboratori";

/** La visita en què diversos laboratoris van a veure un client: n'hi surt una per laboratori. */
export const VISITA_LABORATORIS_A_CLIENT = "visita_laboratoris_client";

const base = (valor: string, nom: string, marques: Partial<Pick<DefinicioTipus, "visita" | "ambProductes" | "ambLaboratori">> = {}): DefinicioTipus => ({
  id: null,
  valor,
  nom,
  visita: false,
  ambProductes: false,
  ambLaboratori: false,
  actiu: true,
  ...marques,
});

/**
 * Els de partida. El portal els coneix pel valor, així que no s'esborren: es
 * poden canviar de nom o desactivar. Són també els que manen mentre la base de dades no
 * té la taula.
 */
export const TIPUS_BASE: DefinicioTipus[] = [
  base("trucada", "Trucada"),
  base("visita_sense_productes", "Visita normal", { visita: true }),
  base("visita_amb_productes", "Visita amb productes", { visita: true, ambProductes: true }),
  base("visita_laboratori_client", "Visita de laboratori a client", { visita: true, ambProductes: true, ambLaboratori: true }),
  base(VISITA_LABORATORIS_A_CLIENT, "Visita de laboratoris a client", { visita: true, ambProductes: true, ambLaboratori: true }),
  base(VISITA_CLIENTS_A_LABORATORI, "Visita de client/s a laboratori", { visita: true, ambProductes: true, ambLaboratori: true }),
  base("correu", "Correu"),
  base("reunio", "Reunió"),
];

export const LLARGADA_MAXIMA_NOM = 60;

export function esTipusBase(valor: string) {
  return TIPUS_BASE.some((tipus) => tipus.valor === valor);
}

/** Com es diu un tipus. Un valor que ja no és a la taula surt com a «Activitat». */
export function nomDelTipus(llista: DefinicioTipus[], valor: string) {
  return llista.find((tipus) => tipus.valor === valor)?.nom ?? "Activitat";
}

export function tipusPortaProducte(llista: DefinicioTipus[], valor: string) {
  return llista.some((tipus) => tipus.valor === valor && tipus.ambProductes);
}

/** Els que es poden triar en crear una activitat: [valor, nom]. */
export function opcionsDeTipus(llista: DefinicioTipus[]): [string, string][] {
  return llista.filter((tipus) => tipus.actiu).map((tipus) => [tipus.valor, tipus.nom]);
}

/** Els valors dels tipus que porten una cosa o una altra: és el que fa sortir el camp al formulari. */
export function valorsAmb(llista: DefinicioTipus[], marca: "ambProductes" | "ambLaboratori") {
  return llista.filter((tipus) => tipus[marca]).map((tipus) => tipus.valor);
}

/** Quina marca fa sortir cada camp condicional de l'activitat. */
const MARCA_DEL_CAMP: Record<string, "ambProductes" | "ambLaboratori"> = { laboratori: "ambLaboratori", productes: "ambProductes", referencies: "ambProductes" };

/**
 * La fitxa de les activitats amb els tipus que hi ha ara. `crm-fitxes.ts` és una
 * descripció fixa que porta els de partida; els de debò arriben de la base de dades.
 * Hi van tots, també els desactivats: una activitat antiga s'ha de poder llegir
 * i trobar pel seu tipus, encara que ja no se n'ofereixi cap de nou.
 */
export function ambTipusActivitat(fitxa: Fitxa, llista: DefinicioTipus[]): Fitxa {
  const adapta = (camp: Camp): Camp => {
    if (camp.nom === "tipus") {
      return {
        ...camp,
        opcions: llista.map((tipus) => [tipus.valor, tipus.nom]),
        opcionsRetirades: llista.filter((tipus) => !tipus.actiu).map((tipus) => tipus.valor),
      };
    }
    const marca = MARCA_DEL_CAMP[camp.nom];
    return marca && camp.nomesSi ? { ...camp, nomesSi: { ...camp.nomesSi, valors: valorsAmb(llista, marca) } } : camp;
  };
  return { ...fitxa, camps: fitxa.camps.map(adapta) };
}

const senseAccents = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** «Fira de Vic» → «fira_de_vic». Si ja n'hi ha un, «fira_de_vic_2». Sense ni una lletra, «tipus». */
export function valorNouDeTipus(nom: string, usats: ReadonlySet<string>) {
  const arrel = senseAccents(nom).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "tipus";
  if (!usats.has(arrel)) return arrel;
  let numero = 2;
  while (usats.has(`${arrel}_${numero}`)) numero += 1;
  return `${arrel}_${numero}`;
}

/** Què té de dolent la llista tal com quedaria en desar. Null si res. */
export function validaTipus(llista: Pick<DefinicioTipus, "nom" | "actiu">[]): string | null {
  const vistos = new Set<string>();
  for (const { nom } of llista) {
    const net = nom.trim();
    if (!net) return "Cada tipus ha de tenir un nom.";
    if (net.length > LLARGADA_MAXIMA_NOM) return `«${net.slice(0, 20)}…» és massa llarg: com a molt, ${LLARGADA_MAXIMA_NOM} caràcters.`;
    const clau = senseAccents(net).replace(/\s+/g, " ");
    if (vistos.has(clau)) return `Hi ha dos tipus que es diuen «${net}».`;
    vistos.add(clau);
  }
  if (!llista.some((tipus) => tipus.actiu)) return "Ha de quedar algun tipus que es pugui triar: si no, no es podria crear cap activitat.";
  return null;
}

/** El JSON de la taula de Configuració. No és de fiar, encara que l'hagi muntat el portal. */
export function llegeixTipusEnviats(brut: unknown): TipusEnviat[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((fila): fila is Record<string, unknown> => typeof fila === "object" && fila !== null)
    .map((fila) => ({
      id: typeof fila.id === "string" && fila.id ? fila.id : null,
      nom: String(fila.nom ?? "").trim(),
      visita: fila.visita === true,
      ambProductes: fila.ambProductes === true,
      ambLaboratori: fila.ambLaboratori === true,
      actiu: fila.actiu === true,
    }));
}
