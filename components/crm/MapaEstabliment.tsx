"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { desaPuntEstablimentAccio } from "@/app/(portal)/crm/accions";

// Leaflet toca window en importar-se: només al client, i només quan es demana.
const MapaPetit = dynamic(() => import("./MapaPetit"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-parchment/70" />,
});

const ALCADA_MIRAR = 150;
const ALCADA_EDITAR = 260;

/**
 * El mapa d'un establiment, dins de la seva caixa a la fitxa del client: en
 * petit, amb la rodona on és. «Situa'l» o «Mou el punt» obren el mapa gran
 * per clicar, arrossegar o cercar l'adreça, i «Desa» ho guarda. És l'únic
 * canvi que es fa aquí: la resta de l'establiment és de l'ERP.
 */
export function MapaEstabliment({
  id,
  latitud,
  longitud,
  adreca,
}: {
  id: string;
  latitud: number | null;
  longitud: number | null;
  /** L'adreça escrita, per al cercador del mapa. */
  adreca: string;
}) {
  const router = useRouter();
  const [editant, setEditant] = useState(false);
  const [punt, setPunt] = useState<{ latitud: number; longitud: number } | null>(
    latitud !== null && longitud !== null ? { latitud, longitud } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [desant, comenca] = useTransition();
  const ambPunt = latitud !== null && longitud !== null;

  function desa() {
    if (!punt) return;
    setError(null);
    comenca(async () => {
      const resultat = await desaPuntEstablimentAccio(id, punt.latitud, punt.longitud);
      if (resultat.error) {
        setError(resultat.error);
        return;
      }
      setEditant(false);
      router.refresh();
    });
  }

  function cancella() {
    setPunt(ambPunt ? { latitud: latitud!, longitud: longitud! } : null);
    setError(null);
    setEditant(false);
  }

  if (editant) {
    return (
      // Ocupa tota la caixa: l'adreça baixa a sota mentre es tria el punt.
      <div className="w-full basis-full space-y-2">
        <MapaPetit
          latitud={punt?.latitud ?? null}
          longitud={punt?.longitud ?? null}
          cercaInicial={adreca}
          alcada={ALCADA_EDITAR}
          onTria={(la, lo) => setPunt({ latitud: la, longitud: lo })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={desa} disabled={desant || !punt} className="btn-compacte">
            {desant ? "Desant…" : "Desa el punt"}
          </button>
          <button
            type="button"
            onClick={cancella}
            disabled={desant}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink"
          >
            Cancel·la
          </button>
          {error ? <span className="text-[12.5px] text-marca-fosc">{error}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5 sm:w-[220px] sm:shrink-0">
      {ambPunt ? (
        <div style={{ height: ALCADA_MIRAR }}>
          <MapaPetit key={`${latitud},${longitud}`} latitud={latitud} longitud={longitud} cercaInicial="" alcada={ALCADA_MIRAR} nomesMirar onTria={() => undefined} />
        </div>
      ) : (
        <div
          className="grid place-items-center rounded-lg border border-dashed border-line bg-parchment/40 px-3 text-center text-[12px] text-muted"
          style={{ height: ALCADA_MIRAR }}
        >
          Encara no és al mapa.
        </div>
      )}
      <button
        type="button"
        onClick={() => setEditant(true)}
        className="text-[12.5px] text-marca underline-offset-2 transition hover:underline"
      >
        {ambPunt ? "Mou el punt" : "Situa'l al mapa"}
      </button>
    </div>
  );
}
