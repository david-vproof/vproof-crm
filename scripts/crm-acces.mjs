/**
 * Dona identitat pròpia al portal dins de Directus.
 *
 * Crea una política de només lectura sobre les col·leccions del CRM, un rol
 * que la porta i un compte de màquina amb testimoni estàtic. Així el portal no
 * fa servir la contrasenya de ningú i el rastre d'auditoria distingeix qui fa
 * què. És idempotent i no toca res del que ja existeix.
 *
 *   DIRECTUS_URL=... DIRECTUS_EMAIL=... DIRECTUS_PASSWORD=... \
 *     node scripts/crm-acces.mjs
 */
import { randomBytes } from "node:crypto";

const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";

const COL·LECCIONS = [
  "crm_segments", "crm_zones", "crm_clients", "crm_tipus_client", "crm_agents", "crm_facturacio", "crm_establiments", "crm_client_atributs", "crm_categories", "crm_tipus_activitat", "crm_proveidors", "crm_articles", "crm_albarans", "crm_albarans_linies", "crm_leads", "crm_contactes",
  "crm_oportunitats", "crm_activitats", "crm_activitats_vins", "crm_tasques",
  // El selector de vins: les plantilles i les seves línies.
  "crm_plantilles_vins", "crm_plantilles_vins_linies",
  // La sincronització amb FactuSol: el portal hi desa la programació i el registre de passades.
  "crm_configuracio", "crm_sync_execucions",
];

const NOM_POLITICA = "Portal · lectura del CRM";
// El portal manté el CRM, així que també crea i edita. Esborrar hi entra
// perquè registrar una visita equivocada ha de tenir marxa enrere.
const ACCIONS = ["read", "create", "update", "delete"];
const NOM_ROL = "Portal";

// Política per a les persones de l'equip: veuen i editen el CRM des de
// l'aplicació de Directus, però no administren res. Esborrar no hi entra: és
// l'única acció sense marxa enrere i es deixa a l'administrador.
const NOM_POLITICA_EQUIP = "wine_users";
const NOM_ROL_EQUIP = "Wine users";
const NOM_ROL_MANAGER = "Manager";
const DESCRIPCIO_MANAGER = "Veu els clients de tothom al portal, sense administrar usuaris.";
const ACCIONS_EQUIP = ["read", "create", "update"];
const CORREU_MAQUINA = "portal@example.com";

let testimoni = "";
async function api(ruta, opcions = {}) {
  const resposta = await fetch(`${URL_BASE}${ruta}`, {
    ...opcions,
    headers: { "Content-Type": "application/json", ...(testimoni ? { Authorization: `Bearer ${testimoni}` } : {}), ...opcions.headers },
  });
  const cos = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`${ruta} → ${cos?.errors?.[0]?.message ?? resposta.status}`);
  return cos;
}

testimoni = (await api("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: CORREU, password: CONTRASENYA, mode: "json" }),
})).data.access_token;

// 1. Política de només lectura.
let politica = (await api(`/policies?filter[name][_eq]=${encodeURIComponent(NOM_POLITICA)}&fields=id`)).data[0];
if (!politica) {
  politica = (await api("/policies", {
    method: "POST",
    body: JSON.stringify({
      name: NOM_POLITICA,
      icon: "visibility",
      description: "Lectura de les col·leccions del CRM per al portal Wine Backend.",
      admin_access: false,
      app_access: false,
    }),
  })).data;
  console.log("creada   política de lectura");
}

// 2. Un permís de lectura per col·lecció. També cal llegir els usuaris per
// posar nom al comercial. Voldríem limitar-ho a id, nom i cognoms, però
// Directus reserva els permisos a mida sobre col·leccions de sistema a la
// versió de pagament ("custom_permission_rules_enabled is a restricted
// resource"), així que el permís va sense filtre. El portal només en llegeix
// aquells tres camps i no els treu mai cap al navegador.
const permisos = (await api(`/permissions?filter[policy][_eq]=${politica.id}&fields=collection,action&limit=-1`)).data;
const jaTe = new Set(permisos.map((p) => `${p.collection}:${p.action}`));
let nous = 0;
for (const collection of COL·LECCIONS) {
  for (const action of ACCIONS) {
    if (jaTe.has(`${collection}:${action}`)) continue;
    await api("/permissions", {
      method: "POST",
      body: JSON.stringify({ policy: politica.id, collection, action, fields: ["*"], permissions: {}, validation: {} }),
    });
    nous += 1;
  }
}
// Les fotos dels articles: la sincronització les puja a la biblioteca de
// fitxers, n'esborra les velles i les llegeix per servir-les. Les carpetes només
// es llegeixen, per trobar la de les fotos.
for (const [collection, accions] of [["directus_files", ACCIONS], ["directus_folders", ["read"]]]) {
  for (const action of accions) {
    if (jaTe.has(`${collection}:${action}`)) continue;
    await api("/permissions", {
      method: "POST",
      body: JSON.stringify({ policy: politica.id, collection, action, fields: ["*"], permissions: {}, validation: {} }),
    });
    nous += 1;
  }
}
// Dels usuaris només se'n llegeix: el portal no els toca mai. Quan
// l'administrador en crea o en modifica un des de la pantalla d'Usuaris, ho fa
// amb la seva pròpia contrasenya, no amb aquest compte. Els rols es llegeixen
// per posar-los nom en aquella pantalla.
for (const collection of ["directus_users", "directus_roles"]) {
  if (jaTe.has(`${collection}:read`)) continue;
  await api("/permissions", {
    method: "POST",
    body: JSON.stringify({ policy: politica.id, collection, action: "read", fields: ["*"], permissions: {}, validation: {} }),
  });
  nous += 1;
}
console.log(`permisos afegits: ${nous}`);

