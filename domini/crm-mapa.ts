/**
 * El mapa de comptes: projecció i agrupació, sense res de Leaflet ni de xarxa.
 *
 * Cada punt és un establiment d'un client (una direcció d'entrega de l'ERP)
 * o, si el client no en té cap, la seva adreça. La idea és que a poc zoom no es
 * vegin cent xinxetes trepitjant-se, sinó unes quantes rodones grans que diuen
 * quants n'hi ha a sota. En apropar-se, les rodones es van partint fins que
 * cada establiment és el seu propi punt; els que cauen al mateix lloc s'obren en
 * espiral (vegeu `posicionsAranya`).
 */
import type { Lletra } from "@/domini/crm-fitxes";

export type PuntCompte = {
  /** Clau única del punt: l'id de l'establiment o, si és l'adreça del client, el del client. */
  id: string;
  /** El client de qui és el punt: on porta en tocar-lo i qui compta als comptadors. */
  clientId: string;
  /** El nom del client. */
  nom: string;
  /** El nom de l'establiment, o null si el punt és l'adreça del client. */
  establiment: string | null;
  /** L'adreça del punt, per al rètol. */
  adreca: string;
  latitud: number;
  longitud: number;
  poblacio: string;
  tipusClient: string;
  /** L'agent comercial de l'ERP: l'id per filtrar i el nom per ensenyar. Buits si no en té. */
  agentId: string;
  agent: string;
  /** Les dues lletres: la categoria (calculada amb la facturació) i el potencial (posat a mà). */
  categoria: Lletra | null;
  potencial: Lletra | null;
  /** El segment on encaixa, per pintar-lo i per poder-lo destacar. */
  segmentId: string;
  segment: string;
  color: string;
};

export type Grup = {
  latitud: number;
  longitud: number;
  membres: PuntCompte[];
  /** Radi en píxels de la rodona que el representa. */
  radi: number;
};

const MIDA_RAJOLA = 256;

/** Projecció de Mercator a píxels del món per a un zoom donat. */
export function projecta(latitud: number, longitud: number, zoom: number) {
  const escala = MIDA_RAJOLA * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitud)) * (Math.PI / 180);
  return {
    x: ((longitud + 180) / 360) * escala,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * escala,
  };
}

/**
 * El radi de la rodona. Creix amb l'arrel del nombre de comptes, no amb el
 * nombre: així l'àrea és proporcional al que hi ha a dins, que és com l'ull
 * compara mides. Un compte sol ja té prou cos per dur les seves dues lletres.
 */
export function radiDeGrup(quants: number) {
  if (quants <= 1) return 15;
  return Math.min(42, 17 + 6 * Math.sqrt(quants - 1));
}

/** Costat de la cel·la de la primera passada d'agrupació, en píxels de pantalla. */
const CELLA_PX = 48;
/** Aire mínim entre dues rodones, en píxels: si no hi cap, són una de sola. */
const AIRE_PX = 6;

type GrupEnPixels = { x: number; y: number; membres: PuntCompte[]; radi: number };

function grupDe(membres: PuntCompte[], zoom: number): GrupEnPixels {
  // El centre del grup és la mitjana dels seus: la rodona cau on són.
  let x = 0;
  let y = 0;
  for (const punt of membres) {
    const p = projecta(punt.latitud, punt.longitud, zoom);
    x += p.x;
    y += p.y;
  }
  return { x: x / membres.length, y: y / membres.length, membres, radi: radiDeGrup(membres.length) };
}

/** Si dues rodones es trepitgen (o no hi queda l'aire mínim entre elles). */
function esTrepitgen(a: GrupEnPixels, b: GrupEnPixels) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const minim = a.radi + b.radi + AIRE_PX;
  return dx * dx + dy * dy < minim * minim;
}

/**
 * Agrupa els comptes de manera que cap rodona en tapi cap altra. Primer, una
 * passada ràpida per cel·les d'una graella en píxels projectats; després, es
 * van fonent les rodones que es trepitgen fins que no en queda cap parella,
 * perquè una rodona creix en absorbir-ne una altra i pot arribar a tocar-ne
 * una tercera. Tot és en píxels de pantalla, així que al zoom que sigui les
 * rodones queden sempre separades.
 */
