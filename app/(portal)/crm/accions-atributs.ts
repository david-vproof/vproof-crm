"use server";

import { revalidatePath } from "next/cache";

import { netejaAtribut } from "@/domini/atributs";
import { abastDeLaSessio } from "@/lib/sessio-actual";
import { afegeixAtributs, esborraAtribut } from "@/serveis/atributs";

export type EstatAtribut = { error?: string; fet?: string };

const UUID = /^[0-9a-f-]{36}$/i;

/** Afegeix un atribut a un client des de la pestanya Atributs de la seva fitxa. */
export async function afegeixAtributAccio(_previ: EstatAtribut, dades: FormData): Promise<EstatAtribut> {
  const client = String(dades.get("client") ?? "");
  const text = netejaAtribut(dades.get("text"));
  if (!UUID.test(client)) return { error: "No se sap de quin client és." };
  if (!text) return { error: "Escriu l'atribut." };

  try {
    const afegits = await afegeixAtributs(client, [text], { comercial: (await abastDeLaSessio()).jo });
    revalidatePath("/crm", "layout");
    return afegits === 0 ? { error: "Aquest client ja té aquest atribut." } : { fet: `«${text}» afegit.` };
  } catch (error) {
    return { error: `No s'ha pogut afegir: ${(error as Error).message}` };
  }
}

/** Treu un atribut d'un client. */
export async function esborraAtributAccio(id: string): Promise<EstatAtribut> {
  if (!UUID.test(id)) return { error: "No se sap quin atribut es treu." };
  try {
    await esborraAtribut(id);
    revalidatePath("/crm", "layout");
    return {};
  } catch (error) {
    return { error: `No s'ha pogut treure: ${(error as Error).message}` };
  }
}
