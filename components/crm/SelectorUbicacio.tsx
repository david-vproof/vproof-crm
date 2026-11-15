"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Leaflet toca window en importar-se: només al client, i només quan es demana.
const MapaPetit = dynamic(() => import("./MapaPetit"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-parchment/70" />,
});

function numero(valor: string) {
  const n = Number(valor.replace(",", "."));
  return valor.trim() !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Latitud i longitud, amb un mapa per triar-les amb el dit. Els dos camps
 * segueixen sent els del formulari: el mapa només els omple.
 */
export function SelectorUbicacio({
  id,
  nomLatitud,
  nomLongitud,
  latitudInicial,
  longitudInicial,
  cercaInicial,
}: {
  /** L'id del camp de la latitud, per a l'etiqueta del formulari. */
  id: string;
  nomLatitud: string;
  nomLongitud: string;
  latitudInicial: string;
  longitudInicial: string;
  /** L'adreça de la fitxa, per no haver-la de tornar a escriure al cercador. */
  cercaInicial: string;
}) {
  const [latitud, setLatitud] = useState(latitudInicial);
  const [longitud, setLongitud] = useState(longitudInicial);
  const [obert, setObert] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          name={nomLatitud}
          type="number"
          step="any"
          value={latitud}
          onChange={(e) => setLatitud(e.target.value)}
          placeholder="Latitud"
          aria-label="Latitud"
          className="field-compacte w-[140px]"
        />
        <input
          name={nomLongitud}
          type="number"
          step="any"
          value={longitud}
          onChange={(e) => setLongitud(e.target.value)}
          placeholder="Longitud"
          aria-label="Longitud"
          className="field-compacte w-[140px]"
        />
        <button
          type="button"
          onClick={() => setObert((previ) => !previ)}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] transition hover:border-ink"
        >
          {obert ? "Amaga el mapa" : "Tria al mapa"}
        </button>
        {latitud || longitud ? (
          <button
            type="button"
            onClick={() => {
              setLatitud("");
              setLongitud("");
            }}
            className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink"
          >
            Buida
          </button>
        ) : null}
      </div>

      {obert ? (
        <MapaPetit
          latitud={numero(latitud)}
          longitud={numero(longitud)}
          cercaInicial={cercaInicial}
          onTria={(lat, lng) => {
            setLatitud(String(lat));
            setLongitud(String(lng));
          }}
        />
      ) : null}
    </div>
  );
}
