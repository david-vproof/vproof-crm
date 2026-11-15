"use client";

import type Highcharts from "highcharts";

import { etiquetaMes } from "@/domini/mesos";

import { Grafic } from "./Grafic";
import { Radar, type SerieRadar } from "./Radar";
import { TargetaGrafic } from "./Targeta";
import { euros, eurosCurt, nombre, PALETA } from "./tema";

export type DadesPanellCrm = {
  pipeline: { mes: string; valor: number; oportunitats: number; nous: number }[];
  embut: { etapa: string; oportunitats: number; valor: number; percentTotal: number; percentPas: number }[];
  leads: { mesos: string[]; series: { nom: string; dades: number[] }[] };
  tancaments: { mes: string; guanyades: number; perdudes: number; valorGuanyat: number; conversio: number }[];
  activitat: { mesos: string[]; series: { nom: string; dades: number[] }[] };
  visites: { nom: string; visites: number; tastos: number; remotes: number }[];
  canals: { nom: string; oportunitats: number; conversio: number; cicle: number; valor: number }[];
  previsio: { mes: string; valor: number; ponderat: number; oportunitats: number }[];
  tasques: { nom: string; vencudes: number; setmana: number; endavant: number }[];
  perfil: { eixos: string[]; series: SerieRadar[] };
};

