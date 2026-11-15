"use client";

import type Highcharts from "highcharts";

import type { FilaCategoria, FilaTerritori } from "@/domini/crm-tauler";
import { NOM_MES } from "@/domini/facturacio";

import { Grafic } from "./Grafic";
import { euros, eurosCurt, PALETA } from "./tema";

const MESOS_CURTS = NOM_MES.map((nom) => nom.slice(0, 3));

/** Les etiquetes al costat de les barres: Highcharts hi posa negreta i un contorn blanc que les emborrona; aquí, text normal. */
const ETIQUETA: Highcharts.CSSObject = { fontWeight: "400", fontSize: "11.5px", color: "#6b7b79", textOutline: "none" };

/** Facturació mes a mes: l'exercici en columnes i l'anterior en línia, sobre el mateix eix d'euros. */
export function GraficMensual({ actual, anterior, exercici, finsMes }: { actual: number[]; anterior: number[]; exercici: number; finsMes: number }) {
  const opcions: Highcharts.Options = {
    xAxis: { categories: MESOS_CURTS },
    yAxis: { title: { text: undefined }, labels: { formatter() { return eurosCurt(Number(this.value)); } } },
    tooltip: { shared: true, valueDecimals: 0 },
    plotOptions: { column: { borderRadius: 3, pointPadding: 0.08, groupPadding: 0.12 } },
    series: [
      {
        type: "column",
        name: String(exercici),
        // Els mesos encara oberts no es pinten: enganyarien amb mig mes.
        data: actual.map((valor, i) => (i < finsMes ? valor : null)),
        color: PALETA[0],
        tooltip: { pointFormatter() { return `${exercici}: <b>${euros(Number(this.y))}</b><br/>`; } },
      },
      {
        type: "spline",
        name: String(exercici - 1),
        data: anterior,
        color: PALETA[1],
        lineWidth: 2,
        marker: { radius: 3 },
        tooltip: { pointFormatter() { return `${exercici - 1}: <b>${euros(Number(this.y))}</b><br/>`; } },
      },
    ],
  };
  return <Grafic opcions={opcions} alcada={260} />;
}

/** Les categories A–E: quina part de la facturació fa cadascuna, amb quants clients. */
export function GraficCategories({ files }: { files: FilaCategoria[] }) {
  const opcions: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: files.map((f) => f.lletra) },
    yAxis: { title: { text: undefined }, max: 100, labels: { format: "{value} %" } },
    legend: { enabled: false },
    tooltip: {
      pointFormatter() {
        const fila = files[this.index];
        return `<b>${Number(this.y).toFixed(1).replace(".", ",")} %</b> de la facturació · ${euros(fila.facturacio)} · ${fila.clients} clients`;
      },
    },
    plotOptions: { bar: { borderRadius: 3, pointWidth: 16, dataLabels: { enabled: true, format: "{point.clients} clients", style: ETIQUETA } } },
    series: [{ type: "bar", name: "Part de la facturació", data: files.map((f) => ({ y: f.part, clients: f.clients })), color: PALETA[0] }],
  };
  return <Grafic opcions={opcions} alcada={Math.max(180, files.length * 34 + 40)} />;
}

/** Un rànquing per territori o per tipus: barres de facturació amb la variació al costat. */
export function GraficRanquing({ files }: { files: FilaTerritori[] }) {
  const opcions: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: files.map((f) => f.nom) },
    yAxis: { title: { text: undefined }, tickPixelInterval: 110, labels: { formatter() { return eurosCurt(Number(this.value)); } } },
    legend: { enabled: false },
    tooltip: {
      pointFormatter() {
        const fila = files[this.index];
        const variacio = fila.variacio === null ? "sense any anterior" : `${fila.variacio >= 0 ? "+" : ""}${fila.variacio.toFixed(1).replace(".", ",")} % vs any passat`;
        return `<b>${euros(fila.facturacio)}</b> · ${fila.clients} clients · ${variacio}`;
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 3,
        pointWidth: 14,
        dataLabels: {
          enabled: true,
          formatter() {
            const fila = files[this.index];
            if (fila.variacio === null) return "";
            return `${fila.variacio >= 0 ? "↑" : "↓"} ${Math.abs(fila.variacio).toFixed(0)} %`;
          },
          style: ETIQUETA,
        },
      },
    },
    series: [{ type: "bar", name: "Facturació", data: files.map((f) => ({ y: f.facturacio, color: f.variacio !== null && f.variacio < 0 ? PALETA[4] : PALETA[0] })) }],
  };
  return <Grafic opcions={opcions} alcada={Math.max(200, files.length * 30 + 40)} />;
}
