/**
 * Les activitats que van al calendari del Planner, repartides per segment.
 *
 * Els segments no venen enganxats a la fitxa: es llegeixen els comptes i
 * s'avalua qui encaixa on. Per això el calendari carrega, a banda de les
 * activitats del tram que es mira, els segments i els comptes.
 */
import "server-only";

import { llistaActivitatsEntre } from "@/apis/sqlite/crm";
import { activitatTancada, esLletra } from "@/domini/crm-fitxes";
import {
  COLOR_SENSE_SEGMENT,
  SENSE_SEGMENT,
  analitzaDia,
  analitzaMes,
  construeixMes,
  construeixSetmana,
  marges,
  margesSetmana,
  momentLocal,
  type Esdeveniment,
  type MesPlanner,
  type SetmanaPlanner,
} from "@/domini/crm-planner";
import { nomDelTipus } from "@/domini/crm-tipus-activitat";
import { comptesPerSegmentar, repartimentPerSegment, segmentsActius } from "@/serveis/crm-segments";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

export type { MesPlanner, SetmanaPlanner } from "@/domini/crm-planner";

/** Un segment que surt al calendari, per a la llegenda. */
export type SegmentPintat = { id: string; nom: string; color: string };

export type Calendari = { mes: MesPlanner; segments: SegmentPintat[] };
export type CalendariSetmana = { setmana: SetmanaPlanner; segments: SegmentPintat[] };

/**
 * Les activitats d'un interval, ja pintades amb el color del seu segment. El
 * calendari és el de cadascú: amb `comercial`, només les seves i les de ningú.
 * Amb `agent`, només les d'aquell representant comercial.
 */
async function esdevenimentsEntre(desde: string, fins: string, comercial: string | null, agent: string | null) {
  const [files, segments, comptes, definicions] = await Promise.all([
    llistaActivitatsEntre(desde, fins, comercial, agent),
    segmentsActius(),
    comptesPerSegmentar(),
    tipusActivitat(),
  ]);

  const dequi = repartimentPerSegment(comptes, segments);
  const esdeveniments: Esdeveniment[] = [];
  const usats = new Set<string>();

  for (const fila of files) {
    const moment = momentLocal(fila.data ?? fila.date_created);
    // Sense data no hi ha lloc al calendari: la fitxa igualment surt al llistat.
    if (!moment) continue;

    // Els segments es defineixen amb variables del compte, així que una
    // activitat que encara penja d'un lead no en té cap.
    const segment = fila.client?.id ? dequi.get(fila.client.id) : undefined;
    if (segment) usats.add(segment.id);

    esdeveniments.push({
      id: fila.id,
      dia: moment.dia,
      hora: moment.hora,
      tipus: nomDelTipus(definicions, fila.tipus ?? ""),
      titol: fila.assumpte ?? "Sense assumpte",
      compte: fila.client?.nom_comercial ?? fila.lead?.nom ?? fila.laboratori?.nom_comercial ?? "",
      categoria: esLletra(fila.client?.categoria) ? fila.client.categoria : null,
      potencial: esLletra(fila.client?.potencial) ? fila.client.potencial : null,
      resultat: fila.resultat ?? "",
      tancada: activitatTancada(fila),
      segmentId: segment?.id ?? "",
      segment: segment?.nom ?? SENSE_SEGMENT,
      color: segment?.color ?? COLOR_SENSE_SEGMENT,
    });
  }

  // A la llegenda, només els segments que surten en aquest tros de calendari.
  const pintats: SegmentPintat[] = segments
    .filter((segment) => usats.has(segment.id))
    .map(({ id, nom, color }) => ({ id, nom, color }));

  return { esdeveniments, segments: pintats };
}

export async function calendariDelPlanner(
  clau: string | undefined,
  comercial: string | null = null,
  agent: string | null = null,
): Promise<Calendari> {
  const { any, mes } = analitzaMes(clau);
  const { desde, fins } = marges(any, mes);
  const { esdeveniments, segments } = await esdevenimentsEntre(desde, fins, comercial, agent);
  return { mes: construeixMes(any, mes, esdeveniments), segments };
}

export async function setmanaDelPlanner(
  clau: string | undefined,
  comercial: string | null = null,
  agent: string | null = null,
): Promise<CalendariSetmana> {
  const dia = analitzaDia(clau);
  const { desde, fins } = margesSetmana(dia);
  const { esdeveniments, segments } = await esdevenimentsEntre(desde, fins, comercial, agent);
  return { setmana: construeixSetmana(dia, esdeveniments), segments };
}
