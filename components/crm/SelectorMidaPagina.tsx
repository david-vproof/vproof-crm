"use client";

import { MIDES_PAGINA, PARAM_MIDA } from "@/domini/crm-llistat";

/**
 * Quantes files per pàgina ensenya un llistat. Va per l'URL, com l'ordre i els
 * filtres, i s'aplica en triar-lo. Canviar-lo torna a la primera pàgina.
 */
export function SelectorMidaPagina({ valor, ocults }: { valor: number; ocults: Record<string, string> }) {
  return (
    <form action="/crm" className="flex items-center gap-1.5 text-[13px] text-muted">
      {Object.entries(ocults).map(([nom, text]) => (text ? <input key={nom} type="hidden" name={nom} value={text} /> : null))}
      <label htmlFor="mida-pagina">Mostra</label>
      <select
        id="mida-pagina"
        name={PARAM_MIDA}
        defaultValue={valor === 0 ? "tots" : String(valor)}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field-compacte !w-auto !py-1 !text-[12.5px]"
      >
        {MIDES_PAGINA.map((mida) => (
          <option key={mida} value={mida === 0 ? "tots" : String(mida)}>
            {mida === 0 ? "Tots" : mida}
          </option>
        ))}
      </select>
    </form>
  );
}
