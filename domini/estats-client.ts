/**
 * Els estats d'un client al CRM. El tipus de client no és aquí: és una taula,
 * `crm_tipus_client`, que es manté a Configuració o que portarà l'ERP.
 */

/** L'estat d'un client, en l'ordre dels desplegables. El codi és la posició. */
export const ESTATS_CLIENT = [
  { codi: 0, valor: "sense_seleccionar", etiqueta: "Sense seleccionar" },
  { codi: 1, valor: "habitual", etiqueta: "Habitual" },
  { codi: 2, valor: "esporadic", etiqueta: "Esporàdic" },
  { codi: 3, valor: "baixa", etiqueta: "Baixa" },
  { codi: 4, valor: "captacio", etiqueta: "Captació" },
] as const;

/** La baixa: aquests clients no surten enlloc del portal. */
export const ESTAT_CLIENT_BAIXA = ESTATS_CLIENT[3];

/** A les cel·les del llistat, «Sense seleccionar» no hi cap: s'hi escriu «S/S». El filtre la diu sencera. */
export const ESTATS_CLIENT_CURTS: Record<string, string> = { [ESTATS_CLIENT[0].valor]: "S/S" };

/** Les opcions que ofereix el CRM. La baixa no hi és: els clients de baixa no s'hi veuen. */
export const OPCIONS_ESTAT_CLIENT: [string, string][] = ESTATS_CLIENT.filter((e) => e.codi !== ESTAT_CLIENT_BAIXA.codi).map(
  (e) => [e.valor, e.etiqueta],
);
