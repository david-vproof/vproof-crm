"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { esClauFitxa } from "@/domini/crm-fitxes";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { llegeixAtributsJson } from "@/domini/atributs";
import { llegeixDeuresJson } from "@/domini/crm-deures";
import { ErrorTancament, ErrorToDo, apuntaToDo, marcaDeure, marcaToDo, reobreActivitat, tancaActivitat } from "@/serveis/crm-deures";
import { ErrorFitxa, comprovaQueEsSeva, desaFitxa, esborraFitxa } from "@/serveis/crm-manteniment";
import { ErrorAccio, creaActivitatsPerComptes, type Visita } from "@/serveis/crm-accions";
import { reiniciaFallits, ubicaComptesPendents, ubicaTotsElsPendents } from "@/serveis/crm-mapa";
import { desaPuntEstabliment } from "@/serveis/establiments";

export type EstatFitxa = { error?: string; desat?: boolean };

/** Qui té la sessió oberta, per deixar-ne rastre a les fitxes que crea. */
async function comercialDeLaSessio() {
  return (await abastDeLaSessio()).jo;
}

/** Només rutes internes, per no obrir un redirect obert. */
function destiSegur(brut: string, alternativa: string) {
  return brut.startsWith("/") && !brut.startsWith("//") ? brut : alternativa;
}

export async function desaFitxaAccio(_previ: EstatFitxa, dades: FormData): Promise<EstatFitxa> {
  const entitat = String(dades.get("entitat") ?? "");
  const id = String(dades.get("id") ?? "");
  const retorn = String(dades.get("retorn") ?? "");

  if (!esClauFitxa(entitat)) return { error: "Aquesta fitxa no existeix." };

  try {
    const { jo, deQui } = await abastDeLaSessio();
    if (id) await comprovaQueEsSeva(entitat, id, deQui);
    await desaFitxa(entitat, id || null, dades, jo);
  } catch (error) {
    if (error instanceof ErrorFitxa) return { error: error.message };
    return { error: `No s'ha pogut desar: ${(error as Error).message}` };
  }

  // Un client nou o amb l'adreça canviada es situa de seguida, en segon pla:
  // així ja compta als segments per ubicació sense haver d'obrir el mapa.
  if (entitat === "clients") void ubicaTotsElsPendents().catch(() => undefined);

  revalidatePath("/crm", "layout");
  // Des de la fitxa d'un client, on anar ho decideix el navegador. La fitxa és
  // a sobre d'una vista, i un redirect fet aquí la tornaria a demanar sencera.
  if (dades.get("sense_redireccio")) return { desat: true };
  redirect(destiSegur(retorn, `/crm?v=${entitat}`));
}

export type EstatUbicacio = { ubicats: number; fallits: number; queden: number; error?: string };

/**
 * Una tanda de comptes per ubicar. La crida el mapa tot sol en obrir-se, i la
 * repeteix mentre quedin comptes: el servei d'OpenStreetMap admet una consulta
 * per segon, així que fer-ho tot d'una vegada deixaria la petició penjada.
 */
export async function ubicaComptesAccio(): Promise<EstatUbicacio> {
  try {
    const resultat = await ubicaComptesPendents();
    if (resultat.ubicats > 0) revalidatePath("/crm", "layout");
    return resultat;
  } catch (error) {
    return { ubicats: 0, fallits: 0, queden: 0, error: `No s'ha pogut ubicar: ${(error as Error).message}` };
  }
}

/**
 * Torna a posar a la cua els comptes que OpenStreetMap no havia sabut situar
 * (o que van caure en una estona en què limitava les consultes). El mapa, en
 * refrescar-se, reprèn la ubicació tot sol.
 */
export async function reprenUbicacioAccio() {
  reiniciaFallits();
  revalidatePath("/crm", "layout");
}

export type EstatAccions = { error?: string; fet?: string };

/**
 * Registra la mateixa activitat per a cada compte seleccionat d'un segment.
 * És el pas que converteix un segment en una ronda de visites.
 */
