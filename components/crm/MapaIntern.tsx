"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  CATALUNYA, agrupaComptes, cauenAlMateixLloc, enquadra, posicionsAranya, quantsClients, radiDeGrup, type Grup, type PuntCompte, type PuntDestacat,
  type Regio,
} from "@/domini/crm-mapa";
import { rutaDelClient } from "@/lib/navegacio";

/** Els dos tons de la marca, per als grups que barregen segments. */
const MARCA = "#0f766e";
const MARCA_FOSC = "#115e59";
/** Els que queden fora del segment triat: hi són, però no criden. */
const APAGAT = "#b9aeae";
/** Distància mínima, en píxels, entre dos punts seguits d'un contorn: prou per seguir la mà sense milers de punts. */
const PAS_TRAC_PX = 4;
/**
 * A quin zoom es va quan una cerca porta a un lloc (un poble, un carrer): prou
 * a prop per veure el carrer. A un client o un establiment s'hi va al zoom
 * màxim, que és una adreça concreta i es vol veure la porta.
 */
const ZOOM_DESTACAT = 16;

/** La xinxeta d'un lloc trobat per l'adreça: diferent de les rodones dels clients, perquè no és cap client. */
function iconaXinxeta() {
  return L.divIcon({
    className: "mapa-xinxeta",
    iconSize: [26, 36],
    iconAnchor: [13, 36],
    tooltipAnchor: [0, -34],
    html:
      `<svg width="26" height="36" viewBox="0 0 26 36" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 4px rgba(23,16,15,.45))">` +
      `<path d="M13 1C6.4 1 1 6.3 1 12.8 1 21.6 13 35 13 35s12-13.4 12-22.2C25 6.3 19.6 1 13 1z" fill="${MARCA}" stroke="#fff" stroke-width="2"/>` +
      `<circle cx="13" cy="13" r="4.5" fill="#fff"/></svg>`,
  });
}

