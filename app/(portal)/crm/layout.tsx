import { FonsCrm } from "@/components/crm/FonsCrm";

/**
 * El CRM té dues capes: la vista (`children`) i, a sobre, la fitxa d'un client
 * (`fitxa`, la carpeta @fitxa), que té adreça pròpia: /crm/clients/<id>.
 *
 * La vista no té cap pàgina a aquesta adreça, i per això en obrir la fitxa
 * Next la deixa tal com era, sense tornar-la a demanar: la llista amb els
 * filtres i la pàgina, el mapa, el Planificador amb la ronda a mig fer. Moure's
 * per la fitxa tampoc no la toca. Si mentrestant es desa alguna cosa, Next la
 * refresca sola des de la seva adreça.
 */
export default function LayoutCrm({ children, fitxa }: { children: React.ReactNode; fitxa: React.ReactNode }) {
  return (
    <FonsCrm>
      {children}
      {fitxa}
    </FonsCrm>
  );
}