export async function creaActivitatsAccio(_previ: EstatAccions, dades: FormData): Promise<EstatAccions> {
  let visites: Visita[] = [];
  try {
    const brut = JSON.parse(String(dades.get("visites") ?? "[]"));
    visites = Array.isArray(brut)
      ? brut.map((fila) => ({
          compte: String((fila as Visita)?.compte ?? ""),
          hora: String((fila as Visita)?.hora ?? ""),
        }))
      : [];
  } catch {
    return { error: "La selecció de clients no és vàlida." };
  }

  const dia = String(dades.get("dia") ?? "").trim();
  if (!dia) return { error: "Cal indicar el dia." };

  try {
    const { creades } = await creaActivitatsPerComptes(
      {
        visites,
        dia,
        tipus: String(dades.get("tipus") ?? ""),
        assumpte: String(dades.get("assumpte") ?? ""),
      },
      await comercialDeLaSessio(),
    );

    revalidatePath("/crm", "layout");
    return {
      fet: `${creades} ${creades === 1 ? "activitat creada" : "activitats creades"}. Ja surten a l'Agenda.`,
    };
  } catch (error) {
    if (error instanceof ErrorAccio) return { error: error.message };
    return { error: `No s'han pogut crear: ${(error as Error).message}` };
  }
}

export type EstatTancament = { error?: string; fet?: string };

/**
 * Tanca l'activitat i converteix els deures en tasques del compte.
 *
 * Tancar és un pas a part i no un camp del formulari: és quan es diu com ha
 * anat i què queda per fer, i el que queda ha de sobreviure a l'activitat.
 */
export async function tancaActivitatAccio(
  _previ: EstatTancament,
  dades: FormData,
): Promise<EstatTancament> {
  const id = String(dades.get("id") ?? "");
  if (!id) return { error: "No se sap quina activitat es tanca." };

  try {
    await comprovaQueEsSeva("activitats", id, (await abastDeLaSessio()).deQui);
    const { deures, atributs } = await tancaActivitat(
      id,
      {
        resultat: String(dades.get("resultat") ?? ""),
        deures: llegeixDeuresJson(dades.get("deures")),
        venciment: String(dades.get("venciment") ?? "").trim(),
        atributs: llegeixAtributsJson(dades.get("atributs")),
      },
      await comercialDeLaSessio(),
    );

    revalidatePath("/crm", "layout");
    const extres = [
      deures > 0 ? `${deures} To-Do` : null,
      atributs > 0 ? `${atributs} ${atributs === 1 ? "atribut nou" : "atributs nous"}` : null,
    ].filter(Boolean);
    return { fet: extres.length === 0 ? "Activitat tancada." : `Activitat tancada amb ${extres.join(" i ")}.` };
  } catch (error) {
    if (error instanceof ErrorTancament || error instanceof ErrorFitxa) return { error: error.message };
    return { error: `No s'ha pogut tancar: ${(error as Error).message}` };
  }
}

export async function reobreActivitatAccio(
  _previ: EstatTancament,
  dades: FormData,
): Promise<EstatTancament> {
  const id = String(dades.get("id") ?? "");
  if (!id) return { error: "No se sap quina activitat s'obre." };

  try {
    await comprovaQueEsSeva("activitats", id, (await abastDeLaSessio()).deQui);
    await reobreActivitat(id);
    revalidatePath("/crm", "layout");
    return { fet: "Activitat oberta de nou." };
  } catch (error) {
    return { error: `No s'ha pogut obrir: ${(error as Error).message}` };
  }
}

export type EstatToDo = { error?: string; fet?: string };

/** Apunta un To-Do a un client des de la seva fitxa. */
export async function apuntaToDoAccio(_previ: EstatToDo, dades: FormData): Promise<EstatToDo> {
  const client = String(dades.get("client") ?? "");
  if (!client) return { error: "No se sap de quin client és." };

  try {
    await apuntaToDo(
      client,
      { text: dades.get("text"), venciment: String(dades.get("venciment") ?? "").trim() },
      await comercialDeLaSessio(),
    );
    revalidatePath("/crm", "layout");
    return { fet: "To-Do apuntat." };
  } catch (error) {
    if (error instanceof ErrorToDo) return { error: error.message };
    return { error: `No s'ha pogut apuntar: ${(error as Error).message}` };
  }
}

