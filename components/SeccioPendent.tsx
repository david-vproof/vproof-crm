import { Capcalera, EstatBuit } from "@/components/UI";
import { cercaEnllac } from "@/lib/navegacio";

/**
 * Marcador per a les entrades de menú que encara no tenen pantalla.
 * S'etiqueta de manera explícita per no confondre'l amb un error.
 */
export function SeccioPendent({ href }: { href: string }) {
  const enllac = cercaEnllac(href);
  const etiqueta = enllac?.etiqueta ?? "Secció";

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-8 lg:px-10 lg:py-10">
      <Capcalera titol={etiqueta} descripcio="Mòdul previst, encara sense implementar." />
      <div className="mt-8">
        <EstatBuit
          titol="En preparació"
          text={`La pantalla de ${etiqueta.toLowerCase()} encara no està construïda. El mòdul de clients és l'únic operatiu de moment.`}
        />
      </div>
    </div>
  );
}
