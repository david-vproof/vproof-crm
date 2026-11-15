import Link from "next/link";

import { BotonsContacte, teContacte } from "@/components/crm/Contacte";
import type { Cel·la } from "@/serveis/crm-manteniment";

/**
 * El que penja d'un client, a la seva fitxa. Obrir-ne un substitueix l'entrada
 * de l'historial, com les pestanyes: «Tanca» ha de sortir de la fitxa.
 */
export function LlistaRelacionada({
  files,
  enllacFitxa,
  buit,
}: {
  files: { id: string; "cel·les": Cel·la[] }[];
  enllacFitxa: (id: string) => string;
  buit: string;
}) {
  if (files.length === 0) {
    return <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">{buit}</p>;
  }

  return (
    <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white">
      {files.map((fila) => {
        const [titol, ...resta] = fila["cel·les"];
        // Els botons de trucar i escriure van al costat: la fila és un enllaç i no en pot portar cap a dins.
        const contactes = resta.filter((valor) => valor.contacte && !valor.buida && teContacte(valor.contacte, valor.text));
        return (
          <li key={fila.id} className="flex items-stretch">
            <Link href={enllacFitxa(fila.id)} replace scroll={false} className="block min-w-0 flex-1 px-3.5 py-2.5 transition-colors hover:bg-parchment/50">
              <span className="block truncate text-[13.5px] font-medium text-ink">
                {titol.buida ? "Sense títol" : titol.text}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted [overflow-wrap:anywhere]">
                {resta
                  // Un «No» solt no diu res; un «Sí» només s'entén amb l'etiqueta.
                  .filter((valor) => !valor.buida && !(valor.tipus === "booleà" && valor.text === "No"))
                  .map((valor, i) => (
                    <span
                      key={i}
                      className={
                        valor.tipus === "tria" || valor.tipus === "relacio" || valor.tipus === "booleà"
                          ? "rounded bg-parchment px-1.5 py-0.5 text-ink-soft"
                          : ""
                      }
                    >
                      {valor.tipus === "booleà" ? (valor.etiqueta ?? valor.text) : valor.text}
                    </span>
                  ))}
              </span>
            </Link>
            {contactes.length > 0 ? (
              <div className="flex max-w-[50%] shrink-0 flex-wrap content-center items-center justify-end gap-1.5 py-2.5 pr-3">
                {contactes.map((valor, i) => (
                  <BotonsContacte key={i} mena={valor.contacte!} valor={valor.text} />
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
