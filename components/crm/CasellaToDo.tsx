"use client";

import { useState, useTransition, type ReactNode } from "react";

import { marcaToDoAccio } from "@/app/(portal)/crm/accions";

/**
 * Una fila de la pantalla de To-Do, amb la seva casella.
 *
 * Es marca de seguida i s'espera després; si no ha colat, la casella torna on
 * era i es diu per què. La fila no se'n va en marcar-la: queda ratllada al seu
 * lloc, i la mateixa casella la desfà. El que hi ha a sota (de qui és, d'on
 * surt) el pinta el servidor i arriba com a fills.
 */
export function CasellaToDo({
  id,
  text,
  fetInicial,
  etiquetes,
  children,
}: {
  id: string;
  text: string;
  fetInicial: boolean;
  /** Les marques del costat del text: prioritat i venciment. */
  etiquetes?: ReactNode;
  children?: ReactNode;
}) {
  const [fet, setFet] = useState(fetInicial);
  const [error, setError] = useState("");
  const [enviant, comenca] = useTransition();

  function commuta() {
    const nou = !fet;
    setFet(nou);
    setError("");
    comenca(async () => {
      const resposta = await marcaToDoAccio(id, nou);
      if (resposta.error) {
        setFet(!nou);
        setError(resposta.error);
      }
    });
  }

  return (
    <li className={`flex gap-3 px-3.5 py-3 transition-colors sm:px-4 ${fet ? "bg-parchment/40" : ""}`}>
      <input
        type="checkbox"
        checked={fet}
        disabled={enviant}
        onChange={commuta}
        aria-label={fet ? `Torna a obrir «${text}»` : `Marca com a fet «${text}»`}
        title={fet ? "Torna a obrir" : "Marca com a fet"}
        className="mt-[3px] size-4 shrink-0 cursor-pointer accent-wine disabled:cursor-wait"
      />
      <div className={`min-w-0 flex-1 transition-opacity ${fet ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`min-w-0 break-words text-[14px] leading-snug ${fet ? "text-muted line-through" : "font-medium text-ink"}`}>
            {text}
          </span>
          {etiquetes}
        </div>
        {children}
        {error ? (
          <p role="alert" className="mt-1 text-[12px] text-wine">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
