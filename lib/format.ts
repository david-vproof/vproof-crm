/** Abreviatures catalanes de mes: el format d'Intl ("30 de juny del 2026") és massa llarg per a una taula. */
const MESOS = ["gen", "feb", "març", "abr", "maig", "juny", "jul", "ago", "set", "oct", "nov", "des"];

export function dataCurta(iso?: string) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime()) || data.getUTCFullYear() <= 1900) return "";
  return `${data.getUTCDate()} ${MESOS[data.getUTCMonth()]} ${data.getUTCFullYear()}`;
}

export function euros(valor: number) {
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(valor);
}

/** Amb cèntims: per a imports d'albarà i preus, on arrodonir a l'euro enganyaria. */
export function eurosAmbCentims(valor: number) {
  return new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

/** Una quantitat: sense decimals si no en té, i amb els que calguin (fins a tres) si en té. */
export function quantitat(valor: number) {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 3 }).format(valor);
}

export function percentatge(valor: number) {
  return new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 2 }).format(valor) + " %";
}

/** L'ERP desa l'IBAN trossejat; aquí es recompon en grups de quatre. */
export function iban(parts: { PBACLI: string; DBACLI: string; ENTCLI: string; OFICLI: string; DCOCLI: string; CUECLI: string }) {
  const pla = `${parts.PBACLI}${parts.DBACLI}${parts.ENTCLI}${parts.OFICLI}${parts.DCOCLI}${parts.CUECLI}`.trim();
  if (pla.length < 20) return "";
  return pla.replace(/(.{4})/g, "$1 ").trim();
}

/** Els mots d'enllaç d'un topònim, que dins del nom van en minúscula («Sant Feliu de Guíxols»). */
const PARTICULES = new Set(["de", "del", "dels", "la", "les", "el", "els", "i", "a", "en", "los", "las", "y"]);

/**
 * Població, comarca i província, escrites com a nom propi. A l'ERP n'hi ha en
 * majúscules («SANT FELIU DE GUIXOLS»), en minúscules i a mitges («El masnou»):
 * cada mot amb majúscula inicial, i els mots d'enllaç i l'apòstrof en minúscula.
 */
export function nomDeLloc(valor: string | null | undefined) {
  const net = (valor ?? "").trim().replace(/\s+/g, " ");
  // Els separadors es queden tal qual; els mots es tornen a escriure d'un en un.
  // Qui obre el nom o un parèntesi («Brull (El)») va sempre en majúscula.
  return net.toLocaleLowerCase("ca").replace(/[^\s\-/().,]+/g, (mot, posicio: number) => {
    const esPrimer = posicio === 0 || net[posicio - 1] === "(";
    const apostrof = /^([dlsn])(['’])(.+)$/u.exec(mot);
    if (apostrof) {
      const [, lletra, signe, resta] = apostrof;
      return `${esPrimer ? lletra.toLocaleUpperCase("ca") : lletra}${signe}${majuscula(resta)}`;
    }
    return !esPrimer && PARTICULES.has(mot) ? mot : majuscula(mot);
  });
}

function majuscula(mot: string) {
  return mot.charAt(0).toLocaleUpperCase("ca") + mot.slice(1);
}

/** Dia i hora locals de l'empresa: «17 oct 2026 · 06:01». */
export function dataHoraCurta(iso?: string | null) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const hora = new Intl.DateTimeFormat("ca-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(data);
  return `${dataCurta(iso)} · ${hora}`;
}

/** Una durada en mil·lisegons, curta: «48 s», «2 min 05 s», «1 h 12 min». */
export function durada(ms: number) {
  const segons = Math.max(0, Math.round(ms / 1000));
  if (segons < 60) return `${segons} s`;
  const minuts = Math.floor(segons / 60);
  if (minuts < 60) return `${minuts} min ${String(segons % 60).padStart(2, "0")} s`;
  const hores = Math.floor(minuts / 60);
  return `${hores} h ${String(minuts % 60).padStart(2, "0")} min`;
}