/** Marca o desmarca un deure des de la fitxa de l'activitat. */
export async function marcaDeureAccio(id: string, fet: boolean): Promise<{ error?: string }> {
  if (!id) return { error: "Aquest To-Do ja no hi és." };
  try {
    await marcaDeure(id, fet);
    revalidatePath("/crm", "layout");
    return {};
  } catch (error) {
    return { error: `No s'ha pogut desar: ${(error as Error).message}` };
  }
}

/**
 * Marca o desmarca un To-Do des de la pantalla de To-Do.
 *
 * A diferència de `marcaDeureAccio`, no refresca la pantalla: la fila es queda
 * on és, ratllada, i es pot desfer amb la mateixa casella. Si es refresqués, el
 * To-Do saltaria de llista en el moment de marcar-lo, i una relliscada no es
 * podria arreglar. Les altres pantalles ja ho veuen al dia a la propera visita.
 */
export async function marcaToDoAccio(id: string, fet: boolean): Promise<{ error?: string }> {
  if (!id) return { error: "Aquest To-Do ja no hi és." };
  try {
    await marcaToDo(id, fet);
    return {};
  } catch (error) {
    return { error: `No s'ha pogut desar: ${(error as Error).message}` };
  }
}

export async function esborraFitxaAccio(dades: FormData) {
  const entitat = String(dades.get("entitat") ?? "");
  const id = String(dades.get("id") ?? "");
  const retorn = String(dades.get("retorn") ?? "");
  if (!esClauFitxa(entitat) || !id) return;

  try {
    await comprovaQueEsSeva(entitat, id, (await abastDeLaSessio()).deQui);
    await esborraFitxa(entitat, id);
  } catch (error) {
    // La fitxa no s'ha esborrat (ve de l'ERP, posem): es torna on s'era.
    if (error instanceof ErrorFitxa) redirect(destiSegur(retorn, `/crm?v=${entitat}`));
    throw error;
  }
  revalidatePath("/crm", "layout");
  redirect(destiSegur(retorn, `/crm?v=${entitat}`));
}

export type EstatEsborrat = { error?: string; esborrat?: boolean };

/**
 * Esborra des de la fitxa d'un client: el mateix que `esborraFitxaAccio`, però
 * sense redirigir, per la mateixa raó que en desar. On anar després ho decideix el navegador.
 */
export async function esborraDeLaFitxaAccio(_previ: EstatEsborrat, dades: FormData): Promise<EstatEsborrat> {
  const entitat = String(dades.get("entitat") ?? "");
  const id = String(dades.get("id") ?? "");
  if (!esClauFitxa(entitat) || !id) return { error: "Aquesta fitxa no existeix." };

  try {
    await comprovaQueEsSeva(entitat, id, (await abastDeLaSessio()).deQui);
    await esborraFitxa(entitat, id);
  } catch (error) {
    if (error instanceof ErrorFitxa) return { error: error.message };
    return { error: `No s'ha pogut esborrar: ${(error as Error).message}` };
  }
  revalidatePath("/crm", "layout");
  return { esborrat: true };
}

/**
 * Situa o mou el punt del mapa d'un establiment, des de la seva caixa a la
 * fitxa del client. L'abast de la sessió ja impedeix tocar el d'un client que
 * no és seu (vegeu `apis/directus/crm.ts`).
 */
export async function desaPuntEstablimentAccio(id: string, latitud: number, longitud: number): Promise<{ error?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Aquest establiment no existeix." };
  try {
    await desaPuntEstabliment(id, Number(latitud), Number(longitud));
  } catch (error) {
    return { error: `No s'ha pogut desar el punt: ${(error as Error).message}` };
  }
  revalidatePath("/crm", "layout");
  return {};
}
