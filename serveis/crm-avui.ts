/**
 * D'on surt l'agenda del dia.
 *
 * Les activitats i les tasques es demanen ja filtrades per qui té la sessió
 * oberta: l'agenda és personal, i portar-se les de tot l'equip per després
 * llençar-les seria pagar dues vegades. Els segments, com al Planner, no venen
 * enganxats a la fitxa i s'han d'avaluar, així que a banda de les activitats
 * del dia es llegeixen els segments i els comptes.
 */
import "server-only";

import {
  comptaAgendaEntre,
  llistaAgendaEntre,
  llistaTasquesDelDia,
  type FilaAgenda,
  type FilaTasca,
} from "@/apis/sqlite/crm";
import {
  araAqui,
  construeixAgenda,
  disponibilitatDe,
  margesDelDia,
  sumaMinuts,
  type ActeAgenda,
  type Agenda,
  type TascaAgenda,
} from "@/domini/crm-avui";
import { activitatTancada, esLletra } from "@/domini/crm-fitxes";
import { llegeixHorari } from "@/domini/crm-horaris";
import { nomDelTipus, tipusPortaProducte, type DefinicioTipus } from "@/domini/crm-tipus-activitat";
import { CAMPS_RESUM_FACTURACIO } from "@/domini/facturacio-tendencia";
import { nomDeLloc } from "@/lib/format";
import { COLOR_SENSE_SEGMENT, SENSE_SEGMENT, avuiLocal, momentLocal } from "@/domini/crm-planner";
import { comptesPerSegmentar, repartimentPerSegment, segmentsActius, type Segment } from "@/serveis/crm-segments";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";
import { marquesDe } from "@/domini/marques-client";
import { type ClientsMarcats, clientsMarcats } from "@/serveis/marques-client";

export type { Agenda } from "@/domini/crm-avui";

function text(valor: string | null | undefined) {
  return valor ?? "";
}

/** El telèfon que de debò es marcarà: primer el del contacte, si n'hi ha. */
function telefonDe(fila: FilaAgenda) {
  return (
    text(fila.contacte?.mobil) ||
    text(fila.contacte?.telefon) ||
    text(fila.client?.telefon) ||
    text(fila.lead?.telefon)
  );
}

function nomContacte(fila: FilaAgenda) {
  return [fila.contacte?.nom, fila.contacte?.cognoms].filter(Boolean).join(" ").trim();
}

function aActe(fila: FilaAgenda, dia: string, segment: Segment | undefined, marcats: ClientsMarcats, definicions: DefinicioTipus[]): ActeAgenda | null {
  const moment = momentLocal(fila.data);
  if (!moment) return null;

  const tipus = text(fila.tipus);
  const horari = fila.client ? llegeixHorari(fila.client.horari_comercial) : null;

  return {
    id: fila.id,
    hora: moment.hora,
    fi: fila.durada_minuts ? sumaMinuts(moment.hora, fila.durada_minuts) : "",
    tipus: nomDelTipus(definicions, tipus),
    ambProductes: tipusPortaProducte(definicions, tipus),
    assumpte: text(fila.assumpte) || "Sense assumpte",
    compte: text(fila.client?.nom_comercial) || text(fila.lead?.nom) || text(fila.laboratori?.nom_comercial),
    esLead: !fila.client && Boolean(fila.lead),
    marques: marquesDe(fila.client?.id, marcats) ?? null,
    categoria: esLletra(fila.client?.categoria) ? fila.client.categoria : null,
    potencial: esLletra(fila.client?.potencial) ? fila.client.potencial : null,
    facturacio: fila.client
      ? Object.fromEntries(CAMPS_RESUM_FACTURACIO.map((camp) => [camp, fila.client?.[camp] ?? null]))
      : null,
    segmentId: segment?.id ?? "",
    segment: segment?.nom ?? SENSE_SEGMENT,
    color: segment?.color ?? COLOR_SENSE_SEGMENT,
    poblacio: nomDeLloc(text(fila.client?.poblacio) || text(fila.lead?.poblacio)),
    telefon: telefonDe(fila),
    contacte: nomContacte(fila),
    resultat: text(fila.resultat),
    tancada: activitatTancada(fila),
    properPas: text(fila.proper_pas),
    quan: disponibilitatDe(horari, dia, moment.hora),
    // La marca la posa `construeixAgenda`, que és qui sap quina hora és.
    passada: false,
  };
}

function aTasca(fila: FilaTasca): TascaAgenda {
  const estat = text(fila.estat) || "pendent";
  return {
    id: fila.id,
    titol: text(fila.titol) || "Sense títol",
    compte: text(fila.client?.nom_comercial) || text(fila.lead?.nom),
    prioritat: text(fila.prioritat) || "normal",
    pendent: estat !== "feta" && estat !== "cancellada",
    estat,
  };
}

/**
 * L'agenda d'avui de qui té la sessió oberta: el que porta i el que no porta
 * ningú. Sense `comercial` —les credencials locals no en tenen— surt la de
 * tothom, i l'agenda ho diu.
 */
export async function agendaDavui(comercial: string | null): Promise<Agenda> {
  const dia = avuiLocal();
  const { desde, fins } = margesDelDia(dia);

  const [files, tasques, segments, comptes, marcats, definicions] = await Promise.all([
    llistaAgendaEntre(desde, fins, comercial),
    llistaTasquesDelDia(dia, comercial),
    segmentsActius(),
    comptesPerSegmentar(),
    clientsMarcats(),
    tipusActivitat(),
  ]);

  const dequi = repartimentPerSegment(comptes, segments);
  const actes = files
    .map((fila) => aActe(fila, dia, fila.client?.id ? dequi.get(fila.client.id) : undefined, marcats, definicions))
    .filter((acte): acte is ActeAgenda => acte !== null);

  return construeixAgenda(dia, actes, tasques.map(aTasca), {
    ara: araAqui(),
    meves: comercial !== null,
  });
}

/** Quantes activitats hi ha avui, per al comptador de la pestanya. */
export async function comptaActivitatsDavui(comercial: string | null): Promise<number> {
  const { desde, fins } = margesDelDia(avuiLocal());
  return comptaAgendaEntre(desde, fins, comercial);
}
