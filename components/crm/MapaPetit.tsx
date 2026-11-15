"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

/** Catalunya sencera: on va a parar el mapa si el compte encara no té punt. */
const CENTRE_PER_DEFECTE: [number, number] = [41.7, 1.8];

function iconaPunt() {
  return L.divIcon({
    className: "mapa-grup",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html:
      '<span style="width:22px;height:22px;background:#0f766e;display:block;border-radius:9999px;' +
      'border:2.5px solid #fff;box-shadow:0 2px 7px rgba(23,16,15,.45)"></span>',
  });
}

type Lloc = { nom: string; latitud: number; longitud: number };

/**
 * Un mapa per triar un punt amb el dit: clicar o arrossegar la rodona el mou,
 * i el cercador de dalt (codi postal, població, carrer) hi porta el mapa.
 */
export default function MapaPetit({
  latitud,
  longitud,
  cercaInicial,
  onTria,
  nomesMirar = false,
  alcada = 280,
}: {
  latitud: number | null;
  longitud: number | null;
  cercaInicial: string;
  onTria: (latitud: number, longitud: number) => void;
  /** Sense cercador ni controls, i el punt no es mou: per ensenyar on és, en petit. */
  nomesMirar?: boolean;
  /** L'alçada del requadre, en píxels. */
  alcada?: number;
}) {
  const contenidor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const [cerca, setCerca] = useState(cercaInicial);
  const [llocs, setLlocs] = useState<Lloc[]>([]);
  const [cercant, setCercant] = useState(false);
  const [avis, setAvis] = useState<string | null>(null);

  // El punt es posa (o es mou) sense refer el mapa.
  const posa = (lat: number, lng: number, centra: boolean) => {
    const m = mapa.current;
    if (!m) return;
    if (!marcador.current) {
      marcador.current = L.marker([lat, lng], { icon: iconaPunt(), draggable: !nomesMirar }).addTo(m);
      marcador.current.on("dragend", () => {
        const { lat: la, lng: lo } = marcador.current!.getLatLng();
        onTria(Number(la.toFixed(6)), Number(lo.toFixed(6)));
      });
    } else {
      marcador.current.setLatLng([lat, lng]);
    }
    if (centra) m.setView([lat, lng], Math.max(m.getZoom(), 15));
  };

  useEffect(() => {
    if (!contenidor.current || mapa.current) return;
    const m = L.map(contenidor.current, {
      zoomControl: !nomesMirar,
      attributionControl: true,
      // Només mirar: el mapa és una foto que es pot arrossegar una mica, sense roda ni tecles, perquè no segresti el desplaçament de la pàgina.
      scrollWheelZoom: !nomesMirar,
      doubleClickZoom: !nomesMirar,
      touchZoom: !nomesMirar,
      boxZoom: !nomesMirar,
      keyboard: !nomesMirar,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    mapa.current = m;

    if (latitud !== null && longitud !== null) {
      m.setView([latitud, longitud], 15);
      posa(latitud, longitud, false);
    } else {
      m.setView(CENTRE_PER_DEFECTE, 7);
    }

    if (!nomesMirar) {
      m.on("click", (e: L.LeafletMouseEvent) => {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        posa(lat, lng, false);
        onTria(lat, lng);
      });
    }

    // El contenidor s'acaba de desplegar: Leaflet ha de mesurar-lo un cop pintat.
    setTimeout(() => m.invalidateSize(), 50);

    return () => {
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // Només en muntar: les coordenades d'entrada són el punt de partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function busca() {
    const text = cerca.trim();
    if (!text) return;
    setCercant(true);
    setAvis(null);
    try {
      const resposta = await fetch(`/api/geocodificacio?q=${encodeURIComponent(text)}`);
      const cos = (await resposta.json()) as { llocs?: Lloc[]; error?: string };
      if (!resposta.ok) {
        setAvis(cos.error ?? "No s'ha pogut cercar.");
        setLlocs([]);
        return;
      }
      setLlocs(cos.llocs ?? []);
      if ((cos.llocs ?? []).length === 0) setAvis("Cap resultat. Prova amb el nom i la població, o amb el codi postal.");
      // Un sol resultat: s'hi va directament.
      if (cos.llocs?.length === 1) tria(cos.llocs[0]);
    } catch {
      setAvis("No s'ha pogut cercar.");
    } finally {
      setCercant(false);
    }
  }

  function tria(lloc: Lloc) {
    posa(lloc.latitud, lloc.longitud, true);
    onTria(lloc.latitud, lloc.longitud);
    setLlocs([]);
  }

  if (nomesMirar) {
    return (
      <div className="isolate overflow-hidden rounded-lg border border-line" style={{ height: alcada }}>
        <div ref={contenidor} className="h-full w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              busca();
            }
          }}
          placeholder="Nom de l'establiment, carrer, codi postal o població"
          aria-label="Cerca un lloc al mapa"
          className="field-compacte min-w-0 flex-1"
        />
        <button type="button" onClick={busca} disabled={cercant} className="btn-compacte shrink-0">
          {cercant ? "Cercant…" : "Cerca"}
        </button>
      </div>

      {llocs.length > 1 ? (
        <ul className="divide-y divide-line/70 rounded-lg border border-line bg-white">
          {llocs.map((lloc) => (
            <li key={`${lloc.latitud},${lloc.longitud}`}>
              <button
                type="button"
                onClick={() => tria(lloc)}
                className="block w-full px-3 py-1.5 text-left text-[12.5px] text-ink-soft transition hover:bg-parchment/60"
              >
                {lloc.nom}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {avis ? <p className="text-[12px] text-marca-fosc">{avis}</p> : null}

      {/* isolate: els z-index de Leaflet no han de sortir del requadre. */}
      <div className="isolate overflow-hidden rounded-lg border border-line" style={{ height: alcada }}>
        <div ref={contenidor} className="h-full w-full" />
      </div>
      <p className="text-[12px] text-muted">Clica al mapa o arrossega la rodona per posar el punt on toca.</p>
    </div>
  );
}