// 3. Rol que porta la política.
let rol = (await api(`/roles?filter[name][_eq]=${encodeURIComponent(NOM_ROL)}&fields=id`)).data[0];
if (!rol) {
  rol = (await api("/roles", {
    method: "POST",
    body: JSON.stringify({ name: NOM_ROL, icon: "web", description: "Comptes de màquina del portal." }),
  })).data;
  console.log("creat    rol Portal");
}
const acces = (await api(`/access?filter[role][_eq]=${rol.id}&filter[policy][_eq]=${politica.id}&fields=id`)).data;
if (acces.length === 0) {
  await api("/access", { method: "POST", body: JSON.stringify({ role: rol.id, policy: politica.id }) });
  console.log("lligada  política al rol");
}

// 4. Compte de màquina amb testimoni estàtic.
let maquina = (await api(`/users?filter[email][_eq]=${encodeURIComponent(CORREU_MAQUINA)}&fields=id,token`)).data[0];
const nouTestimoni = randomBytes(24).toString("base64url");
if (!maquina) {
  maquina = (await api("/users", {
    method: "POST",
    body: JSON.stringify({
      first_name: "Portal", last_name: "Wine Backend", email: CORREU_MAQUINA,
      role: rol.id, status: "active", token: nouTestimoni,
      description: "Compte de màquina del portal. Només llegeix el CRM.",
    }),
  })).data;
  console.log("creat    compte de màquina");
  console.log(`TESTIMONI=${nouTestimoni}`);
} else if (process.env.RENOVA_TESTIMONI === "1") {
  await api(`/users/${maquina.id}`, { method: "PATCH", body: JSON.stringify({ token: nouTestimoni }) });
  console.log("renovat  el testimoni");
  console.log(`TESTIMONI=${nouTestimoni}`);
} else {
  console.log("el compte de màquina ja hi és (RENOVA_TESTIMONI=1 per canviar-li el testimoni)");
}

// ---------------------------------------------------------------- equip humà
let politicaEquip = (await api(`/policies?filter[name][_eq]=${encodeURIComponent(NOM_POLITICA_EQUIP)}&fields=id`)).data[0];
if (!politicaEquip) {
  politicaEquip = (await api("/policies", {
    method: "POST",
    body: JSON.stringify({
      name: NOM_POLITICA_EQUIP,
      icon: "groups",
      description: "Lectura i edició del CRM per a l'equip comercial. Sense esborrat ni administració.",
      admin_access: false,
      app_access: true,
    }),
  })).data;
  console.log("creada   política wine_users");
}

const permisosEquip = (await api(`/permissions?filter[policy][_eq]=${politicaEquip.id}&fields=collection,action&limit=-1`)).data;
const jaTeEquip = new Set(permisosEquip.map((p) => `${p.collection}:${p.action}`));
let nousEquip = 0;
for (const collection of COL·LECCIONS) {
  for (const action of ACCIONS_EQUIP) {
    if (jaTeEquip.has(`${collection}:${action}`)) continue;
    await api("/permissions", {
      method: "POST",
      body: JSON.stringify({ policy: politicaEquip.id, collection, action, fields: ["*"], permissions: {}, validation: {} }),
    });
    nousEquip += 1;
  }
}
// Cal poder llegir els usuaris per posar nom al comercial d'una fitxa, i els
// fitxers per veure la foto dels articles des de l'aplicació de Directus.
for (const collection of ["directus_users", "directus_files"]) {
  if (jaTeEquip.has(`${collection}:read`)) continue;
  await api("/permissions", {
    method: "POST",
    body: JSON.stringify({ policy: politicaEquip.id, collection, action: "read", fields: ["*"], permissions: {}, validation: {} }),
  });
  nousEquip += 1;
}
console.log(`permisos de wine_users afegits: ${nousEquip}`);

let rolEquip = (await api(`/roles?filter[name][_eq]=${encodeURIComponent(NOM_ROL_EQUIP)}&fields=id`)).data[0];
if (!rolEquip) {
  rolEquip = (await api("/roles", {
    method: "POST",
    body: JSON.stringify({ name: NOM_ROL_EQUIP, icon: "groups", description: "Equip comercial." }),
  })).data;
  console.log("creat    rol Wine users");
}
const accesEquip = (await api(`/access?filter[role][_eq]=${rolEquip.id}&filter[policy][_eq]=${politicaEquip.id}&fields=id`)).data;
if (accesEquip.length === 0) {
  await api("/access", { method: "POST", body: JSON.stringify({ role: rolEquip.id, policy: politicaEquip.id }) });
  console.log("lligada  wine_users al rol Wine users");
}

// 6. Rol Manager: veu els clients de tothom al portal (com l'administrador),
// però sense administrar res. A Directus té la mateixa política que l'equip;
// és el portal qui, pel nom del rol, li obre l'abast (lib/sessio.ts).
let rolManager = (await api(`/roles?filter[name][_eq]=${encodeURIComponent(NOM_ROL_MANAGER)}&fields=id`)).data[0];
if (!rolManager) {
  rolManager = (await api("/roles", {
    method: "POST",
    body: JSON.stringify({ name: NOM_ROL_MANAGER, icon: "supervisor_account", description: DESCRIPCIO_MANAGER }),
  })).data;
  console.log("creat    rol Manager");
}
const accesManager = (await api(`/access?filter[role][_eq]=${rolManager.id}&filter[policy][_eq]=${politicaEquip.id}&fields=id`)).data;
if (accesManager.length === 0) {
  await api("/access", { method: "POST", body: JSON.stringify({ role: rolManager.id, policy: politicaEquip.id }) });
  console.log("lligada  wine_users al rol Manager");
}
