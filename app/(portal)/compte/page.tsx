import { cookies } from "next/headers";

import { Capcalera, EstatBuit } from "@/components/UI";
import { GALETA_SESSIO, esAdministrador, verificaToken } from "@/lib/sessio";
import { ErrorIdentitat, perfilDelCompte } from "@/serveis/identitat";

import { FormulariCompte } from "./FormulariCompte";

export const metadata = { title: "El meu compte · vproof CRM" };

export default async function PaginaCompte() {
  const sessio = await verificaToken((await cookies()).get(GALETA_SESSIO)?.value);

  let perfil = null;
  let avis: string | null = null;
  try {
    perfil = sessio ? await perfilDelCompte(sessio) : null;
  } catch (error) {
    avis = error instanceof ErrorIdentitat ? error.message : "No s'ha pogut llegir el perfil.";
  }

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <Capcalera titol="El meu compte" descripcio="Les teves dades d'accés al portal. Es desen a la base de dades del portal." />

      <div className="mt-6">
        {perfil ? (
          <FormulariCompte perfil={perfil} potCanviarTelefon={esAdministrador(sessio)} />
        ) : avis ? (
          <EstatBuit titol="No s'ha pogut llegir el perfil" text={avis} />
        ) : (
          <EstatBuit titol="Sense perfil a editar" text="Aquesta sessió no està lligada a cap usuari del portal." />
        )}
      </div>
    </div>
  );
}
