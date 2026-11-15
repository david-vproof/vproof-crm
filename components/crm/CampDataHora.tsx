"use client";

import { useState } from "react";

const HORES = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
/** Els quarts se suggereixen; qualsevol altre minut s'escriu a mà. */
const QUARTS = ["00", "15", "30", "45"];

/** «7» és «07», «75» és «59», «ab» és «00». */
function normalitzaMinuts(text: string) {
  const digits = text.replace(/\D/g, "").slice(0, 2);
  if (!digits) return "00";
  return String(Math.min(59, Number(digits))).padStart(2, "0");
}

/**
 * Data, hora i minuts en tres controls, que s'envien junts com «2026-10-27T09:15»
 * amb el nom del camp. Els minuts són un quadre de text amb els quarts com a
 * suggeriment: el selector natiu del navegador ensenya els seixanta minuts
 * encara que se li doni un pas, i un desplegable tancat no deixaria posar-ne
 * un de concret. Sense data no s'envia res: així el «cal omplir-ho» el posa el
 * navegador al camp de data.
 */
export function CampDataHora({
  id,
  nom,
  inicial,
  obligatori,
}: {
  id: string;
  nom: string;
  /** «2026-10-27T09:15» o buit. */
  inicial: string;
  obligatori?: boolean;
}) {
  const [dia, setDia] = useState(inicial.slice(0, 10));
  const [hora, setHora] = useState(HORES.includes(inicial.slice(11, 13)) ? inicial.slice(11, 13) : "09");
  const [minuts, setMinuts] = useState(/^\d{2}$/.test(inicial.slice(14, 16)) ? inicial.slice(14, 16) : "00");
  const idQuarts = `${id}-quarts`;

  return (
    <div className="flex items-center gap-1.5">
      <input type="hidden" name={nom} value={dia ? `${dia}T${hora}:${normalitzaMinuts(minuts)}` : ""} />
      <input
        id={id}
        type="date"
        value={dia}
        required={obligatori}
        onChange={(e) => setDia(e.target.value)}
        className="field-compacte w-auto"
      />
      <select aria-label="Hora" value={hora} onChange={(e) => setHora(e.target.value)} className="field-compacte w-auto">
        {HORES.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-muted">:</span>
      <input
        type="text"
        aria-label="Minuts"
        list={idQuarts}
        inputMode="numeric"
        maxLength={2}
        value={minuts}
        onChange={(e) => setMinuts(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => setMinuts(normalitzaMinuts(minuts))}
        onFocus={(e) => e.target.select()}
        className="field-compacte !w-[64px] text-center"
      />
      <datalist id={idQuarts}>
        {QUARTS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
    </div>
  );
}
