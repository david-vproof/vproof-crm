/**
 * El seguiment d'una passada de sincronització mentre és en marxa.
 *
 * Cada passada té un `Seguiment` que diu en quina fase és, quant n'ha fet i
 * quines files no ha pogut copiar. L'estat viu a la memòria del procés, on
 * qui ho vol veure (el flux de `/api/sincronitzacio`) s'hi subscriu i rep
 * cada canvi de seguida; i es desa també, espaiat, al registre de Directus,
 * perquè una altra instància de Cloud Run —o algú que obre la pantalla quan
 * la passada la va engegar el programador— pugui saber-ne alguna cosa.
 *
 * El que ha acabat es queda un parell de minuts a la memòria, perquè qui
 * s'hi enganxi just després encara en vegi el final.
 */
import "server-only";

import {
  type Comptadors, type Desencadenant, type ErrorCopia, type EstatEnViu, type Fase, type Taula,
  COMPTADORS_BUITS, MAXIM_ERRORS_DESATS,
} from "@/domini/sincronitzacio";

type Oient = (estat: EstatEnViu) => void;

type Magatzem = {
  enViu: Map<Taula, EstatEnViu>;
  oients: Map<Taula, Set<Oient>>;
};

type AmbMagatzem = typeof globalThis & { __seguimentSincronitzacio?: Magatzem };

/** Quant es conserva un estat acabat, perquè qui arribi tard encara el trobi. */
const CONSERVA_ACABATS_MS = 2 * 60_000;
/** Cada quant, com a molt, s'escriu el progrés a Directus. */
const ESCRIU_CADA_MS = 2_500;

// En desenvolupament, Next recarrega els mòduls: la memòria ha de ser la
// mateixa per a tots, com fa el programador.
function magatzem(): Magatzem {
  const global = globalThis as AmbMagatzem;
  global.__seguimentSincronitzacio ??= { enViu: new Map(), oients: new Map() };
  return global.__seguimentSincronitzacio;
}

/** L'estat de la passada d'una taula en aquest procés, si n'hi ha cap de viva o acabada de fa poc. */
export function estatEnViu(taula: Taula): EstatEnViu | null {
  const estat = magatzem().enViu.get(taula) ?? null;
  if (estat?.final && Date.now() - Date.parse(estat.final.fi) > CONSERVA_ACABATS_MS) {
    magatzem().enViu.delete(taula);
    return null;
  }
  return estat;
}

/** Si hi ha una passada d'aquesta taula en marxa en aquest procés. */
export function enMarxa(taula: Taula) {
  const estat = estatEnViu(taula);
  return Boolean(estat && !estat.final);
}

/** Rep cada canvi d'estat de la passada d'una taula. Torna com desapuntar-se. */
export function subscriu(taula: Taula, oient: Oient): () => void {
  const { oients } = magatzem();
  if (!oients.has(taula)) oients.set(taula, new Set());
  oients.get(taula)!.add(oient);
  return () => {
    oients.get(taula)?.delete(oient);
  };
}

function publica(estat: EstatEnViu) {
  const { enViu, oients } = magatzem();
  enViu.set(estat.taula, estat);
  for (const oient of oients.get(estat.taula) ?? []) {
    try {
      oient(estat);
    } catch {
      // Un oient que peta no ha d'aturar la passada.
    }
  }
}

/** El que es desa al registre de Directus cada cop que el progrés avança. */
export type ProgresPerDesar = {
  fase: Fase;
  progres: { detall: string | null; fets: number | null; total: number | null; actualitzat_el: string };
};

export class Seguiment {
  estat: EstatEnViu;

  private temporitzador: ReturnType<typeof setTimeout> | null = null;
  private escrivint: Promise<void> | null = null;
  private brut = false;
  private darreraEscriptura = 0;

  /**
   * `desa` escriu el progrés al registre de Directus. Pot fallar (el model
   * encara sense els camps nous, Directus que no respon): no atura res, el
   * que mana és el final de la passada.
   */
  constructor(
    taula: Taula,
    desencadenant: Desencadenant,
    private readonly desa: (progres: ProgresPerDesar) => Promise<void>,
  ) {
    const ara = new Date().toISOString();
    this.estat = {
      id: null,
      taula,
      desencadenant,
      inici: ara,
      fase: "lectura",
      detall: null,
      fets: null,
      total: null,
      comptadors: { ...COMPTADORS_BUITS },
      errors: [],
      actualitzatEl: ara,
      final: null,
    };
    // Es publica de seguida: així dues passades de la mateixa taula no es
    // poden engegar alhora ni que les demanin dues peticions a la vegada.
    publica(this.estat);
  }

