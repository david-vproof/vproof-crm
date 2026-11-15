/**
 * Accions en bloc sobre els comptes d'un segment.
 *
 * D'un segment se'n treu una llista de comptes; d'aquí es registra la mateixa
 * mena d'activitat per a cadascun, cosa que és el gruix de preparar una ronda
 * de visites. Es crea una activitat per compte, no una de compartida: cada
 * visita té la seva hora i el seu resultat.
 */
import "server-only";

import { creaItems } from "@/apis/sqlite/crm";
import { FITXES } from "@/domini/crm-fitxes";
import { instantDeLocal } from "@/domini/crm-planner";
import { comptesPerSegmentar } from "@/serveis/crm-segments";
import { tipusActivitat } from "@/serveis/crm-tipus-activitat";

/** Tope per tanda: prou per a una ruta llarga i prou poc per no petar-ho. */
export const MAXIM_PER_TANDA = 100;

/** Un compte i l'hora a què se'l visita. */
export type Visita = { compte: string; hora: string };

export type PeticioActivitats = {
  /** En l'ordre en què s'han de fer: és l'ordre de la ruta. */
  visites: Visita[];
  tipus: string;
  assumpte: string;
  /** Dia local, «2026-11-10». L'hora la porta cada visita. */
  dia: string;
};

export class ErrorAccio extends Error {}

export type ResultatAccions = { creades: number; noms: string[] };

export async function creaActivitatsPerComptes(
  peticio: PeticioActivitats,
  comercial: string | null,
): Promise<ResultatAccions> {
  const assumpte = peticio.assumpte.trim();
  if (!assumpte) throw new ErrorAccio("Cal un assumpte per a les activitats.");
  const tipus = await tipusActivitat();
  if (!tipus.some((definicio) => definicio.actiu && definicio.valor === peticio.tipus)) {
    throw new ErrorAccio("Aquest tipus d'activitat no existeix o ja no està actiu.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(peticio.dia)) throw new ErrorAccio("El dia no és vàlid.");
  if (peticio.visites.length === 0) throw new ErrorAccio("No hi ha cap client seleccionat.");
  if (peticio.visites.length > MAXIM_PER_TANDA) {
    throw new ErrorAccio(`Massa clients de cop: el màxim és ${MAXIM_PER_TANDA}.`);
  }

  // Els identificadors venen del navegador: només compten els que són comptes
  // de debò. Es respecta l'ordre rebut, que és el de la ruta.
  const perId = new Map((await comptesPerSegmentar()).map((compte) => [compte.id, compte]));
  const vistos = new Set<string>();
  const files: Record<string, unknown>[] = [];
  const noms: string[] = [];

  for (const visita of peticio.visites) {
    const compte = perId.get(visita.compte);
    if (!compte || vistos.has(compte.id)) continue;
    vistos.add(compte.id);

    const nom = compte.nom_comercial ?? "Sense nom";
    const instant = instantDeLocal(`${peticio.dia}T${visita.hora}`);
    if (!instant) throw new ErrorAccio(`L'hora de ${nom} no és vàlida.`);

    files.push({
      tipus: peticio.tipus,
      assumpte,
      data: instant,
      client: compte.id,
      // L'agent del client, com a les activitats desades des del formulari:
      // és el que deixa filtrar l'agenda per agent.
      ...(typeof compte.agent === "string" && compte.agent ? { agent: compte.agent } : {}),
      ...(comercial ? { comercial } : {}),
    });
    noms.push(nom);
  }

  if (files.length === 0) throw new ErrorAccio("No hi ha cap client seleccionat.");

  const creades = await creaItems(FITXES.activitats.colleccio, files);
  return { creades, noms };
}
