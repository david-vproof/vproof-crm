/**
 * On es recorda, a cada navegador, amb quins filtres es va deixar cada punt
 * del menú (vegeu `useVistesRecordades` a la barra lateral) i què s'havia triat
 * al selector de productes (vegeu `SelectorProductesRecordat`). És d'una sessió: tancar-la
 * ho oblida, i entrar-hi també, per si la sessió va caducar sense passar pel
 * botó de sortir. Qui entra, entra net.
 *
 * La tria del selector va a `sessionStorage`: tancar la pestanya o l'aplicació
 * també l'oblida, encara que la sessió segueixi oberta.
 */
export const CLAU_VISTES = "vproof.vistes";
export const CLAU_SELECTOR_PRODUCTES = "vproof.selector-productes";

export function oblidaVistes() {
  try {
    localStorage.removeItem(CLAU_VISTES);
    sessionStorage.removeItem(CLAU_SELECTOR_PRODUCTES);
  } catch {
    // Sense emmagatzematge no hi havia res a oblidar.
  }
}
