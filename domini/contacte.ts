/**
 * Telèfons i correus tal com arriben de l'ERP, convertits en accions: trucar,
 * obrir WhatsApp i escriure un correu.
 *
 * Els camps no són nets. Un telèfon pot portar-ne dos («634517572 / 634517528»,
 * «938123456-666777888»), un nom enganxat («Gonzalo 633 91 14 83») o una
 * extensió («938814376 ext.643»). Un correu en pot portar diversos, separats
 * per punt i coma o per un salt de línia, i n'hi ha que diuen «whatsapp» i prou.
 * D'aquí se'n treu el que és un número o una adreça; la resta es deixa com a text.
 */

export type Telefon = {
  /** El número tal com està escrit al camp. */
  text: string;
  /** L'enllaç per trucar. */
  trucada: string;
  /** L'enllaç de WhatsApp, només per als mòbils: un fix no en sol tenir. */
  whatsapp: string | null;
};

/** Tires de xifres amb espais o punts pel mig, i potser un + al davant. */
const CANDIDAT = /\+?\d(?:[\d .]*\d)?/g;

/** Menys xifres que això no és un telèfon: és una extensió o un tros d'adreça. */
const MINIM_XIFRES = 7;

/** Els números d'aquí tenen nou xifres: dues de seguides sense separar, divuit. */
const XIFRES_ESPANYA = 9;

/** El número en format internacional (només xifres, amb el prefix), si se sap. */
function internacional(xifres: string, ambMes: boolean): string | null {
  if (ambMes) return xifres;
  if (xifres.startsWith("00")) return xifres.slice(2);
  if (xifres.length === XIFRES_ESPANYA && /^[6-9]/.test(xifres)) return `34${xifres}`;
  if (xifres.length === 11 && xifres.startsWith("34")) return xifres;
  return null;
}

/** Un mòbil d'aquí comença per 6 o 7; d'un número d'un altre país no se sap i s'ofereix. */
function potTenirWhatsapp(numero: string) {
  return numero.startsWith("34") ? /^34[67]/.test(numero) : true;
}

function telefon(text: string, xifres: string, ambMes: boolean): Telefon {
  const numero = internacional(xifres, ambMes);
  return {
    text,
    trucada: `tel:${numero ? `+${numero}` : xifres}`,
    whatsapp: numero && potTenirWhatsapp(numero) ? `https://wa.me/${numero}` : null,
  };
}

/** Els telèfons que hi ha escrits en un camp, en l'ordre en què hi són. */
export function llegeixTelefons(brut: unknown): Telefon[] {
  if (typeof brut !== "string" && typeof brut !== "number") return [];
  const telefons: Telefon[] = [];

  for (const [trobat] of String(brut).matchAll(CANDIDAT)) {
    const text = trobat.trim();
    const ambMes = text.startsWith("+");
    const xifres = text.replace(/\D/g, "");
    if (xifres.length < MINIM_XIFRES) continue;

    // Dos números d'aquí escrits de seguida, sense res pel mig.
    if (!ambMes && xifres.length === 2 * XIFRES_ESPANYA && /^[6-9]\d{8}[6-9]/.test(xifres)) {
      const primer = xifres.slice(0, XIFRES_ESPANYA);
      const segon = xifres.slice(XIFRES_ESPANYA);
      telefons.push(telefon(primer, primer, false), telefon(segon, segon, false));
      continue;
    }
    telefons.push(telefon(text, xifres, ambMes));
  }

  // El mateix número dues vegades (el fix copiat al mòbil) només hi és un cop.
  return telefons.filter((t, i) => telefons.findIndex((altre) => altre.trucada === t.trucada) === i);
}

const ADRECA = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Les adreces de correu que hi ha escrites en un camp. El que no n'és una, com «whatsapp», no hi surt. */
export function llegeixCorreus(brut: unknown): string[] {
  if (typeof brut !== "string") return [];
  // Un salt de línia al mig d'una adreça («nom@gmail\n.com») és un error de picar, no un separador.
  const net = brut.replace(/\s*\n\s*(?=\.)/g, "");
  const adreces = net
    .split(/[;,\s]+/)
    .map((tros) => tros.trim().replace(/^[<(]+|[>).]+$/g, ""))
    .filter((tros) => ADRECA.test(tros));
  return [...new Set(adreces.map((adreca) => adreca.toLowerCase()))];
}
