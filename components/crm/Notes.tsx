/**
 * Les notes d'un client allà on surt llistat: a la taula de clients, al
 * selector i a la llista d'un segment.
 *
 * Poden ser de dues ratlles o de vint, així que se'n veuen dues, amb punts
 * suspensius, i s'obren aquí mateix amb «+ més», sense haver d'entrar a la
 * fitxa. És el `details` del navegador: va sense gens de codi de client. Això
 * sí, ha d'anar fora dels enllaços i dels botons de la fila, que si no, obrir-les
 * triaria el client.
 *
 * El retall (`line-clamp`) ja posa el text com a caixa: no s'hi pot afegir
 * `block`, que el desfaria i es veuria la nota sencera.
 */
export function Notes({ text, className = "" }: { text: string; className?: string }) {
  if (!text.trim()) return null;

  return (
    <details className={`group/notes ${className}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="whitespace-pre-line text-[12px] text-muted line-clamp-2 group-open/notes:line-clamp-none">{text}</span>
        {potSerLlarga(text) ? (
          <span className="mt-0.5 inline-block text-[11.5px] text-muted/80 underline underline-offset-2 hover:text-ink">
            <span className="group-open/notes:hidden">+ més</span>
            <span className="hidden group-open/notes:inline">– menys</span>
          </span>
        ) : null}
      </summary>
    </details>
  );
}

/**
 * Si la nota pot passar de dues línies. Sense mesurar-la al navegador no es
 * pot saber del cert: es compten les ratlles i, a una columna d'uns 30
 * caràcters per línia, el text. Val més un «+ més» de sobres que una nota
 * tallada sense manera d'obrir-la.
 */
export function potSerLlarga(text: string) {
  return text.split("\n").length > 2 || text.trim().length > 60;
}
