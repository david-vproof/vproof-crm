"use client";

import type Highcharts from "highcharts";
import dynamic from "next/dynamic";

/**
 * Embolcall de Highcharts amb el tema del portal.
 *
 * Es carrega només al navegador: els mòduls de mapes i polar són UMD i peten
 * si s'executen durant el render de servidor. L'alçada la reserva el
 * contenidor, així no hi ha salt de maqueta mentre arriba el gràfic.
 */
const GraficIntern = dynamic(() => import("./GraficIntern"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-lg bg-parchment/70" />,
});

export function Grafic({
  opcions,
  alcada = 300,
  tipusConstructor,
}: {
  opcions: Highcharts.Options;
  alcada?: number;
  tipusConstructor?: "chart" | "mapChart";
}) {
  return (
    <div style={{ height: alcada }}>
      <GraficIntern opcions={opcions} alcada={alcada} tipusConstructor={tipusConstructor} />
    </div>
  );
}
