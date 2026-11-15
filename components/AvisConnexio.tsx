import Link from "next/link";

import { ErrorFactusol } from "@/serveis/clients";

const TITOLS: Record<string, string> = {
  "sense-credencials": "Sense connexió amb l'ERP",
  autenticacio: "L'API ha rebutjat les credencials",
  consulta: "La consulta a l'ERP ha fallat",
  xarxa: "No s'ha pogut contactar amb l'API",
};

/**
 * Estat de fallada de la capa de dades. Es mostra el motiu real en comptes de
 * caure a dades falses, perquè mai es pugui confondre una demo amb dades vives.
 */
export function AvisConnexio({ error }: { error: unknown }) {
  const motiu = error instanceof ErrorFactusol ? error.motiu : "consulta";
  const missatge = error instanceof Error ? error.message : String(error);

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-wine-tint text-wine-deep">
          <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
            <path
              d="M12 8.5v4.2M12 16.2h.01M10.3 4.2 2.9 17.4A2 2 0 0 0 4.6 20.4h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[22px] leading-tight">{TITOLS[motiu] ?? "Error de connexió"}</h2>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted">
            {motiu === "sense-credencials" ? (
              <>
                El portal llegeix els clients directament de l&apos;ERP. Encara no hi ha cap credencial
                desada.
              </>
            ) : (
              "No s'han pogut llegir les dades. El detall tècnic que retorna l'API és:"
            )}
          </p>

          {motiu !== "sense-credencials" ? (
            <p className="mt-3 rounded-lg bg-parchment px-3.5 py-2.5 font-mono text-[13px] text-ink">{missatge}</p>
          ) : null}

          <p className="mt-4 text-[13px] text-muted">
            Pots desar-les des de la pantalla de configuració.{" "}
            <Link href="/configuracio" className="text-wine underline underline-offset-2">
              Configura-les aquí
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
