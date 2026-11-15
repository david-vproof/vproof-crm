/**
 * Els vocabularis de la fitxa de client de FactuSol, tal com els ensenya el
 * programa. L'estat d'un client el mana l'ERP, i ha de dir el mateix aquí que
 * allà. El tipus de client no és aquí: és una taula de l'ERP (F_TCL) i al CRM
 * en té una còpia, `crm_tipus_client`.
 */

/**
 * ESTCLI: el desplegable «Estado» de la fitxa de client, en el mateix ordre.
 * FactuSol en desa la posició (0 és «Sin seleccionar»).
 */
export const ESTATS_CLIENT = [
  { codi: 0, valor: "sense_seleccionar", etiqueta: "Sense seleccionar" },
  { codi: 1, valor: "habitual", etiqueta: "Habitual" },
  { codi: 2, valor: "esporadic", etiqueta: "Esporàdic" },
  { codi: 3, valor: "baixa", etiqueta: "Baixa" },
  { codi: 4, valor: "captacio", etiqueta: "Captació" },
] as const;

/** «Baja»: aquests clients no surten enlloc del portal, ni es sincronitzen. */
export const ESTAT_CLIENT_BAIXA = ESTATS_CLIENT[3];

/** A les cel·les del llistat, «Sense seleccionar» no hi cap: s'hi escriu «S/S». El filtre la diu sencera. */
export const ESTATS_CLIENT_CURTS: Record<string, string> = { [ESTATS_CLIENT[0].valor]: "S/S" };

/** Les opcions que ofereix el CRM. La baixa no hi és: els clients de baixa no s'hi veuen. */
export const OPCIONS_ESTAT_CLIENT: [string, string][] = ESTATS_CLIENT.filter((e) => e.codi !== ESTAT_CLIENT_BAIXA.codi).map(
  (e) => [e.valor, e.etiqueta],
);

/**
 * ESTALB d'un albarà encara no facturat; 1 és facturat. Comprovat el novembre
 * del 2026 contra F_LFA (DOCLFA «A», DTPLFA i DCOLFA apunten a l'albarà): cap
 * albarà amb 0 té cap línia de factura.
 */
export const ESTAT_ALBARA_PENDENT = 0;

function estatDeCodi(codi: unknown) {
  return ESTATS_CLIENT.find((e) => e.codi === Number(codi));
}

/** El valor que es desa a `crm_clients.estat`. Un codi desconegut compta com a no informat. */
export function estatClientDesDeCodi(codi: unknown): string {
  return (estatDeCodi(codi) ?? ESTATS_CLIENT[0]).valor;
}

export function etiquetaEstatClient(codi: unknown): string {
  return estatDeCodi(codi)?.etiqueta ?? `Estat ${codi}`;
}

/** La descripció d'un TCLCLI, per a les pantalles que llegeixen FactuSol en directe. */
export function nomTipusClient(cataleg: Record<string, string>, codi: unknown): string | null {
  const clau = String(codi ?? "").trim();
  if (!clau) return null;
  return cataleg[clau] || `Tipus ${clau}`;
}

/**
 * Les caselles de la fitxa d'article de FactuSol que el treuen de circulació.
 * Un article amb alguna d'aquestes marcades és un històric: la còpia el porta
 * igualment (es necessita per saber què s'ha venut), però marcat, i els
 * catàlegs no l'ensenyen si no es demana. FactuSol les desa com a número, i el
 * 0 vol dir que no està marcada.
 */
export const MARQUES_ARTICLE_INACTIU = [
  { columna: "DSCART", etiqueta: "Descatalogat", plural: "descatalogats" },
  { columna: "NPUART", etiqueta: "No disponible per a l'ús", plural: "no disponibles per a l'ús" },
] as const;

/** Si una fila de F_ART és un històric: té alguna de les marques de dalt. */
export function esArticleHistoric(fila: Record<string, unknown>) {
  return MARQUES_ARTICLE_INACTIU.some(({ columna }) => Number(fila[columna] ?? 0) !== 0);
}

/** La condició SQL dels articles actius: cap marca de les de dalt. Una casella buida compta com a no marcada. */
export const ARTICLE_ACTIU = MARQUES_ARTICLE_INACTIU.map(({ columna }) => `(${columna} = 0 OR ${columna} IS NULL)`).join(" AND ");