export function PanellCrm({ dades }: { dades: DadesPanellCrm }) {
  const { pipeline, embut, leads, tancaments, activitat, visites, canals, previsio, tasques, perfil } = dades;

  const evolucio: Highcharts.Options = {
    xAxis: { categories: pipeline.map((punt) => etiquetaMes(punt.mes)) },
    yAxis: [
      { title: { text: undefined }, labels: { formatter() { return eurosCurt(Number(this.value)); } } },
      { title: { text: undefined }, opposite: true, gridLineWidth: 0, allowDecimals: false },
    ],
    tooltip: { shared: true },
    series: [
      {
        type: "areaspline",
        name: "Pipeline viu",
        data: pipeline.map((punt) => punt.valor),
        color: PALETA[0],
        fillOpacity: 0.12,
        tooltip: { pointFormatter() { return `Pipeline: <b>${euros(Number(this.y))}</b><br/>`; } },
      },
      {
        type: "column",
        name: "Leads nous",
        yAxis: 1,
        data: pipeline.map((punt) => punt.nous),
        color: PALETA[1],
        pointWidth: 10,
      },
    ],
  };

  const conversio: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: embut.map((pas) => pas.etapa) },
    yAxis: { title: { text: undefined }, allowDecimals: false },
    legend: { enabled: false },
    tooltip: {
      pointFormatter() {
        const pas = embut[this.index];
        return `<b>${pas.oportunitats}</b> oportunitats · ${euros(pas.valor)}<br/>${pas.percentTotal.toFixed(
          0,
        )} % del total · ${pas.percentPas.toFixed(0)} % de l'etapa anterior`;
      },
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: true,
          formatter() {
            return `${embut[this.index].percentTotal.toFixed(0)} %`;
          },
          style: { fontWeight: "400", fontSize: "11.5px", textOutline: "none", color: "#857878" },
        },
      },
    },
    series: [
      {
        type: "bar",
        name: "Oportunitats",
        data: embut.map((pas, index) => ({
          y: pas.oportunitats,
          // Com més avançada l'etapa, més saturat el color.
          color: `rgba(140, 47, 69, ${0.3 + (index / Math.max(1, embut.length - 1)) * 0.7})`,
        })),
      },
    ],
  };

  const origens: Highcharts.Options = {
    chart: { type: "column" },
    xAxis: { categories: leads.mesos.map(etiquetaMes) },
    yAxis: { title: { text: undefined }, allowDecimals: false, reversedStacks: false },
    tooltip: { shared: true },
    plotOptions: { column: { stacking: "normal", groupPadding: 0.08 } },
    series: leads.series.map((serie) => ({ type: "column" as const, name: serie.nom, data: serie.dades })),
  };

  const tancats: Highcharts.Options = {
    xAxis: { categories: tancaments.map((punt) => etiquetaMes(punt.mes)) },
    yAxis: [
      { title: { text: undefined }, allowDecimals: false, reversedStacks: false },
      { title: { text: undefined }, opposite: true, gridLineWidth: 0, max: 100, labels: { format: "{value} %" } },
    ],
    tooltip: { shared: true },
    plotOptions: { column: { stacking: "normal", groupPadding: 0.1 } },
    series: [
      { type: "column", name: "Guanyades", data: tancaments.map((p) => p.guanyades), color: PALETA[1] },
      { type: "column", name: "Perdudes", data: tancaments.map((p) => p.perdudes), color: "#d9c9cd" },
      {
        type: "spline",
        name: "Taxa d'encert",
        yAxis: 1,
        data: tancaments.map((p) => Math.round(p.conversio)),
        color: PALETA[0],
        tooltip: { valueSuffix: " %" },
      },
    ],
  };

  const activitatMensual: Highcharts.Options = {
    chart: { type: "column" },
    xAxis: { categories: activitat.mesos.map(etiquetaMes) },
    yAxis: { title: { text: undefined }, allowDecimals: false, reversedStacks: false },
    tooltip: { shared: true },
    plotOptions: { column: { stacking: "normal", groupPadding: 0.08 } },
    series: activitat.series.map((serie) => ({ type: "column" as const, name: serie.nom, data: serie.dades })),
  };

  const carrer: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: visites.map((agent) => agent.nom) },
    yAxis: { title: { text: undefined }, allowDecimals: false, reversedStacks: false },
    tooltip: { shared: true },
    plotOptions: { bar: { stacking: "normal" } },
    series: [
      { type: "bar", name: "Visites", data: visites.map((a) => a.visites), color: PALETA[0] },
      { type: "bar", name: "Tastos", data: visites.map((a) => a.tastos), color: PALETA[2] },
      { type: "bar", name: "Contacte remot", data: visites.map((a) => a.remotes), color: PALETA[1] },
    ],
  };

  const perCanal: Highcharts.Options = {
    xAxis: { categories: canals.map((canal) => canal.nom), labels: { style: { fontSize: "11px" } } },
    yAxis: [
      { title: { text: undefined }, max: 100, labels: { format: "{value} %" } },
      { title: { text: undefined }, opposite: true, gridLineWidth: 0, labels: { format: "{value} d" } },
    ],
    tooltip: { shared: true },
    series: [
      {
        type: "column",
        name: "Conversió",
        data: canals.map((canal) => Math.round(canal.conversio)),
        color: PALETA[0],
        tooltip: { valueSuffix: " %" },
      },
      {
        type: "spline",
        name: "Cicle de venda",
        yAxis: 1,
        data: canals.map((canal) => Math.round(canal.cicle)),
        color: PALETA[2],
        tooltip: { valueSuffix: " dies" },
      },
    ],
  };

  const previsions: Highcharts.Options = {
    chart: { type: "column" },
    xAxis: { categories: previsio.map((punt) => etiquetaMes(punt.mes)) },
    yAxis: { title: { text: undefined }, labels: { formatter() { return eurosCurt(Number(this.value)); } } },
    tooltip: {
      shared: true,
      pointFormatter() {
        return `<span style="color:${this.color}">●</span> ${this.series.name}: <b>${euros(Number(this.y))}</b><br/>`;
      },
    },
    series: [
      { type: "column", name: "Valor previst", data: previsio.map((p) => p.valor), color: "#e3ccd2" },
      { type: "column", name: "Ponderat per probabilitat", data: previsio.map((p) => p.ponderat), color: PALETA[0] },
    ],
  };

  const carrega: Highcharts.Options = {
    chart: { type: "bar" },
    xAxis: { categories: tasques.map((agent) => agent.nom) },
    yAxis: { title: { text: undefined }, allowDecimals: false, reversedStacks: false },
    tooltip: { shared: true },
    plotOptions: { bar: { stacking: "normal" } },
    series: [
      { type: "bar", name: "Vençudes", data: tasques.map((a) => a.vencudes), color: PALETA[0] },
      { type: "bar", name: "Aquesta setmana", data: tasques.map((a) => a.setmana), color: PALETA[2] },
      { type: "bar", name: "Més endavant", data: tasques.map((a) => a.endavant), color: "#ded2d5" },
    ],
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <TargetaGrafic titol="Evolució del pipeline" subtitol="Valor viu al tancament de cada mes i leads nous" ample>
        <Grafic opcions={evolucio} alcada={310} />
      </TargetaGrafic>

      <TargetaGrafic titol="Embut de conversió" subtitol="Oportunitats que arriben a cada etapa">
        <Grafic opcions={conversio} alcada={300} />
      </TargetaGrafic>

      <TargetaGrafic titol="Leads nous per origen" subtitol="D'on entra cada oportunitat, mes a mes">
        <Grafic opcions={origens} alcada={300} />
      </TargetaGrafic>

      <TargetaGrafic titol="Tancaments i taxa d'encert" subtitol="Guanyades i perdudes cada mes" ample>
        <Grafic opcions={tancats} alcada={300} />
      </TargetaGrafic>

      <TargetaGrafic titol="Activitat comercial" subtitol="Visites, tastos, trucades, correus i reunions" ample>
        <Grafic opcions={activitatMensual} alcada={300} />
      </TargetaGrafic>

      <TargetaGrafic titol="Treball de carrer" subtitol="Visites i tastos contra contacte remot, per comercial">
        <Grafic opcions={carrer} alcada={290} />
      </TargetaGrafic>

      <TargetaGrafic titol="Perfil dels comercials" subtitol="Cada eix, normalitzat sobre qui hi puntua més alt">
        <Radar eixos={perfil.eixos} series={perfil.series} alcada={290} />
      </TargetaGrafic>

      <TargetaGrafic titol="Rendiment per tipus de client" subtitol="Taxa de conversió i durada del cicle de venda">
        <Grafic opcions={perCanal} alcada={290} />
      </TargetaGrafic>

      <TargetaGrafic titol="Càrrega de tasques" subtitol="Tasques pendents de cada comercial per urgència">
        <Grafic opcions={carrega} alcada={290} />
      </TargetaGrafic>

      <TargetaGrafic titol="Previsió de tancament" subtitol="Valor que hauria d'entrar cada mes, brut i ponderat" ample>
        <Grafic opcions={previsions} alcada={290} />
      </TargetaGrafic>
    </div>
  );
}

export { nombre };