  /** El registre de Directus ja existeix: a partir d'aquí el progrés s'hi desa. */
  registra(id: string) {
    this.canvia({ id });
  }

  /** Comença una fase. Els comptadors de la fase anterior s'obliden. */
  fase(fase: Fase, detall: string | null = null) {
    this.canvia({ fase, detall, fets: null, total: null });
    this.escriuAviat(true);
  }

  /** Canvia el text de la fase sense moure la barra. */
  detall(detall: string | null) {
    this.canvia({ detall });
    this.escriuAviat();
  }

  /** On és dins de la fase: `fets` de `total`. */
  avanc(fets: number, total: number, detall?: string | null) {
    this.canvia({ fets, total, ...(detall === undefined ? {} : { detall }) });
    this.escriuAviat();
  }

  comptadors(parcial: Partial<Comptadors>) {
    this.canvia({ comptadors: { ...this.estat.comptadors, ...parcial } });
  }

  /** Anota files que no s'han pogut copiar. Se'n desen les primeres; es compten totes. */
  errors(nous: ErrorCopia[]) {
    if (nous.length === 0) return;
    const errors = [...this.estat.errors, ...nous].slice(0, MAXIM_ERRORS_DESATS);
    this.canvia({ errors, comptadors: { ...this.estat.comptadors, fallits: this.estat.comptadors.fallits + nous.length } });
  }

  /** La passada ha acabat, bé o malament. A partir d'aquí ja no s'escriu res més pel seu compte. */
  acaba(final: NonNullable<EstatEnViu["final"]>) {
    this.aturaEscriptura();
    this.canvia({ final });
  }

  /**
   * La passada no ha arribat a començar (ja n'hi havia una en marxa en una
   * altra instància): es treu de la memòria sense dir res més, perquè no
   * tapi la que sí que corre, que és la que qui mira ha de trobar.
   */
  descarta() {
    this.aturaEscriptura();
    const { enViu } = magatzem();
    if (enViu.get(this.estat.taula) === this.estat) enViu.delete(this.estat.taula);
  }

  /**
   * Espera que acabi el que s'estigui escrivint a Directus i no en comença
   * cap més: abans del tancament, perquè el progrés no trepitgi el resultat.
   */
  async esgota() {
    this.aturaEscriptura();
    await this.escrivint;
  }

  /** Quant fa que la passada no diu res, en mil·lisegons. */
  silenci(ara = Date.now()) {
    return ara - Date.parse(this.estat.actualitzatEl);
  }

  private canvia(parcial: Partial<EstatEnViu>) {
    this.estat = { ...this.estat, ...parcial, actualitzatEl: new Date().toISOString() };
    publica(this.estat);
  }

  /**
   * Programa una escriptura a Directus, com a molt una cada `ESCRIU_CADA_MS`.
   * Un canvi de fase no espera: la fase és el que diu on s'ha quedat si cau.
   */
  private escriuAviat(deSeguida = false) {
    if (!this.estat.id || this.estat.final) return;
    this.brut = true;
    if (this.temporitzador) {
      if (!deSeguida) return;
      clearTimeout(this.temporitzador);
    }
    const espera = deSeguida ? 0 : Math.max(0, ESCRIU_CADA_MS - (Date.now() - this.darreraEscriptura));
    this.temporitzador = setTimeout(() => void this.escriuAra(), espera);
  }

  private async escriuAra() {
    this.temporitzador = null;
    if (this.escrivint) {
      // Ja n'hi ha una en marxa: quan acabi, si ha quedat res per dir, tornarà a programar-se.
      return;
    }
    if (!this.brut || !this.estat.id || this.estat.final) return;
    this.brut = false;
    this.darreraEscriptura = Date.now();
    const { fase, detall, fets, total, actualitzatEl } = this.estat;
    this.escrivint = this.desa({ fase, progres: { detall, fets, total, actualitzat_el: actualitzatEl } })
      .catch(() => undefined)
      .finally(() => {
        this.escrivint = null;
        if (this.brut && !this.estat.final) this.escriuAviat();
      });
    await this.escrivint;
  }

  private aturaEscriptura() {
    if (this.temporitzador) clearTimeout(this.temporitzador);
    this.temporitzador = null;
    this.brut = false;
  }
}
