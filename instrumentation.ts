/**
 * Arrencada del servidor. Next el crida un cop per procés, en cada runtime:
 * només al de Node hi ha res a fer, i es pot apagar amb
 * SINCRONITZACIO_AUTOMATICA=0 (en desenvolupament, per no fer consultes de geocodificació).
 *
 * La condició ha d'anar així, amb l'import a dins: Next substitueix
 * NEXT_RUNTIME en compilar i treu l'import del paquet de l'Edge, que no pot
 * carregar SQLite.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SINCRONITZACIO_AUTOMATICA === "0") return;
    const { arrencaProgramador } = await import("./lib/programador");
    arrencaProgramador();
  }
}