export function agrupaComptes(punts: PuntCompte[], zoom: number): Grup[] {
  const celles = new Map<string, PuntCompte[]>();
  for (const punt of punts) {
    const { x, y } = projecta(punt.latitud, punt.longitud, zoom);
    const clau = `${Math.floor(x / CELLA_PX)}:${Math.floor(y / CELLA_PX)}`;
    const cella = celles.get(clau);
    if (cella) cella.push(punt);
    else celles.set(clau, [punt]);
  }

  let grups = [...celles.values()].map((membres) => grupDe(membres, zoom));
  const abast = 2 * radiDeGrup(Number.MAX_SAFE_INTEGER) + AIRE_PX;
  let fos = true;
  while (fos) {
    fos = false;
    grups.sort((a, b) => a.x - b.x);
    const resultat: GrupEnPixels[] = [];
    for (const grup of grups) {
      // Només cal mirar els que queden a l'abast en x: els més a l'esquerra no poden tocar-lo.
      let trobat: GrupEnPixels | undefined;
      for (let i = resultat.length - 1; i >= 0 && grup.x - resultat[i].x <= abast; i -= 1) {
        if (esTrepitgen(grup, resultat[i])) {
          trobat = resultat[i];
          break;
        }
      }
      if (trobat) {
        resultat[resultat.indexOf(trobat)] = grupDe([...trobat.membres, ...grup.membres], zoom);
        fos = true;
      } else {
        resultat.push(grup);
      }
    }
    grups = resultat;
  }

  return grups.map(({ membres, radi }) => ({
    latitud: membres.reduce((suma, m) => suma + m.latitud, 0) / membres.length,
    longitud: membres.reduce((suma, m) => suma + m.longitud, 0) / membres.length,
    // Ordenats per nom, i els d'un mateix client per establiment: la llista del rètol no balla entre zooms.
    membres: [...membres].sort(
      (a, b) => a.nom.localeCompare(b.nom, "ca") || (a.establiment ?? "").localeCompare(b.establiment ?? "", "ca"),
    ),
    radi,
  }));
}

/** Quants clients diferents hi ha entre uns punts: un client amb tres establiments compta un cop. */
export function quantsClients(punts: PuntCompte[]) {
  return new Set(punts.map((punt) => punt.clientId)).size;
}

/**
 * Si els punts d'un grup cauen tots al mateix lloc: apropar-s'hi no els
 * separaria mai. Passa sovint, perquè una adreça que OpenStreetMap no troba
 * queda al mig del poble, com totes les altres del mateix poble. Es mira en
 * píxels al zoom més gran: si no se separen ni allà, són el mateix punt.
 */
export function cauenAlMateixLloc(punts: PuntCompte[], zoomMaxim: number) {
  if (punts.length < 2) return true;
  const primer = projecta(punts[0].latitud, punts[0].longitud, zoomMaxim);
  return punts.every((punt) => {
    const { x, y } = projecta(punt.latitud, punt.longitud, zoomMaxim);
    return Math.abs(x - primer.x) < 2 && Math.abs(y - primer.y) < 2;
  });
}

/** Distància entre dos punts seguits de l'espiral, en píxels: el diàmetre d'un punt sol i una mica d'aire. */
const SEPARACIO_ARANYA_PX = 36;
/** Fins a quants es posen en cercle; més, en espiral, que no s'escampa tant. */
const MAXIM_CERCLE = 9;

/**
 * On va cada punt d'un grup que s'obre en espiral, en píxels respecte del
 * centre. Pocs, en cercle; molts, en una espiral que es va obrint, com fa
 * Leaflet.markercluster. Així es poden veure i tocar un per un encara que
 * tinguin les mateixes coordenades.
 */
export function posicionsAranya(quants: number): { x: number; y: number }[] {
  if (quants <= 0) return [];
  if (quants === 1) return [{ x: 0, y: 0 }];

  if (quants <= MAXIM_CERCLE) {
    const radi = Math.max(SEPARACIO_ARANYA_PX, (SEPARACIO_ARANYA_PX * quants) / (2 * Math.PI));
    const pas = (2 * Math.PI) / quants;
    // Comença a dalt de tot, que és on l'ull el busca.
    return Array.from({ length: quants }, (_, i) => ({
      x: radi * Math.cos(i * pas - Math.PI / 2),
      y: radi * Math.sin(i * pas - Math.PI / 2),
    }));
  }

  const posicions: { x: number; y: number }[] = [];
  let radi = SEPARACIO_ARANYA_PX * 0.9;
  let angle = 0;
  for (let i = 0; i < quants; i += 1) {
    // Cada pas avança el mateix tros d'arc, i el radi creix una volta per cada separació.
    angle += SEPARACIO_ARANYA_PX / radi;
    radi += (SEPARACIO_ARANYA_PX * 1.1) / ((2 * Math.PI * radi) / SEPARACIO_ARANYA_PX);
    posicions.push({ x: radi * Math.cos(angle), y: radi * Math.sin(angle) });
  }
  return posicions;
}

