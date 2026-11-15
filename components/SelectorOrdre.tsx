"use client";

import { type ColumnaOrdenable, PARAM_ORDRE } from "@/domini/ordre-llistat";

/**
 * L'ordre com a desplegable, per al telèfon, on la meitat de les columnes no
 * surten i no hi ha capçalera a clicar. Triar-ne un envia el formulari i va a
 * l'adreça amb l'ordre nou; la resta de paràmetres (la cerca) hi viatgen
 * amagats. Tornar a «Per defecte» no deixa cap paràmetre buit a l'adreça.
 */
export function SelectorOrdre({
  accio,
  ocults = {},
  columnes,
  valor,
  className = "",
}: {
  /** La pàgina del llistat, on s'envia el formulari. */
  accio: string;
  /** Paràmetres de l'adreça que s'han de conservar. */
  ocults?: Record<string, string>;
  columnes: ColumnaOrdenable[];
  /** L'ordre actual tal com va a l'URL («-poblacio»), o buit. */
  valor: string;
  className?: string;
}) {
  return (
    <form action={accio} className={className}>
      {Object.entries(ocults).map(([nom, v]) => (v ? <input key={nom} type="hidden" name={nom} value={v} /> : null))}
      <label className="flex items-center gap-2 text-[12.5px] text-muted">
        <span className="whitespace-nowrap">Ordena per</span>
        <select
          name={PARAM_ORDRE}
          defaultValue={valor}
          onChange={(e) => {
            const select = e.currentTarget;
            if (!select.value) select.disabled = true;
            select.form?.requestSubmit();
          }}
          className="field-compacte min-w-0 flex-1 !py-1 !text-[12.5px]"
        >
          <option value="">Per defecte</option>
          {columnes.map((columna) => (
            <optgroup key={columna.camp} label={columna.etiqueta}>
              <option value={columna.camp}>{columna.etiqueta} ↑</option>
              <option value={`-${columna.camp}`}>{columna.etiqueta} ↓</option>
            </optgroup>
          ))}
        </select>
      </label>
    </form>
  );
}
