"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ROL_MANAGER_NOU } from "@/domini/rols";
import { esAdministrador } from "@/lib/sessio";
import { sessioActual } from "@/lib/sessio-actual";
import { ErrorUsuaris, creaRolManager, creaUsuariDelPortal, desaUsuariDelPortal, usuarisDelPortal } from "@/serveis/usuaris";

export type EstatFormulariUsuari = { error?: string };

const CORREU_VALID = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Crea o desa un usuari. La comprovació de rol d'aquí és la primera porta; la
 * darrera és Directus, que rep el canvi amb les credencials de l'administrador.
 */
export async function desaUsuariAccio(_previ: EstatFormulariUsuari, dades: FormData): Promise<EstatFormulariUsuari> {
  const sessio = await sessioActual();
  if (!sessio) redirect("/login?des=%2Fusuaris");
  if (!esAdministrador(sessio)) return { error: "Només un administrador pot gestionar els usuaris." };

  const id = String(dades.get("id") ?? "").trim();
  const nom = String(dades.get("nom") ?? "").trim();
  const cognoms = String(dades.get("cognoms") ?? "").trim();
  const correu = String(dades.get("correu") ?? "").trim().toLowerCase();
  const telefon = String(dades.get("telefon") ?? "").trim();
  const rol = String(dades.get("rol") ?? "").trim();
  const agent = String(dades.get("agent") ?? "").trim() || null;
  const estat = String(dades.get("estat") ?? "");
  const contrasenya = String(dades.get("contrasenya") ?? "");
  const repetida = String(dades.get("contrasenya_repetida") ?? "");
  const contrasenyaAdmin = String(dades.get("contrasenya_admin") ?? "");

  // El propi compte s'edita des d'«El meu compte»: allà la sessió s'actualitza
  // amb el nom i el correu nous, i un administrador no es pot suspendre a si mateix.
  if (id && id === sessio.id) return { error: "El teu compte s'edita des d'«El meu compte»." };

  if (!nom) return { error: "Cal omplir el nom." };
  if (!CORREU_VALID.test(correu)) return { error: "El correu no té un format vàlid." };
  if (!rol) return { error: "Cal triar un rol." };
  if (!id && !contrasenya) return { error: "Cal una contrasenya inicial per al compte nou." };
  if (contrasenya && contrasenya.length < 8) return { error: "La contrasenya ha de tenir 8 caràcters com a mínim." };
  if (contrasenya !== repetida) return { error: "Les dues contrasenyes no coincideixen." };
  if (id && estat !== "actiu" && estat !== "suspes") return { error: "L'estat no és vàlid." };
  if (!contrasenyaAdmin) return { error: "Per desar els canvis cal la teva contrasenya." };

  // Un agent és una sola persona: si ja el té un altre compte, es diu qui abans que res.
  if (agent) {
    try {
      const { usuaris, agents } = await usuarisDelPortal();
      if (!agents.some((a) => a.id === agent)) return { error: "Aquest agent comercial ja no existeix." };
      const altre = usuaris.find((u) => u.agent?.id === agent && u.id !== id);
      if (altre) {
        return { error: `L'agent ${altre.agent?.nom} ja està lligat a ${`${altre.nom} ${altre.cognoms}`.trim() || altre.correu}.` };
      }
    } catch (error) {
      if (error instanceof ErrorUsuaris) return { error: error.message };
      throw error;
    }
  }

  const admin = { correu: sessio.usuari, contrasenya: contrasenyaAdmin };

  // El rol Manager es pot triar encara que a Directus no existeixi: es crea en aquest mateix desar.
  let idRol = rol;
  if (rol === ROL_MANAGER_NOU) {
    try {
      const creat = await creaRolManager(admin);
      if (!creat.id) return { error: "Directus no ha tornat l'id del rol Manager creat." };
      idRol = creat.id;
    } catch (error) {
      if (error instanceof ErrorUsuaris) return { error: error.message };
      throw error;
    }
  }
  const usuari = { nom, cognoms, correu, telefon, rol: idRol, agent, contrasenya: contrasenya || undefined };

  try {
    if (id) {
      await desaUsuariDelPortal(admin, id, { ...usuari, estat: estat as "actiu" | "suspes" });
    } else {
      await creaUsuariDelPortal(admin, usuari);
    }
  } catch (error) {
    if (error instanceof ErrorUsuaris) return { error: error.message };
    throw error;
  }

  revalidatePath("/usuaris");
  redirect(`/usuaris?fet=${id ? "desat" : "creat"}`);
}

/** Crea el rol Manager a Directus en nom de l'administrador, amb la seva contrasenya. */
export async function creaRolManagerAccio(_previ: EstatFormulariUsuari, dades: FormData): Promise<EstatFormulariUsuari> {
  const sessio = await sessioActual();
  if (!sessio) redirect("/login?des=%2Fusuaris");
  if (!esAdministrador(sessio)) return { error: "Només un administrador pot crear rols." };

  const contrasenyaAdmin = String(dades.get("contrasenya_admin") ?? "");
  if (!contrasenyaAdmin) return { error: "Per crear el rol cal la teva contrasenya." };

  let resultat: { ambPolitica: boolean };
  try {
    resultat = await creaRolManager({ correu: sessio.usuari, contrasenya: contrasenyaAdmin });
  } catch (error) {
    if (error instanceof ErrorUsuaris) return { error: error.message };
    throw error;
  }

  revalidatePath("/usuaris");
  redirect(`/usuaris?fet=${resultat.ambPolitica ? "rol" : "rol_sense_politica"}`);
}
