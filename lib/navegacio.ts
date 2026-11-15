import type { NomIcona } from "@/components/Icones";

export type Enllac = {
  href: string;
  etiqueta: string;
  icona: NomIcona;
  /** Fals mentre el mòdul no estigui llest: no surt al menú. */
  actiu?: boolean;
  /** Només el veu qui administra Directus: als altres no els surt al menú. */
  nomesAdministrador?: boolean;
  /**
   * Només el veu qui veu els clients de tothom (administrador i manager). Els
   * comercials no hi entren: ni al menú ni per adreça (vegeu `exigeixVeuTot`).
   */
  nomesVeuTot?: boolean;
};

/**
 * El menú: tres blocs. Les vistes del CRM són punts de menú propis, encara que
 * totes visquin a /crm i es distingeixin pel paràmetre «v».
 */
export const SECCIONS: { titol: string; enllacos: Enllac[] }[] = [
  {
    titol: "CRM",
    enllacos: [
      { href: "/crm", etiqueta: "Tauler", icona: "tauler" },
      { href: "/crm?v=avui", etiqueta: "Avui", icona: "avui" },
      { href: "/crm?v=planner", etiqueta: "Agenda", icona: "planner" },
      // Tot el que queda per fer, de tots els clients: els To-Do que deixen les activitats en tancar-se.
      { href: "/crm?v=deures", etiqueta: "To-Do", icona: "deures" },
      { href: "/crm?v=activitats", etiqueta: "Activitats", icona: "activitats" },
      // El configurador de vins: una cistella per criteris, desada com a plantilla. També s'obre des d'una activitat.
      { href: "/selector-vins", etiqueta: "Selector de vins", icona: "vins" },
      { href: "/crm?v=segments", etiqueta: "Planificador", icona: "segments" },
      { href: "/crm?v=mapa", etiqueta: "Mapa", icona: "mapa" },
      { href: "/crm?v=oportunitats", etiqueta: "Oportunitats", icona: "oportunitats" },
      { href: "/crm?v=leads", etiqueta: "Leads", icona: "leads" },
      { href: "/crm?v=clients", etiqueta: "Clients", icona: "comptes" },
      { href: "/crm?v=contactes", etiqueta: "Contactes", icona: "contactes" },
    ],
  },
  {
    titol: "ERP",
    enllacos: [
      { href: "/clients", etiqueta: "Clients", icona: "clients", nomesVeuTot: true },
      // Els cellers són els proveïdors de FactuSol. Tenen pantalla pròpia, com
      // els clients, llegida de la còpia que en manté la sincronització.
      { href: "/cellers", etiqueta: "Cellers", icona: "cellers", nomesVeuTot: true },
      // Els articles actius, també de la còpia de la sincronització.
      { href: "/articles", etiqueta: "Articles", icona: "articles", nomesVeuTot: true },
    ],
  },
  {
    titol: "Configuració",
    enllacos: [
      { href: "/compte", etiqueta: "El meu compte", icona: "compte" },
      { href: "/configuracio", etiqueta: "Configuració", icona: "configuracio", nomesVeuTot: true },
      { href: "/usuaris", etiqueta: "Usuaris", icona: "usuaris", nomesAdministrador: true },
    ],
  },
];

/** Mòduls amb ruta però sense pantalla: no surten al menú, però la pàgina en sap el nom. */
export const MODULS_PENDENTS: Enllac[] = [
  // Són de l'ERP: quan tinguin pantalla, també seran només de qui ho veu tot.
  { href: "/tauler", etiqueta: "Tauler comercial", icona: "tauler", actiu: false, nomesVeuTot: true },
  { href: "/vendes", etiqueta: "Vendes", icona: "vendes", actiu: false, nomesVeuTot: true },
  { href: "/proveidors", etiqueta: "Proveïdors", icona: "proveidors", actiu: false, nomesVeuTot: true },
  { href: "/comandes", etiqueta: "Comandes", icona: "comandes", actiu: false, nomesVeuTot: true },
  { href: "/albarans", etiqueta: "Albarans", icona: "albarans", actiu: false, nomesVeuTot: true },
  { href: "/factures", etiqueta: "Factures", icona: "factures", actiu: false, nomesVeuTot: true },
  { href: "/magatzem", etiqueta: "Magatzem", icona: "magatzem", actiu: false, nomesVeuTot: true },
];

export const TOTS_ELS_ENLLACOS = [...SECCIONS.flatMap((seccio) => seccio.enllacos), ...MODULS_PENDENTS];

/**
 * Si la barra lateral està plegada. És una galeta i no localStorage perquè el
 * servidor la pugui llegir i pintar la barra ja plegada, sense salt en carregar.
 */
export const GALETA_BARRA = "wine_backend_barra";

export function cercaEnllac(href: string) {
  return TOTS_ELS_ENLLACOS.find((enllac) => enllac.href === href);
}

/**
 * On viu la fitxa d'un client. Té adreça pròpia perquè s'obre a sobre de la
 * vista d'on es ve sense tornar-la a pintar: vegeu app/(portal)/crm/layout.tsx.
 */
export const RUTA_FITXA_CLIENT = "/crm/clients/";

export const esRutaDeFitxaClient = (ruta: string) => ruta.startsWith(RUTA_FITXA_CLIENT);

/** La fitxa d'un client, amb la pestanya o el que s'hi hagi d'obrir. «nou» n'és l'alta. */
export function rutaDelClient(id: string, params: Record<string, string> = {}) {
  const consulta = new URLSearchParams(params).toString();
  return `${RUTA_FITXA_CLIENT}${encodeURIComponent(id)}${consulta ? `?${consulta}` : ""}`;
}

/** Camí i paràmetres d'un enllaç del menú, per comparar-lo amb on s'és. */
export function partsDeLEnllac(href: string) {
  const [cami, consulta = ""] = href.split("?");
  return { cami, params: Array.from(new URLSearchParams(consulta).entries()) };
}

/**
 * Quin enllaç del menú correspon a la pàgina actual. Es queda amb el que més
 * paràmetres encerta: així «/crm?v=leads» guanya «/crm», i «/crm» només és
 * l'actiu quan no hi ha cap vista demanada (o és el tauler).
 */
export function enllacActiu(enllacos: Enllac[], ruta: string, cerca: URLSearchParams): string | null {
  // La fitxa d'un client és dels clients, s'hagi obert des d'on s'hagi obert.
  if (esRutaDeFitxaClient(ruta)) return enllacActiu(enllacos, "/crm", new URLSearchParams({ v: "clients" }));
  let millor: { href: string; pes: number } | null = null;
  for (const enllac of enllacos) {
    const { cami, params } = partsDeLEnllac(enllac.href);
    if (!(ruta === cami || ruta.startsWith(`${cami}/`))) continue;
    if (!params.every(([clau, valor]) => cerca.get(clau) === valor)) continue;
    // La vista per defecte del CRM és el tauler: «/crm?v=tauler» també és «/crm».
    const vistaDemanada = cerca.get("v");
    if (params.length === 0 && cami === "/crm" && vistaDemanada && vistaDemanada !== "tauler") continue;
    const pes = params.length;
    if (!millor || pes > millor.pes) millor = { href: enllac.href, pes };
  }
  return millor?.href ?? null;
}
