/**
 * El calendari del Planner: graella del mes i repartiment de les activitats.
 *
 * Tot és càlcul pur. La feina delicada és el fus: Directus desa les marques de
 * temps en UTC i una visita de les onze del vespre cauria el dia següent si es
 * llegís en cru des d'un servidor que va en UTC, com el de Cloud Run. Per això
 * el dia i l'hora d'una activitat es deriven sempre amb el fus del negoci.
 */
import type { Lletra } from "@/domini/crm-fitxes";

export const ZONA = "Europe/Madrid";

const DIA_MS = 24 * 60 * 60 * 1000;

// «en-CA» dona AAAA-MM-DD, que és exactament la clau que fa servir la graella.
const clauDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const horaLocal = new Intl.DateTimeFormat("ca-ES", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type Esdeveniment = {
  id: string;
  /** Dia local, AAAA-MM-DD: és el que decideix a quina casella cau. */
  dia: string;
  /** Hora local, HH:MM. Buida si la marca de temps no era vàlida. */
  hora: string;
  /** Com es diu el tipus d'activitat, no el valor que es desa. */
  tipus: string;
  titol: string;
  /** Qui es visita: és el que es vol llegir en un calendari de ruta. */
  compte: string;
  /** Categoria (calculada) i potencial (posat a mà) del compte, d'A a E. Els leads encara no en tenen. */
  categoria: Lletra | null;
  potencial: Lletra | null;
  /** Com ha acabat. Buit mentre encara és oberta. */
  resultat: string;
  /** Si ja s'ha tancat: al calendari es distingeix del que queda per fer. */
  tancada: boolean;
  /** Segment on encaixa el compte. Buit si no encaixa en cap. */
  segmentId: string;
  segment: string;
  color: string;
};

/** Les activitats d'un dia que cauen al mateix segment. */
export type GrupSegment = {
  segmentId: string;
  segment: string;
  color: string;
  esdeveniments: Esdeveniment[];
};

export type DiaPlanner = {
  clau: string;
  numero: number;
  delMes: boolean;
  avui: boolean;
  capDeSetmana: boolean;
  /** El dia partit per segments: primer el grup, després qui s'hi visita. */
  grups: GrupSegment[];
  total: number;
};

/**
 * Colors de segment. Són prou foscos per llegir-se com a text i prou distints
 * entre ells; el primer és el de la casa, que se sol endur el segment principal.
 */
export const PALETA_SEGMENTS = [
  "#8c2f45", "#2f6f8c", "#6b4c9a", "#b06d1f",
  "#2f7d5a", "#a33b6a", "#3d5a80", "#96562a",
];

export const SENSE_SEGMENT = "Sense segment";
export const COLOR_SENSE_SEGMENT = "#857878";

export function colorSegment(posicio: number) {
  return PALETA_SEGMENTS[posicio % PALETA_SEGMENTS.length];
}

/** Agrupa les activitats d'un dia per segment, amb el «sense» sempre al final. */
function agrupaPerSegment(esdeveniments: Esdeveniment[]): GrupSegment[] {
  const grups = new Map<string, GrupSegment>();

  for (const acte of esdeveniments) {
    const grup = grups.get(acte.segmentId);
    if (grup) grup.esdeveniments.push(acte);
    else {
      grups.set(acte.segmentId, {
        segmentId: acte.segmentId,
        segment: acte.segment,
        color: acte.color,
        esdeveniments: [acte],
      });
    }
  }

  return [...grups.values()].sort((a, b) => {
    if (!a.segmentId !== !b.segmentId) return a.segmentId ? -1 : 1;
    return a.segment.localeCompare(b.segment, "ca");
  });
}

export type MesPlanner = {
  any: number;
  mes: number;
  etiqueta: string;
  setmanes: DiaPlanner[][];
  /** Activitats dins del mes, sense comptar les vores d'altres mesos. */
  total: number;
  /** De les que ja han passat, quantes segueixen obertes. */
  perTancar: number;
  anterior: string;
  seguent: string;
  actual: string;
};

/** Dia i hora locals d'una marca de temps de Directus. */
export function momentLocal(marca: string | null): { dia: string; hora: string } | null {
  if (!marca) return null;
  const quan = new Date(marca);
  if (Number.isNaN(quan.getTime())) return null;
  return { dia: clauDia.format(quan), hora: horaLocal.format(quan) };
}

/**
 * Desplaçament del fus del negoci, en minuts, per a un instant donat. Cal
 * calcular-lo per a cada instant i no una vegada: a l'estiu són dues hores i a
 * l'hivern una.
 */
function desplacament(quan: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(quan)
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const comSiFosUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (comSiFosUtc - quan.getTime()) / 60_000;
}

/**
 * «2026-09-15T09:00» escrit per una persona d'aquí, convertit a l'instant en
 * UTC que li correspon. Sense això, un servidor que va en UTC —com el de Cloud
 * Run— desaria les nou del matí com les nou UTC, i el calendari les ensenyaria
 * a les onze.
 *
 * Es fa en dues passades perquè el desplaçament depèn de l'instant que s'està
 * calculant: la segona ja cau bé fins i tot les nits que es canvia l'hora.
 */
export function instantDeLocal(local: string): string | null {
  const net = local.trim().slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(net)) return null;

  const suposat = new Date(`${net}:00Z`);
  if (Number.isNaN(suposat.getTime())) return null;

  let instant = new Date(suposat.getTime() - desplacament(suposat) * 60_000);
  instant = new Date(suposat.getTime() - desplacament(instant) * 60_000);
  return instant.toISOString();
}

