import PaginaCrm from "./page";

/**
 * Què hi ha al darrere de la fitxa d'un client quan s'hi entra de cop (un
 * enllaç de fora, recarregar): la llista de clients. Si s'hi arriba des d'una
 * vista del CRM, Next conserva aquella vista i això no es fa servir.
 */
export default function FonsDeLaFitxa() {
  return <PaginaCrm searchParams={Promise.resolve({ v: "clients" })} />;
}
