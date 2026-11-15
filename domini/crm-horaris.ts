/**
 * Horaris d'un compte, per blocs.
 *
 * Un compte no està obert de nou a nou: obre al matí, tanca a l'hora de dinar i
 * torna a obrir a la tarda. Per això cada dia porta una llista de blocs i no un
 * sol interval. A més, cada dia té un estat propi: n'hi ha que estan bloquejats
 * —no s'hi va— i n'hi ha de preferents, que és on convé posar la visita.
 *
 * Hi ha dos horaris independents: quan es pot anar a vendre i quan es pot
 * entregar. Sovint no coincideixen.
 *
 * Tot és càlcul pur. La forma que es desa a Directus és aquesta mateixa, en
 * JSON, i sempre es torna a validar en llegir-la.
 */
export const DIES = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];
export const DIES_CURTS = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];

export type EstatDia = "obert" | "preferent" | "bloquejat";

export const ESTATS_DIA: [EstatDia, string][] = [
  ["obert", "Obert"],
  ["preferent", "Preferent"],
  ["bloquejat", "Bloquejat"],
];

/** Un tram del dia: «de» i «a» en format HH:MM, amb «de» abans que «a». */
export type Bloc = { de: string; a: string };

export type DiaHorari = { estat: EstatDia; blocs: Bloc[] };

/** Sempre set dies, de dilluns a diumenge. */
export type Horari = DiaHorari[];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function horariBuit(): Horari {
  return DIES.map(() => ({ estat: "obert" as EstatDia, blocs: [] }));
}

function llegeixBloc(brut: unknown): Bloc | null {
  if (!brut || typeof brut !== "object") return null;
  const { de, a } = brut as Record<string, unknown>;
  if (typeof de !== "string" || typeof a !== "string") return null;
  if (!HORA.test(de) || !HORA.test(a)) return null;
  // Un bloc que acaba abans de començar no vol dir res.
  return de < a ? { de, a } : null;
}

function esEstat(brut: unknown): brut is EstatDia {
  return brut === "obert" || brut === "preferent" || brut === "bloquejat";
}

/** Neteja el que arriba de Directus i garanteix els set dies en ordre. */
export function llegeixHorari(brut: unknown): Horari {
  const files = Array.isArray(brut) ? brut : [];

  return DIES.map((_, posicio) => {
    const fila = files[posicio];
    if (!fila || typeof fila !== "object") return { estat: "obert" as EstatDia, blocs: [] };

    const { estat, blocs } = fila as Record<string, unknown>;
    const nets = (Array.isArray(blocs) ? blocs : [])
      .map(llegeixBloc)
      .filter((bloc): bloc is Bloc => bloc !== null)
      .sort((a, b) => a.de.localeCompare(b.de));

    return { estat: esEstat(estat) ? estat : "obert", blocs: nets };
  });
}

/** Si un horari no diu res enlloc, val més tractar-lo com a no informat. */
export function horariBuitDeTot(horari: Horari) {
  return horari.every((dia) => dia.estat === "obert" && dia.blocs.length === 0);
}

export type Disponibilitat = "obert" | "tancat" | "bloquejat" | "sense_horari";

/**
 * Si a una hora d'un dia el compte està disponible. `posicioDia` va de 0
 * (dilluns) a 6 (diumenge), com `DIES`. Un dia sense cap bloc no es dona per
 * tancat: es dona per no informat, que no és el mateix.
 */
export function disponibilitat(horari: Horari, posicioDia: number, hora: string): Disponibilitat {
  const dia = horari[posicioDia];
  if (!dia) return "sense_horari";
  if (dia.estat === "bloquejat") return "bloquejat";
  if (dia.blocs.length === 0) return "sense_horari";
  // El bloc inclou l'hora d'obrir i exclou la de tancar: a les 13:00 ja és tard.
  return dia.blocs.some((bloc) => hora >= bloc.de && hora < bloc.a) ? "obert" : "tancat";
}

/** Els dies marcats com a preferents, per ordre de setmana. */
export function diesPreferents(horari: Horari) {
  return horari.flatMap((dia, posicio) => (dia.estat === "preferent" ? [posicio] : []));
}

export function diesBloquejats(horari: Horari) {
  return horari.flatMap((dia, posicio) => (dia.estat === "bloquejat" ? [posicio] : []));
}

/** Dilluns és 0 i diumenge 6, que és com es llegeix una setmana aquí. */
export function posicioDeData(dia: string) {
  const quan = new Date(`${dia}T00:00:00Z`);
  if (Number.isNaN(quan.getTime())) return null;
  return (quan.getUTCDay() + 6) % 7;
}

/** «Dl-Dv 8:00-13:00, 17:00-20:00 · Ds bloquejat», per als llistats. */
export function descriuHorari(horari: Horari) {
  if (horariBuitDeTot(horari)) return "";

  const empremta = (dia: DiaHorari) =>
    `${dia.estat}|${dia.blocs.map((bloc) => `${bloc.de}-${bloc.a}`).join(",")}`;

  // Els dies seguits amb el mateix horari es diuen d'una vegada: «Dl-Dv».
  const trams: { desde: number; fins: number; dia: DiaHorari }[] = [];
  horari.forEach((dia, posicio) => {
    const ultim = trams[trams.length - 1];
    if (ultim && empremta(ultim.dia) === empremta(dia)) ultim.fins = posicio;
    else trams.push({ desde: posicio, fins: posicio, dia });
  });

  return trams
    .filter((tram) => tram.dia.estat !== "obert" || tram.dia.blocs.length > 0)
    .map((tram) => {
      const nom =
        tram.desde === tram.fins
          ? DIES_CURTS[tram.desde]
          : `${DIES_CURTS[tram.desde]}-${DIES_CURTS[tram.fins]}`;
      if (tram.dia.estat === "bloquejat") return `${nom} bloquejat`;
      const hores = tram.dia.blocs.map((bloc) => `${bloc.de}-${bloc.a}`).join(" i ");
      const marca = tram.dia.estat === "preferent" ? "★" : "";
      return `${nom}${marca} ${hores}`.trim();
    })
    .join(" · ");
}
