/**
 * La connexió amb l'ERP, vprooferp.
 *
 * El CRM no en llegeix res encara: els clients, els laboratoris i els
 * productes viuen a la base de dades del portal i es mantenen des del portal.
 * Quan vprooferp hi estigui connectat, serà aquí on es llegirà (via
 * `apis/vprooferp/`) i des d'on s'ompliran les taules que avui l'esperen buides:
 * l'estoc i el preu dels productes, els albarans de venda i la facturació dels
 * clients. Les fitxes que en vinguin portaran `font = "erp"` i el seu codi a
 * `codi_erp`, com ja preveu el model.
 */
import "server-only";

export type EstatErp = { connectat: boolean; url: string | null; missatge: string };

export function estatErp(): EstatErp {
  const url = process.env.VPROOFERP_URL?.trim() || null;
  return {
    connectat: false,
    url,
    missatge: url
      ? `L'adreça de vprooferp és ${url}, però el connector encara no està fet: el CRM no en llegeix res.`
      : "El CRM encara no està connectat a vprooferp. Quan ho estigui, n'arribaran els clients, l'estoc, els preus, els albarans i la facturació.",
  };
}
