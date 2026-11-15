"use client";

import type Highcharts from "highcharts";
import { useMemo } from "react";

import { Grafic } from "./Grafic";
import { PALETA } from "./tema";

export type SerieRadar = { nom: string; dades: number[]; brut: string[] };

/**
 * Gràfic de teranyina. Els valors van normalitzats de 0 a 100 sobre el màxim
 * de cada eix; el valor real es mostra al globus d'informació.
 */
export function Radar({
  eixos,
  series,
  alcada = 340,
}: {
  eixos: string[];
  series: SerieRadar[];
  alcada?: number;
}) {
  const opcions = useMemo<Highcharts.Options>(
    () => ({
      chart: { polar: true, type: "line" },
      xAxis: {
        categories: eixos,
        tickmarkPlacement: "on",
        lineWidth: 0,
        gridLineColor: "#e7ded8",
        labels: { style: { color: "#857878", fontSize: "11.5px" } },
      },
      yAxis: {
        gridLineInterpolation: "polygon",
        gridLineColor: "#e7ded8",
        lineWidth: 0,
        min: 0,
        max: 100,
        tickInterval: 25,
        labels: { enabled: false },
      },
      pane: { size: "82%" },
      tooltip: {
        shared: true,
        headerFormat: '<span style="font-size:11px;color:#857878">{point.key}</span><br/>',
        pointFormatter() {
          const serie = series.find((s) => s.nom === this.series.name);
          return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${
            serie?.brut[this.index] ?? this.y
          }</b><br/>`;
        },
      },
      plotOptions: { series: { marker: { enabled: true, radius: 3, symbol: "circle" } } },
      series: series.map((serie, index) => ({
        type: "line" as const,
        name: serie.nom,
        data: serie.dades,
        color: PALETA[index % PALETA.length],
        lineWidth: 2,
      })),
    }),
    [eixos, series],
  );

  return <Grafic opcions={opcions} alcada={alcada} />;
}
