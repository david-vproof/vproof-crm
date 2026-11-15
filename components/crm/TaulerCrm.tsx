import { MapaCalor } from "@/components/grafics/MapaCalor";
import { PanellCrm, type DadesPanellCrm } from "@/components/grafics/PanellCrm";
import { Kpi, TargetaGrafic } from "@/components/grafics/Targeta";
import { EstatBuit } from "@/components/UI";
import {
  activitatPerTipus,
  carregaTasques,
  embut,
  leadsPerOrigen,
  mapaActivitat,
  mesosRecents,
  pipelineMensual,
  previsioTancament,
  radarComercials,
  rendimentPerCanal,
  resumCrm,
  tancamentsPerMes,
  visitesPerComercial,
} from "@/domini/crm-analitica";
import { crmDelPortal } from "@/serveis/crm";

const euros = (valor: number) =>
  new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(valor);
const nombre = (valor: number, decimals = 0) =>
  new Intl.NumberFormat("ca-ES", { maximumFractionDigits: decimals }).format(valor);

export async function TaulerCrm() {
  const font = await crmDelPortal();
  const { nomAgent, nomCanal } = font;
  const { oportunitats, activitats, tasques } = font.crm;

  if (font.avis) {
    return (
      <div className="p-6">
        <EstatBuit titol="El tauler de CRM encara no té dades" text={font.avis} />
      </div>
    );
  }

  const mesos = mesosRecents(12);
  const resum = resumCrm(oportunitats, activitats, tasques);
  const passos = embut(oportunitats);

  const dades: DadesPanellCrm = {
    pipeline: pipelineMensual(oportunitats, mesos),
    embut: passos,
    leads: leadsPerOrigen(oportunitats, mesos),
    tancaments: tancamentsPerMes(oportunitats, mesos),
    activitat: activitatPerTipus(activitats, mesos),
    visites: visitesPerComercial(activitats, nomAgent),
    canals: rendimentPerCanal(oportunitats, nomCanal),
    previsio: previsioTancament(oportunitats),
    tasques: carregaTasques(tasques, nomAgent),
    perfil: radarComercials(oportunitats, activitats, nomAgent),
  };

  const calor = mapaActivitat(activitats, mesos, nomAgent);

  return (
    <div className="p-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi etiqueta="Pipeline obert" valor={euros(resum.pipeline)} detall={`${resum.obertes} oportunitats vives`} />
        <Kpi etiqueta="Previsió ponderada" valor={euros(resum.ponderat)} detall="valor × probabilitat d'etapa" />
        <Kpi
          etiqueta="Taxa de conversió"
          valor={`${resum.conversio.toFixed(0)} %`}
          detall={`${resum.guanyades} guanyades · ${resum.perdudes} perdudes`}
        />
        <Kpi etiqueta="Cicle de venda" valor={`${Math.round(resum.cicle)} dies`} detall="mitjana de les guanyades" />

        <Kpi etiqueta="Leads nous" valor={nombre(resum.leads30)} detall="darrers 30 dies" />
        <Kpi etiqueta="Visites i presentacions" valor={nombre(resum.visites30)} detall="darrers 30 dies" />
        <Kpi etiqueta="Activitat total" valor={nombre(resum.activitats30)} detall="contactes en 30 dies" />
        <Kpi
          etiqueta="Contactes per oportunitat"
          valor={nombre(resum.activitatsPerOportunitat, 1)}
          detall="esforç mitjà per operació"
        />

        <Kpi etiqueta="Valor mitjà" valor={euros(resum.valorMitja)} detall="per oportunitat" />
        <Kpi
          etiqueta="Velocitat del pipeline"
          valor={`${euros(resum.velocitat)}/dia`}
          detall="euros que travessen l'embut"
        />
        <Kpi
          etiqueta="Pas a proposta"
          valor={`${(passos[3]?.percentTotal ?? 0).toFixed(0)} %`}
          detall="dels leads arriben a proposta"
        />
        <Kpi
          etiqueta="Tasques vençudes"
          valor={nombre(resum.tasquesVencudes)}
          detall={`de ${resum.tasquesPendents} pendents`}
        />
      </div>

      <div className="mt-6">
        <PanellCrm dades={dades} />
      </div>

      <div className="mt-4">
        <TargetaGrafic titol="Intensitat d'activitat" subtitol="Contactes registrats per comercial i mes">
          <MapaCalor mesos={calor.mesos} files={calor.files} />
        </TargetaGrafic>
      </div>
    </div>
  );
}