/** El dia d'avui segons el fus del negoci, no el del servidor. */
export function avuiLocal(ara = new Date()) {
  return clauDia.format(ara);
}

/** «2026-09» → {any, mes}. Qualsevol cosa rara cau al mes en curs. */
export function analitzaMes(text: string | undefined, ara = new Date()) {
  const trobat = /^(\d{4})-(\d{2})$/.exec((text ?? "").trim());
  if (trobat) {
    const any = Number(trobat[1]);
    const mes = Number(trobat[2]);
    if (any >= 1970 && any <= 2999 && mes >= 1 && mes <= 12) return { any, mes };
  }
  const [a, m] = avuiLocal(ara).split("-");
  return { any: Number(a), mes: Number(m) };
}

export function clauMes(any: number, mes: number) {
  return `${any}-${String(mes).padStart(2, "0")}`;
}

function mouMesos(any: number, mes: number, passos: number) {
  const total = (any * 12 + (mes - 1)) + passos;
  return clauMes(Math.floor(total / 12), (total % 12) + 1);
}

function clauDeData(quan: Date) {
  return `${quan.getUTCFullYear()}-${String(quan.getUTCMonth() + 1).padStart(2, "0")}-${String(
    quan.getUTCDate(),
  ).padStart(2, "0")}`;
}

/**
 * El primer i el darrer dia que ensenya la graella. La setmana comença dilluns
 * i només es dibuixen les files que calen, així cap mes no arrossega una fila
 * buida al final.
 */
export function graellaDelMes(any: number, mes: number) {
  const primer = new Date(Date.UTC(any, mes - 1, 1));
  // getUTCDay() dona 0 per diumenge: es gira perquè el 0 sigui dilluns.
  const desplacament = (primer.getUTCDay() + 6) % 7;
  const dies = new Date(Date.UTC(any, mes, 0)).getUTCDate();
  const caselles = Math.ceil((desplacament + dies) / 7) * 7;
  const inici = new Date(primer.getTime() - desplacament * DIA_MS);
  return { inici, caselles };
}

/**
 * Marges de la consulta, en ISO i amb un dia de coixí a cada banda: la graella
 * es reparteix per dia local i el coixí cobreix el desplaçament del fus.
 */
export function marges(any: number, mes: number) {
  const { inici, caselles } = graellaDelMes(any, mes);
  return {
    desde: new Date(inici.getTime() - DIA_MS).toISOString(),
    fins: new Date(inici.getTime() + (caselles + 1) * DIA_MS).toISOString(),
  };
}

export function construeixMes(
  any: number,
  mes: number,
  esdeveniments: Esdeveniment[],
  avui = avuiLocal(),
): MesPlanner {
  const perDia = new Map<string, Esdeveniment[]>();
  for (const esdeveniment of esdeveniments) {
    const llista = perDia.get(esdeveniment.dia);
    if (llista) llista.push(esdeveniment);
    else perDia.set(esdeveniment.dia, [esdeveniment]);
  }
  for (const llista of perDia.values()) llista.sort((a, b) => a.hora.localeCompare(b.hora));

  const { inici, caselles } = graellaDelMes(any, mes);
  const prefix = clauMes(any, mes);
  const setmanes: DiaPlanner[][] = [];
  let total = 0;
  let perTancar = 0;

  for (let i = 0; i < caselles; i += 1) {
    const quan = new Date(inici.getTime() + i * DIA_MS);
    const clau = clauDeData(quan);
    const delMes = clau.startsWith(prefix);
    const delDia = perDia.get(clau) ?? [];
    if (delMes) {
      total += delDia.length;
      // Del que ja ha passat, el que ningú no ha tancat. Es compta per dies:
      // una visita d'aquesta tarda encara no és cap deute.
      if (clau < avui) perTancar += delDia.filter((acte) => !acte.tancada).length;
    }

    const setmana = Math.floor(i / 7);
    if (!setmanes[setmana]) setmanes[setmana] = [];
    setmanes[setmana].push({
      clau,
      numero: quan.getUTCDate(),
      delMes,
      avui: clau === avui,
      capDeSetmana: i % 7 >= 5,
      grups: agrupaPerSegment(delDia),
      total: delDia.length,
    });
  }

  const etiqueta = new Intl.DateTimeFormat("ca-ES", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(any, mes - 1, 1)));

  return {
    any,
    mes,
    etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1),
    setmanes,
    total,
    perTancar,
    anterior: mouMesos(any, mes, -1),
    seguent: mouMesos(any, mes, 1),
    actual: prefix,
  };
}