/** Text de l'usuari dins d'HTML de Leaflet: sempre escapat. */
function escapa(text: string) {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** El color d'un grup: el del seu segment si tots hi coincideixen. */
function colorDeGrup(grup: Grup) {
  const segments = new Set(grup.membres.map((punt) => punt.segmentId));
  if (segments.size === 1) return grup.membres[0].color;
  return grup.membres.length === 1 ? MARCA : MARCA_FOSC;
}

/** Les dues lletres d'un punt, o un punt sol si no en té cap. */
function lletresDe(punt: PuntCompte) {
  if (!punt.categoria && !punt.potencial) return "·";
  return `${punt.categoria ?? "·"}${punt.potencial ?? "·"}`;
}

/**
 * La rodona d'un grup. Amb un segment triat, els de fora es pinten pàl·lids i
 * petits: han de continuar sent-hi per donar context, sense robar l'atenció.
 */
function icona(grup: Grup, apagat: boolean) {
  const radi = apagat ? Math.min(13, Math.max(7, grup.radi * 0.55)) : grup.radi;
  const mida = radi * 2;
  const sol = grup.membres.length === 1;
  // Un compte sol duu les seves lletres: la categoria i el potencial, en aquest ordre; la que falta és un punt.
  const contingut = apagat && sol ? "" : sol ? lletresDe(grup.membres[0]) : String(grup.membres.length);
  const lletra = radi < 14 ? 10 : radi < 18 ? 13 : radi < 28 ? 14.5 : 16;

  // L'halo del grup és una ombra: no ocupa lloc, així que no cal fer créixer
  // la caixa de la icona ni recalcular-ne l'ancoratge.
  const color = apagat ? APAGAT : colorDeGrup(grup);
  const ombra = apagat
    ? "0 1px 3px rgba(23,16,15,.2)"
    : sol
      ? "0 2px 7px rgba(23,16,15,.45)"
      : `0 0 0 6px ${color}40, 0 3px 10px rgba(23,16,15,.5)`;

  return L.divIcon({
    className: "mapa-grup",
    iconSize: [mida, mida],
    iconAnchor: [radi, radi],
    html:
      `<span style="width:${mida}px;height:${mida}px;background:${color};font-size:${lletra}px;` +
      `display:grid;place-items:center;border-radius:9999px;color:#fff;font-weight:700;` +
      `border:${apagat ? 1.5 : 2.5}px solid #fff;box-shadow:${ombra};opacity:${apagat ? 0.75 : 1};` +
      `line-height:1;font-variant-numeric:tabular-nums">${contingut}</span>`,
  });
}

/** Com es diu un punt en una llista: el client i, si n'és un establiment amb un altre nom, l'establiment. */
function nomDePunt(punt: PuntCompte) {
  return punt.establiment && punt.establiment !== punt.nom ? `${punt.nom} — ${punt.establiment}` : punt.nom;
}

function retolDeGrup(grup: Grup) {
  if (grup.membres.length === 1) {
    const punt = grup.membres[0];
    const sota = [punt.tipusClient, punt.agent].filter(Boolean).join(" · ");
    // Un establiment porta el seu nom al davant i el del client a sota: en tocar-lo, s'obre el client.
    const titol = punt.establiment ?? punt.nom;
    return (
      `<strong>${escapa(titol)}</strong>` +
      (punt.establiment ? `<br>Client: ${escapa(punt.nom)}` : "") +
      (punt.adreca || punt.poblacio ? `<br><span style="color:#6b7b79">${escapa(punt.adreca || punt.poblacio)}</span>` : "") +
      (sota ? `<br><span style="color:#6b7b79">${escapa(sota)}</span>` : "") +
      `<br><span style="color:#6b7b79">${escapa(punt.segment)}</span>` +
      (punt.categoria || punt.potencial
        ? `<br><span style="color:#6b7b79">Categoria ${punt.categoria ?? "–"} · Potencial ${punt.potencial ?? "–"}</span>`
        : "")
    );
  }

  const noms = grup.membres.slice(0, 6).map((m) => `• ${escapa(nomDePunt(m))}`).join("<br>");
  const resta = grup.membres.length - 6;
  const segments = new Set(grup.membres.map((m) => m.segment));
  const cap = segments.size === 1 ? escapa([...segments][0]) : `${segments.size} segments`;
  const clients = quantsClients(grup.membres);
  const quants =
    clients === grup.membres.length ? `${clients} clients` : `${grup.membres.length} establiments de ${clients} ${clients === 1 ? "client" : "clients"}`;
  return (
    `<strong>${quants}</strong> · ${cap}<br>${noms}` +
    (resta > 0 ? `<br><span style="color:#6b7b79">i ${resta} més…</span>` : "")
  );
}

export default function MapaIntern({
  punts,
  segmentTriat,
  regions = [],
  dibuixant = false,
  alAfegirRegio,
  destacat = null,
}: {
  punts: PuntCompte[];
  /** Buit vol dir tots. Amb un segment, la resta queda apagada. */
  segmentTriat: string;
  /** Les regions d'interès dibuixades, que es pinten a sobre dels punts. */
  regions?: Regio[];
  /** Si s'està resseguint un contorn: el mapa no es mou i el dit o el ratolí dibuixen. */
  dibuixant?: boolean;
  alAfegirRegio?: (regio: Regio) => void;
  /** On ha portat la darrera cerca: s'hi va i es marca. Null treu la marca. */
  destacat?: PuntDestacat | null;
}) {
  const contenidor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaRegions = useRef<L.LayerGroup | null>(null);
  const capaCerca = useRef<L.LayerGroup | null>(null);
  const router = useRouter();
  // Els punts i el segment triat canvien sense recrear el mapa: la lògica de
  // dibuix llegeix sempre l'última versió.
  const darrers = useRef(punts);
  const triat = useRef(segmentTriat);
  const esDibuixant = useRef(dibuixant);
  const afegeix = useRef(alAfegirRegio);
  darrers.current = punts;
  triat.current = segmentTriat;
  esDibuixant.current = dibuixant;
  afegeix.current = alAfegirRegio;
  const repinta = useRef<() => void>(() => {});
  const enquadrats = useRef("");

  useEffect(() => {
    if (!contenidor.current || mapa.current) return;

    const m = L.map(contenidor.current, { zoomControl: true, attributionControl: true, worldCopyJump: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);

    const capaApagats = L.layerGroup().addTo(m);
    const capaVius = L.layerGroup().addTo(m);
    // Un grup obert en espiral: les potes i els punts, damunt de tot.
    const capaAranya = L.layerGroup().addTo(m);
    capaRegions.current = L.layerGroup().addTo(m);
    // La marca de la cerca, damunt de tot: l'anella d'un client o la xinxeta d'un lloc.
    capaCerca.current = L.layerGroup().addTo(m);
    mapa.current = m;

    /** Obre la fitxa del client d'un punt, a sobre del mapa, que es queda al darrere tal com estava. */
    function obreClient(punt: PuntCompte) {
      router.push(rutaDelClient(punt.clientId), { scroll: false });
    }

    // Quin grup hi ha obert en espiral, si n'hi ha cap: la seva rodona queda esvaïda mentrestant.
    let aranya: { clau: string; marca: L.Marker; opacitat: number } | null = null;

    function tancaAranya() {
      capaAranya.clearLayers();
      if (aranya) aranya.marca.setOpacity(aranya.opacitat);
      aranya = null;
    }

    /**
     * Obre un grup en espiral: cada punt al seu lloc, lligat al centre amb una
     * pota, i tocant-lo porta al seu client. És per als que el zoom ja no
     * separa: establiments al mateix edifici o adreces que han quedat al mig del poble.
     */
    function obreAranya(grup: Grup, marca: L.Marker, apagat: boolean, opacitat: number) {
      const clau = `${grup.latitud},${grup.longitud}`;
      const jaOberta = aranya?.clau === clau;
      tancaAranya();
      if (jaOberta) return;

      const centre = m.latLngToLayerPoint([grup.latitud, grup.longitud]);
      const posicions = posicionsAranya(grup.membres.length);
      grup.membres.forEach((punt, i) => {
        const on = m.layerPointToLatLng(centre.add(L.point(posicions[i].x, posicions[i].y)));
        L.polyline([[grup.latitud, grup.longitud], on], { color: MARCA_FOSC, weight: 1.5, opacity: 0.55, interactive: false }).addTo(capaAranya);
        const sol: Grup = { latitud: on.lat, longitud: on.lng, membres: [punt], radi: radiDeGrup(1) };
        const fill = L.marker(on, { icon: icona(sol, apagat), zIndexOffset: 20000, keyboard: false });
        fill.bindTooltip(retolDeGrup(sol), { direction: "top", offset: [0, -sol.radi] });
        fill.on("click", () => {
          if (!esDibuixant.current) obreClient(punt);
        });
        fill.addTo(capaAranya);
      });
      marca.setOpacity(0.3);
      // El rètol del grup taparia els punts de dalt de l'espiral, que ja diuen el mateix un per un.
      marca.closeTooltip();
      aranya = { clau, marca, opacitat };
    }

    function dibuixa() {
      tancaAranya();
      capaApagats.clearLayers();
      capaVius.clearLayers();

      const zoom = m.getZoom();
      const seleccio = triat.current;
      const dins = seleccio ? darrers.current.filter((punt) => punt.segmentId === seleccio) : darrers.current;
      const fora = seleccio ? darrers.current.filter((punt) => punt.segmentId !== seleccio) : [];

      const pinta = (llista: PuntCompte[], apagat: boolean, capa: L.LayerGroup) => {
        for (const grup of agrupaComptes(llista, zoom)) {
          const marca = L.marker([grup.latitud, grup.longitud], {
            icon: icona(grup, apagat),
            // Els grups grossos al davant, i els apagats sempre al darrere.
            zIndexOffset: (apagat ? -1000 : 0) + grup.membres.length * 10,
            keyboard: false,
            opacity: apagat ? 0.85 : 1,
          });
          marca.bindTooltip(retolDeGrup(grup), { direction: "top", offset: [0, -grup.radi] });

          marca.on("click", () => {
            // Mentre es ressegueix un contorn, tocar un punt no l'obre.
            if (esDibuixant.current) return;
            if (grup.membres.length === 1) {
              obreClient(grup.membres[0]);
              return;
            }
            // Un grup s'obre acostant-s'hi. Si ja no es pot acostar més, o si
            // tots cauen al mateix lloc i no se separarien mai, s'obre en espiral.
            if (m.getZoom() >= m.getMaxZoom() || cauenAlMateixLloc(grup.membres, m.getMaxZoom())) {
              obreAranya(grup, marca, apagat, apagat ? 0.85 : 1);
              return;
            }
            const límits = L.latLngBounds(
              grup.membres.map((punt) => [punt.latitud, punt.longitud] as [number, number]),
            );
            m.fitBounds(límits, { padding: [60, 60], maxZoom: m.getMaxZoom() });
          });

          marca.addTo(capa);
        }
      };

      pinta(fora, true, capaApagats);
      pinta(dins, false, capaVius);
    }

    /**
     * Encaixa la vista: sense cap segment triat, Catalunya; amb un segment,
     * els seus punts. Si el segment no en té cap de situat, també Catalunya.
     */
    function enquadraTot() {
      const seleccio = triat.current;
      const delSegment = seleccio ? darrers.current.filter((punt) => punt.segmentId === seleccio) : [];
      const marc = (delSegment.length > 0 ? enquadra(delSegment) : null) ?? CATALUNYA;
      m.fitBounds(
        [
          [marc.sud, marc.oest],
          [marc.nord, marc.est],
        ],
        // Catalunya, arran de vora: el marge gran és perquè els punts d'un segment no quedin tallats.
        { padding: marc === CATALUNYA ? [8, 8] : [50, 50], maxZoom: 13 },
      );
    }

    // Quan s'ha d'enquadrar de nou: en canviar el segment triat i, amb un
    // segment, també quan en surten punts nous. Sense segment, la vista és
    // Catalunya i no depèn dels punts: els que es van situant en segon pla no
    // han de fer saltar el mapa mentre algú hi mira.
    const empremtaVista = () => (triat.current ? `${triat.current}|${darrers.current.length}` : "");

    repinta.current = () => {
      // No a cada repintada: si no, no es podria fer zoom tranquil.
      const empremta = empremtaVista();
      if (empremta !== enquadrats.current) {
        enquadrats.current = empremta;
        enquadraTot();
      }
      dibuixa();
    };

    enquadrats.current = empremtaVista();
    enquadraTot();
    dibuixa();
    m.on("zoomend", dibuixa);
    // L'espiral és d'un zoom concret: en canviar-lo, o tocant el mapa, es plega.
    m.on("zoomstart click", tancaAranya);
    const ambEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") tancaAranya();
    };
    document.addEventListener("keydown", ambEscape);

    return () => {
      m.off("zoomend", dibuixa);
      m.off("zoomstart click", tancaAranya);
      document.removeEventListener("keydown", ambEscape);
      m.remove();
      mapa.current = null;
      capaRegions.current = null;
      capaCerca.current = null;
      repinta.current = () => {};
    };
  }, [router]);

  // Punts nous o un altre segment triat: es repinta sense refer el mapa.
  useEffect(() => {
    repinta.current();
  }, [punts, segmentTriat]);

  // Les regions dibuixades, damunt dels punts però sense robar-los els clics.
  useEffect(() => {
    const capa = capaRegions.current;
    if (!capa) return;
    capa.clearLayers();
    for (const regio of regions) {
      L.polygon(regio, { color: MARCA, weight: 2, fillColor: MARCA, fillOpacity: 0.1, interactive: false }).addTo(capa);
    }
  }, [regions]);

  // El resultat d'una cerca: s'hi vola i es marca. Un client, amb una anella al
  // voltant de la seva rodona (que ja porta el rètol); un lloc, amb una xinxeta
  // i el nom a sobre. La marca es queda fins que es treu la cerca o se'n fa una altra.
  useEffect(() => {
    const m = mapa.current;
    const capa = capaCerca.current;
    if (!m || !capa) return;
    capa.clearLayers();
    if (!destacat) return;
    const on: [number, number] = [destacat.latitud, destacat.longitud];
    if (destacat.mena === "client") {
      L.circleMarker(on, { radius: 24, color: MARCA, weight: 3, fill: false, interactive: false, className: "mapa-anella" }).addTo(capa);
    } else {
      L.marker(on, { icon: iconaXinxeta(), keyboard: false, interactive: false, zIndexOffset: 30000 })
        .bindTooltip(escapa(destacat.nom), { permanent: true, direction: "top" })
        .addTo(capa);
    }
    const zoom = destacat.mena === "client" ? m.getMaxZoom() : Math.max(m.getZoom(), ZOOM_DESTACAT);
    m.flyTo(on, zoom, { duration: 0.8 });
  }, [destacat]);

  // Resseguir un contorn: s'arrossega sobre el mapa i, en deixar anar, la regió es tanca.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !dibuixant) return;
    const element = m.getContainer();

    // El mapa es queda quiet: arrossegar dibuixa, no el desplaça.
    m.dragging.disable();
    m.doubleClickZoom.disable();
    m.boxZoom.disable();
    m.touchZoom.disable();
    const cursor = element.style.cursor;
    const tactil = element.style.touchAction;
    element.style.cursor = "crosshair";
    element.style.touchAction = "none";

    let punter: number | null = null;
    let trac: L.LatLng[] = [];
    let linia: L.Polyline | null = null;

    const baixa = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      punter = e.pointerId;
      element.setPointerCapture(e.pointerId);
      trac = [m.mouseEventToLatLng(e)];
      linia = L.polyline(trac, { color: MARCA, weight: 2, dashArray: "5 5", interactive: false }).addTo(m);
    };

    const mou = (e: PointerEvent) => {
      if (punter !== e.pointerId || !linia) return;
      const nou = m.mouseEventToLatLng(e);
      const darrer = trac[trac.length - 1];
      if (m.latLngToContainerPoint(nou).distanceTo(m.latLngToContainerPoint(darrer)) < PAS_TRAC_PX) return;
      trac.push(nou);
      linia.addLatLng(nou);
    };

    const puja = (e: PointerEvent) => {
      if (punter !== e.pointerId) return;
      punter = null;
      linia?.remove();
      linia = null;
      // Un toc o una ratlla no fan cap regió.
      if (trac.length >= 3) afegeix.current?.(trac.map((punt) => [punt.lat, punt.lng]));
      trac = [];
    };

    element.addEventListener("pointerdown", baixa);
    element.addEventListener("pointermove", mou);
    element.addEventListener("pointerup", puja);
    element.addEventListener("pointercancel", puja);

    return () => {
      element.removeEventListener("pointerdown", baixa);
      element.removeEventListener("pointermove", mou);
      element.removeEventListener("pointerup", puja);
      element.removeEventListener("pointercancel", puja);
      linia?.remove();
      element.style.cursor = cursor;
      element.style.touchAction = tactil;
      m.dragging.enable();
      m.doubleClickZoom.enable();
      m.boxZoom.enable();
      m.touchZoom.enable();
    };
  }, [dibuixant]);

  return <div ref={contenidor} className="h-full w-full" />;
}
