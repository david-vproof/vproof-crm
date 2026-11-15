/**
 * Els rols de Directus que el portal reconeix pel nom. Són aquí, sense res de
 * servidor, perquè els formularis del navegador també els puguin anomenar.
 */

/** El rol d'administrador de Directus, que és l'únic que administra els usuaris. */
export const ROL_ADMINISTRADOR = "administrator";
/** El rol de qui ho veu tot (els clients de tothom) sense administrar res. Es crea amb scripts/crm-acces.mjs o des d'Usuaris. */
export const ROL_MANAGER = "manager";
/** El valor del desplegable de rol que vol dir «Manager, que encara s'ha de crear a Directus». */
export const ROL_MANAGER_NOU = "crea:manager";
