"use client";

import type HighchartsTipus from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { useMemo } from "react";

import Highcharts from "./highcharts";
import { OPCIONS_BASE } from "./tema";

/**
 * Render real del gràfic. Viu en un mòdul a part perquè `Grafic` el pugui
 * carregar només al navegador: els mòduls de Highcharts (mapes i polar) són
 * UMD i peten si s'executen durant el render de servidor.
 */
export default function GraficIntern({
  opcions,
  alcada,
  tipusConstructor,
}: {
  opcions: HighchartsTipus.Options;
  alcada: number;
  tipusConstructor?: "chart" | "mapChart";
}) {
  const finals = useMemo(
    () => Highcharts.merge({}, OPCIONS_BASE, { chart: { height: alcada } }, opcions),
    [opcions, alcada],
  );

  return <HighchartsReact highcharts={Highcharts} constructorType={tipusConstructor} options={finals} />;
}
