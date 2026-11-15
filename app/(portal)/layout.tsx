import { cookies } from "next/headers";

import { BarraLateral, BarraSuperiorMobil } from "@/components/BarraLateral";
import { PantallaQuieta } from "@/components/PantallaQuieta";
import { UnSolClic } from "@/components/UnSolClic";
import { GALETA_BARRA } from "@/lib/navegacio";
import { GALETA_SESSIO, esAdministrador, verificaToken } from "@/lib/sessio";
import { abastDeLaSessio } from "@/lib/sessio-actual";

export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const galetes = await cookies();
  const sessio = await verificaToken(galetes.get(GALETA_SESSIO)?.value);
  const usuari = sessio?.nom ?? sessio?.usuari ?? "admin";
  // Les funcions d'administrar (Usuaris) són només de l'administrador: el manager ho veu tot, però no administra.
  const administrador = esAdministrador(sessio);
  const barraPlegada = galetes.get(GALETA_BARRA)?.value === "plegada";
  // L'ERP i la Configuració són de qui veu els clients de tothom: administrador i manager.
  const { senseAgent, totes: veuTot } = await abastDeLaSessio();

  return (
    <div className="flex h-dvh overflow-hidden">
      <UnSolClic />
      <PantallaQuieta />
      <BarraLateral usuari={usuari} administrador={administrador} veuTot={veuTot} plegadaInicial={barraPlegada} />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperiorMobil usuari={usuari} administrador={administrador} veuTot={veuTot} />
        {/* «relative» perquè el que va posicionat a dins (els textos ocults per a lectors
            de pantalla de cada fila, posem) es col·loqui i es retalli aquí, i no allargui
            tota la pàgina, que llavors pujava sencera, barra lateral inclosa. */}
        {senseAgent ? (
          // Qui no ho veu tot i no té agent comercial no veu cap client: val més dir-ho que ensenyar pantalles buides.
          <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-800">
            El teu compte no té cap agent comercial lligat, i per això no veus cap client. Demana a un administrador que te&apos;l
            posi a Usuaris.
          </p>
        ) : null}
        <main className="scroll-slim relative flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