export type Enquadrament = { sud: number; oest: number; nord: number; est: number };

/**
 * On s'obre el mapa: Catalunya sencera, que és on hi ha la cartera. Encaixar
 * tots els punts l'obria mig món enllà, perquè hi ha clients a França, a
 * Dinamarca i fins al Japó.
 */
export const CATALUNYA: Enquadrament = { sud: 40.52, oest: 0.16, nord: 42.86, est: 3.33 };

/** El rectangle que conté tots els punts, per enquadrar el mapa en obrir-lo. */
export function enquadra(punts: PuntCompte[]): Enquadrament | null {
  if (punts.length === 0) return null;
  const lats = punts.map((p) => p.latitud);
  const lons = punts.map((p) => p.longitud);
  return {
    sud: Math.min(...lats),
    oest: Math.min(...lons),
    nord: Math.max(...lats),
    est: Math.max(...lons),
  };
}

/** Una regió dibuixada al mapa: el contorn, com a llista de punts [latitud, longitud]. */
export type Regio = [number, number][];

/**
 * Si un punt cau dins d'una regió, pel mètode del raig: es compten quantes
 * vegades una semirecta cap a l'est talla el contorn. Per a les distàncies
 * d'una zona comercial, tractar les coordenades com a pla és prou precís.
 */
export function puntDinsRegio(latitud: number, longitud: number, regio: Regio) {
  let dins = false;
  for (let i = 0, j = regio.length - 1; i < regio.length; j = i++) {
    const [latI, lonI] = regio[i];
    const [latJ, lonJ] = regio[j];
    const creua = latI > latitud !== latJ > latitud && longitud < ((lonJ - lonI) * (latitud - latI)) / (latJ - latI) + lonI;
    if (creua) dins = !dins;
  }
  return dins;
}

/** Una regió tal com es desa dins d'un criteri de segment: JSON amb almenys tres punts vàlids. */
export function llegeixRegio(text: string): Regio | null {
  try {
    const brut = JSON.parse(text);
    if (!Array.isArray(brut)) return null;
    const punts = brut.filter(
      (punt): punt is [number, number] =>
        Array.isArray(punt) && punt.length === 2 && punt.every((valor) => typeof valor === "number" && Number.isFinite(valor)),
    );
    return punts.length >= 3 ? punts : null;
  } catch {
    return null;
  }
}

/** Una regió per desar: coordenades arrodonides a uns pocs metres, que prou precisió n'hi ha. */
export function textDeRegio(regio: Regio) {
  return JSON.stringify(regio.map(([latitud, longitud]) => [Math.round(latitud * 1e5) / 1e5, Math.round(longitud * 1e5) / 1e5]));
}

// ------------------------------------------------------------------ cerca

/** Text sense accents ni majúscules, amb els espais ben posats, per comparar. */
function normalitza(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Els punts del mapa que responen a un text: cada paraula ha de sortir al nom
 * del client, al de l'establiment, a la població o a l'adreça. Es busca al
 * navegador, entre els punts que ja hi ha: només es pot anar als clients que
 * són al mapa. Primer els que ho tenen al nom, i després els que només ho
 * tenen a la població o l'adreça.
 */
export function cercaPunts(punts: PuntCompte[], text: string, maxim = 8): PuntCompte[] {
  const paraules = normalitza(text).split(" ").filter(Boolean);
  if (paraules.length === 0) return [];
  const pelNom: PuntCompte[] = [];
  const perLloc: PuntCompte[] = [];
  for (const punt of punts) {
    const nom = normalitza(`${punt.nom} ${punt.establiment ?? ""}`);
    const lloc = normalitza(`${punt.poblacio} ${punt.adreca}`);
    if (paraules.every((paraula) => nom.includes(paraula))) pelNom.push(punt);
    else if (paraules.every((paraula) => nom.includes(paraula) || lloc.includes(paraula))) perLloc.push(punt);
    if (pelNom.length >= maxim) break;
  }
  return [...pelNom, ...perLloc].slice(0, maxim);
}

/**
 * On s'ha d'anar després d'una cerca: un client del mapa, que es ressalta amb
 * una anella, o un lloc trobat per l'adreça, que es marca amb una xinxeta. La
 * `tanda` puja a cada cerca perquè tornar a triar el mateix també hi porti.
 */
export type PuntDestacat = { latitud: number; longitud: number; nom: string; mena: "client" | "lloc"; tanda: number };