export const DIES_SETMANA = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];
export const DIES_SETMANA_LLARG = [
  "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge",
];

// ------------------------------------------------------------------ setmana

export type SetmanaPlanner = {
  etiqueta: string;
  dies: DiaPlanner[];
  total: number;
  /** De les que ja han passat, quantes segueixen obertes. */
  perTancar: number;
  /** Dilluns de la setmana anterior i de la següent, i el d'aquesta. */
  anterior: string;
  seguent: string;
  actual: string;
};

/** «2026-09-04» → la mateixa data. Qualsevol cosa rara cau al dia d'avui. */
export function analitzaDia(text: string | undefined, ara = new Date()) {
  const net = (text ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(net) && !Number.isNaN(new Date(`${net}T00:00:00Z`).getTime())) return net;
  return avuiLocal(ara);
}

function deClau(clau: string) {
  return new Date(`${clau}T00:00:00Z`);
}

function aClau(quan: Date) {
  return `${quan.getUTCFullYear()}-${String(quan.getUTCMonth() + 1).padStart(2, "0")}-${String(
    quan.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** El dilluns de la setmana on cau un dia. */
export function dillunsDe(clau: string) {
  const quan = deClau(clau);
  const desplacament = (quan.getUTCDay() + 6) % 7;
  return aClau(new Date(quan.getTime() - desplacament * DIA_MS));
}

/** Marges de la consulta d'una setmana, amb un dia de coixí per al fus. */
export function margesSetmana(clau: string) {
  const dilluns = deClau(dillunsDe(clau));
  return {
    desde: new Date(dilluns.getTime() - DIA_MS).toISOString(),
    fins: new Date(dilluns.getTime() + 8 * DIA_MS).toISOString(),
  };
}

/** «1 – 7 de setembre del 2026», i amb els dos mesos si la setmana en creua dos. */
function etiquetaSetmana(inici: Date, fi: Date) {
  const ambAny = new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const senseAny = new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "long", timeZone: "UTC" });
  const mateixMes = inici.getUTCMonth() === fi.getUTCMonth() && inici.getUTCFullYear() === fi.getUTCFullYear();
  const esquerra = mateixMes ? String(inici.getUTCDate()) : senseAny.format(inici);
  return `${esquerra} – ${ambAny.format(fi)}`;
}

export function construeixSetmana(
  clau: string,
  esdeveniments: Esdeveniment[],
  avui = avuiLocal(),
): SetmanaPlanner {
  const perDia = new Map<string, Esdeveniment[]>();
  for (const acte of esdeveniments) {
    const llista = perDia.get(acte.dia);
    if (llista) llista.push(acte);
    else perDia.set(acte.dia, [acte]);
  }
  for (const llista of perDia.values()) llista.sort((a, b) => a.hora.localeCompare(b.hora));

  const dilluns = deClau(dillunsDe(clau));
  const dies: DiaPlanner[] = [];
  let total = 0;
  let perTancar = 0;

  for (let i = 0; i < 7; i += 1) {
    const quan = new Date(dilluns.getTime() + i * DIA_MS);
    const clauDelDia = aClau(quan);
    const delDia = perDia.get(clauDelDia) ?? [];
    total += delDia.length;
    if (clauDelDia < avui) perTancar += delDia.filter((acte) => !acte.tancada).length;
    dies.push({
      clau: clauDelDia,
      numero: quan.getUTCDate(),
      // A la setmana tots els dies hi pertanyen: no hi ha vores d'altres mesos.
      delMes: true,
      avui: clauDelDia === avui,
      capDeSetmana: i >= 5,
      grups: agrupaPerSegment(delDia),
      total: delDia.length,
    });
  }

  return {
    etiqueta: etiquetaSetmana(dilluns, new Date(dilluns.getTime() + 6 * DIA_MS)),
    dies,
    total,
    perTancar,
    anterior: aClau(new Date(dilluns.getTime() - 7 * DIA_MS)),
    seguent: aClau(new Date(dilluns.getTime() + 7 * DIA_MS)),
    actual: aClau(dilluns),
  };
}
