/**
 * La foto d'una activitat. Una foto de mòbil fa diversos MB i porta a dins on
 * s'ha fet: el navegador la redueix i la torna a desar en JPEG abans d'enviar-la
 * (`components/crm/CampFoto.tsx`), i el servidor només accepta el resultat.
 *
 * Aquí només hi ha la lògica pura, que fan servir totes dues bandes.
 */

/** El costat llarg, en píxels: prou per llegir una carta de productes i prou lleuger per enviar-lo amb poca cobertura. */
const COSTAT_MAXIM_FOTO = 1920;

export const QUALITAT_FOTO = 0.82;

/** Sempre per sota del `bodySizeLimit` de `next.config.ts`, que compta el formulari sencer. */
export const MIDA_MAXIMA_FOTO = 3 * 1024 * 1024;

export const TEXT_FOTO_MASSA_GRAN = "La foto pesa massa. Prova-ho amb una altra.";

/** Les mides de la foto reduïda. Una de més petita no s'engrandeix. */
export function midesReduides(amplada: number, alcada: number) {
  const escala = Math.min(1, COSTAT_MAXIM_FOTO / Math.max(amplada, alcada));
  return { amplada: Math.round(amplada * escala), alcada: Math.round(alcada * escala) };
}

/** Per què no s'accepta un fitxer, o null si és bo. El tipus que declara no és de fiar: es miren els primers bytes. */
export function motiuFotoNoValida(bytes: Uint8Array): string | null {
  if (bytes.length > MIDA_MAXIMA_FOTO) return TEXT_FOTO_MASSA_GRAN;
  const esJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return esJpeg ? null : "Aquest fitxer no és una foto vàlida.";
}

/** El camp del formulari que diu que la foto que hi havia s'ha de treure. */
export function nomTreuFoto(nom: string) {
  return `${nom}_treu`;
}
