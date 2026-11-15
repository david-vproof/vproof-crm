import { FitxaClient } from "@/components/crm/FitxaClient";

type Parametres = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; f?: string; nou?: string; ap?: string }>;
};

/**
 * La fitxa d'un client, a sobre de la vista d'on es ve. A l'adreça hi va la
 * secció (`t`), el que s'hi ha obert (`f`, o `nou` per a una alta) i la pàgina
 * d'albarans (`ap`).
 */
export default async function PaginaFitxaClient({ params, searchParams }: Parametres) {
  const { id } = await params;
  const { t = "", f = "", nou = "", ap = "" } = await searchParams;
  return <FitxaClient id={id} pestanya={t} relacionada={f} nova={nou === "1"} paginaAlbarans={ap} />;
}
