/** «CLÍNICA» o «clínica» es llegeixen «Clínica». */
function majusculaInicial(text: string) {
  const net = text.trim().toLocaleLowerCase("ca");
  return net.charAt(0).toLocaleUpperCase("ca") + net.slice(1);
}

/**
 * Un valor secundari al costat del nom, com el tipus de client: en pastilla i
 * amb lletra petita perquè no li prengui lloc. Si no hi cap, es retalla. Els
 * tipus arriben de l'ERP en majúscules: aquí es posen amb majúscula inicial
 * i la resta en minúscules, perquè no cridin més que el nom.
 */
export function Pastilla({ text: brut, etiqueta }: { text: string; etiqueta?: string }) {
  const text = majusculaInicial(brut);
  if (!text) return null;
  return (
    <span
      title={etiqueta ? `${etiqueta}: ${text}` : text}
      className="inline-block min-w-0 max-w-[140px] truncate rounded-full bg-parchment px-1.5 py-px text-[10.5px] font-medium leading-4 text-ink-soft"
    >
      {etiqueta ? <span className="sr-only">{etiqueta}: </span> : null}
      {text}
    </span>
  );
}
