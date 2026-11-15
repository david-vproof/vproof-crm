/**
 * El preu que FactuSol posaria a una línia d'albarà per a un client i un
 * article. Deduït de la instal·lació de la bodega i contrastat amb els albarans
 * reals de juny a setembre del 2026: quadra en el 94–100 % de les línies (les que
 * no, són regals al 100 % o descomptes posats a mà).
 *
 * 1. El preu de la tarifa del client (F_LTA). Si la tarifa porta l'IVA inclòs
 *    (F_TAR.IVATAR), se li treu el de l'article (F_ART.TIVART): els albarans
 *    van sense IVA.
 * 2. Si el client té un preu especial per a l'article (F_PRC tipus 0), mana
 *    aquell preu, i s'hi aplica igualment el descompte de línia del client.
 * 3. Si hi té un descompte especial (F_PRC tipus 1), el preu és el de la
 *    tarifa i el descompte, aquell, en lloc del del client.
 * 4. Si no, el preu de la tarifa amb el descompte de línia del client (DT1CLI).
 *
 * El descompte a peu del client (DP1CLI) no hi entra: FactuSol no l'aplica ni
 * als albarans ni a les factures d'aquesta instal·lació.
 */

/** Les condicions especials d'un client per a un article (F_PRC): un preu (0) o un descompte (1). */
export type CondicioEspecial = { tipus: 0 | 1; valor: number };

export type PreuDeFactusol = { preu: number; descompte: number };

export function preuDeFactusol({
  pvp,
  ivaInclos,
  percentatgeIva,
  especial,
  descompteClient,
}: {
  /** El preu de la tarifa, o null si l'article no hi és. */
  pvp: number | null;
  ivaInclos: boolean;
  percentatgeIva: number;
  especial: CondicioEspecial | null;
  descompteClient: number;
}): PreuDeFactusol | null {
  if (especial?.tipus === 0) return { preu: especial.valor, descompte: descompteClient };
  if (pvp === null) return null;
  const base = ivaInclos ? pvp / (1 + percentatgeIva / 100) : pvp;
  if (especial?.tipus === 1) return { preu: base, descompte: especial.valor };
  return { preu: base, descompte: descompteClient };
}

/**
 * El percentatge d'un tipus d'IVA d'article. TIVART és la posició a la taula
 * d'IVA de la configuració (0 el general, 1 el reduït…); si no se sap, el general.
 */
export function percentatgeDeTipus(tipus: number, percentatges: number[]) {
  return percentatges[tipus] ?? percentatges[0] ?? 21;
}

/**
 * La tarifa que es fa servir si no n'hi ha cap de client: un lead encara no és
 * a FactuSol. És la de venda al major, la que tenen la majoria de clients (611
 * de 1.020 el setembre del 2026).
 */
export const TARIFA_SENSE_CLIENT = 2;
