import { ImageResponse } from "next/og";

import { SegellApp } from "@/components/SegellApp";

/**
 * Icones de l'app en tres talles, dibuixades a partir del segell: no hi ha
 * cap PNG al repositori. La «mascara» és per als llançadors d'Android, que hi
 * apliquen la seva forma: el fons va de banda a banda i l'emblema, més recollit.
 */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
    { id: "mascara", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default function Icon({ id }: { id: string }) {
  const mida = id === "192" ? 192 : 512;
  const mascara = id === "mascara";
  return new ImageResponse(
    <SegellApp mida={mida} radi={mascara ? 0 : Math.round(mida * 0.22)} escala={mascara ? 0.5 : 0.62} />,
    { width: mida, height: mida },
  );
}
