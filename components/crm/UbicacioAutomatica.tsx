"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { reprenUbicacioAccio, ubicaComptesAccio } from "@/app/(portal)/crm/accions";

/** Final segur si el servidor mai no digués «cap»: a sis per tanda, són uns 3.000 comptes. */
const RONDES_MAXIMES = 500;

/**
 * En obrir el mapa, els comptes que no tenen coordenades es van ubicant sols,
 * per tandes, i el mapa es refresca a cada tanda. No hi ha res a prémer: només
 * es diu què està passant mentre dura.
 */
export function UbicacioAutomatica({ perProvar }: { perProvar: number }) {
  const router = useRouter();
  const [restants, setRestants] = useState(perProvar);
  const [treballant, setTreballant] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Un sol bucle alhora. El refresc del mapa torna a executar aquest efecte, i
  // sense aquesta marca les tandes s'encavalcarien.
  const enMarxa = useRef(false);

  useEffect(() => {
    if (perProvar === 0 || enMarxa.current) return;
    enMarxa.current = true;
    setTreballant(true);

    (async () => {
      try {
        for (let ronda = 0; ronda < RONDES_MAXIMES; ronda += 1) {
          const tanda = await ubicaComptesAccio();

          if (tanda.error) {
            setError(tanda.error);
            break;
          }

          setRestants(tanda.queden);
          // Cada tanda que situa algú fa aparèixer els punts nous al mapa.
          if (tanda.ubicats > 0) router.refresh();
          if (tanda.queden === 0) break;
          // Una tanda que no ha fet res no en farà una altra: millor parar que girar en buit.
          if (tanda.ubicats === 0 && tanda.fallits === 0) break;
        }
      } finally {
        enMarxa.current = false;
        setTreballant(false);
      }
    })();

    // El bucle no s'atura en desmuntar: cada tanda ja està pagada i el que
    // deixa fet val tant si l'usuari es queda com si canvia de pestanya.
  }, [perProvar, router]);

  if (error) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-wine-tint px-3 py-2 text-[12.5px] text-wine-deep">
        <span>{error}</span>
        <BotoReprenUbicacio etiqueta="Torna-ho a provar" />
      </p>
    );
  }
  if (!treballant) return null;

  return (
    <p className="flex items-center gap-2 rounded-lg bg-parchment px-3 py-2 text-[12.5px] text-muted">
      <span className="size-2 animate-pulse rounded-full bg-wine" />
      Ubicant els clients que falten… {restants > 0 ? `en queden ${restants}` : "gairebé fet"}
    </p>
  );
}

/**
 * Buida la llista de fallits i refresca el mapa, que reprèn la ubicació sol.
 * Es fa servir tant en un error de tanda com a la llista de «per repassar».
 */
export function BotoReprenUbicacio({ etiqueta }: { etiqueta: string }) {
  const router = useRouter();
  const [enviant, setEnviant] = useState(false);

  return (
    <button
      type="button"
      disabled={enviant}
      onClick={async () => {
        setEnviant(true);
        try {
          await reprenUbicacioAccio();
          router.refresh();
        } finally {
          setEnviant(false);
        }
      }}
      className="rounded-md border border-current px-2 py-0.5 text-[12px] font-medium transition hover:bg-white/60 disabled:opacity-60"
    >
      {enviant ? "Un moment…" : etiqueta}
    </button>
  );
}
