import type Highcharts from "highcharts";

/** Paleta pensada per a fons crema, amb el vi de la marca com a color principal. */
export const PALETA = [
  "#8c2f45",
  "#3f6f6b",
  "#c98b3c",
  "#6b5b95",
  "#c2708a",
  "#4a7a96",
  "#9aa36b",
  "#b45f4d",
];

const TINTA = "#17100f";
const APAGAT = "#857878";
const LINIA = "#e7ded8";
const TIPUS = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";

export const eurosCurt = (valor: number) => {
  if (Math.abs(valor) >= 1_000_000) return `${(valor / 1_000_000).toFixed(1).replace(".", ",")} M€`;
  if (Math.abs(valor) >= 1_000) return `${Math.round(valor / 1_000)} k€`;
  return `${Math.round(valor)} €`;
};

export const euros = (valor: number) =>
  new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(valor);

export const nombre = (valor: number, decimals = 0) =>
  new Intl.NumberFormat("ca-ES", { maximumFractionDigits: decimals }).format(valor);

export const OPCIONS_BASE: Highcharts.Options = {
  colors: PALETA,
  credits: { enabled: false },
  accessibility: { enabled: false },
  chart: {
    backgroundColor: "transparent",
    style: { fontFamily: TIPUS },
    spacing: [8, 4, 8, 4],
    animation: { duration: 450 },
  },
  title: { text: undefined },
  legend: {
    align: "left",
    verticalAlign: "bottom",
    margin: 4,
    itemStyle: { color: APAGAT, fontWeight: "400", fontSize: "12px" },
    itemHoverStyle: { color: TINTA },
    symbolRadius: 3,
    symbolHeight: 9,
    symbolWidth: 9,
  },
  xAxis: {
    lineColor: LINIA,
    tickColor: LINIA,
    labels: { style: { color: APAGAT, fontSize: "11px" } },
    crosshair: { color: "rgba(23,16,15,0.08)" },
  },
  yAxis: {
    gridLineColor: LINIA,
    gridLineDashStyle: "Dash",
    title: { text: undefined },
    labels: { style: { color: APAGAT, fontSize: "11px" } },
  },
  tooltip: {
    backgroundColor: "#ffffff",
    borderColor: LINIA,
    borderRadius: 10,
    borderWidth: 1,
    shadow: { color: "rgba(23,16,15,0.10)", offsetX: 0, offsetY: 2, opacity: 0.1, width: 6 },
    style: { color: TINTA, fontSize: "12.5px" },
    useHTML: true,
  },
  plotOptions: {
    series: { animation: { duration: 450 } },
    column: { borderRadius: 3, borderWidth: 0, groupPadding: 0.12 },
    bar: { borderRadius: 3, borderWidth: 0 },
    pie: {
      borderWidth: 0,
      dataLabels: { style: { fontWeight: "400", fontSize: "12px", textOutline: "none", color: APAGAT } },
    },
    line: { lineWidth: 2, marker: { enabled: false, symbol: "circle", radius: 3 } },
    spline: { lineWidth: 2, marker: { enabled: false, symbol: "circle", radius: 3 } },
    areaspline: { lineWidth: 2, marker: { enabled: false } },
    area: { lineWidth: 2, marker: { enabled: false } },
  },
};
