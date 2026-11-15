import { llegeixCriteris, netejaNomDePlantilla, type LiniaPlantilla } from "@/domini/cistella-productes";
import { ErrorPlantilla, type DadesPlantilla } from "@/serveis/plantilles-productes";

const UUID = /^[0-9a-f-]{36}$/i;

/** Les dades d'una plantilla tal com arriben del navegador, netes: només el que té sentit. */
export function llegeixDadesDePlantilla(brut: unknown): DadesPlantilla {
  if (!brut || typeof brut !== "object") throw new ErrorPlantilla("No s'ha rebut cap plantilla.");
  const cos = brut as { nom?: unknown; descripcio?: unknown; criteris?: unknown; linies?: unknown };
  const linies: LiniaPlantilla[] = [];
  const vistos = new Set<string>();
  for (const linia of Array.isArray(cos.linies) ? cos.linies : []) {
    const article = String((linia as { article?: unknown })?.article ?? "");
    if (!UUID.test(article) || vistos.has(article)) continue;
    vistos.add(article);
    linies.push({ article, ordre: linies.length });
  }
  return {
    nom: netejaNomDePlantilla(cos.nom),
    descripcio: String(cos.descripcio ?? "").trim().slice(0, 1000),
    criteris: llegeixCriteris(cos.criteris),
    linies,
  };
}
