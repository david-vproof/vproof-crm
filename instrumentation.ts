/**
 * Arrencada del servidor. Next el crida un cop per procés, en cada runtime:
 * només al de Node hi ha res a fer, i es pot apagar amb
 * SINCRONITZACIO_AUTOMATICA=0 (en desenvolupament, per no tocar Directus).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SINCRONITZACIO_AUTOMATICA === "0") return;

  const { arrencaProgramador } = await import("./lib/programador");
  arrencaProgramador();
}
