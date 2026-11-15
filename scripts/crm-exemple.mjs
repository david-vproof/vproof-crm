/**
 * Dades d'exemple per al CRM, per poder veure els taulers amb contingut.
 *
 * Tot el que crea porta la marca «[exemple]» a les notes, així que es pot
 * treure sense tocar res del que hagis entrat tu:
 *
 *   NETEJA=1 DIRECTUS_URL=... DIRECTUS_TOKEN=... node scripts/crm-exemple.mjs
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";
const MARCA = "[exemple]";

let t = process.env.DIRECTUS_TOKEN ?? "";
const api = async (ruta, opcions = {}) => {
  const r = await fetch(URL_BASE + ruta, {
    ...opcions,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...opcions.headers },
  });
  const c = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${ruta} → ${c?.errors?.[0]?.message ?? r.status}`);
  return c;
};

if (!t) {
  t = (await api("/auth/login", { method: "POST", body: JSON.stringify({ email: CORREU, password: CONTRASENYA, mode: "json" }) })).data.access_token;
}

const COL·LECCIONS = ["crm_tasques", "crm_activitats", "crm_oportunitats", "crm_contactes", "crm_leads", "crm_clients"];

if (process.env.NETEJA === "1") {
  for (const c of COL·LECCIONS) {
    const camp = c === "crm_activitats" ? "resum" : c === "crm_tasques" ? "descripcio" : "notes";
    const { data } = await api(`/items/${c}?limit=-1&fields=id&filter[${camp}][_contains]=${encodeURIComponent(MARCA)}`);
    for (const fila of data) await api(`/items/${c}/${fila.id}`, { method: "DELETE" });
    console.log(`${c}: ${data.length} esborrats`);
  }
  process.exit(0);
}

const jo = (await api("/users/me?fields=id")).data.id;
const dies = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const dia = (n) => dies(n).slice(0, 10);
const crea = async (c, cos) => (await api(`/items/${c}`, { method: "POST", body: JSON.stringify(cos) })).data;

// --- cellers -----------------------------------------------------------------
// Ja no se'n creen: els cellers són els proveïdors que porta la sincronització
// de FactuSol. Les activitats amb vi d'aquest exemple n'agafen dels que hi ha,
// i si encara no s'ha sincronitzat res, es queden sense.
const cellers = {};
{
  const { data } = await api("/items/crm_proveidors?limit=4&fields=id,nom_comercial&sort=nom_comercial&filter[tipus][_eq]=proveidor");
  for (const [i, fila] of (data ?? []).entries()) cellers[`celler${i + 1}`] = fila;
}
const unCeller = (n) => cellers[`celler${n}`]?.id ?? null;

// El tipus de client ve de FactuSol (crm_tipus_client): se n'agafa pel nom, si ja
// s'ha sincronitzat.
const tipus = {};
{
  const { data } = await api("/items/crm_tipus_client?limit=-1&fields=id,nom");
  for (const fila of data ?? []) tipus[fila.nom] = fila.id;
}
const unTipus = (nom) => tipus[nom] ?? null;

// --- clients -----------------------------------------------------------------
const clients = {};
for (const [nom, canal, poblacio, forma, potencial, provincia, pais] of [
  ["Restaurant Cal Sadurní", "RESTAURANTE", "Begues", "Transferència 30 dies", "B", "Barcelona", "Espanya"],
  ["Hotel Mas de la Sal", "RESTAURANTE", "Sitges", "Confirming 90 dies", "A", "Barcelona", "Espanya"],
  ["Vinoteca El Celleret", "TIENDA ESPECIALIZADA", "Vic", "Comptat", "C", "Barcelona", "Espanya"],
  ["Distribucions Vall del Ter", "DISTRIBUIDOR", "Girona", "Rebut domiciliat 60 dies", "A", "Girona", "Espanya"],
  // No és a Barcelona: si el país no quadra, el mapa el situaria en un altre continent.
  ["Nordic Wine Import", "DISTRIBUIDOR", "Copenhaguen", "Transferència 30 dies", "D", "", "Dinamarca"],
  ["La Botiga del Vi", "TIENDA ESPECIALIZADA", "Manresa", "Targeta", "E", "Barcelona", "Espanya"],
]) {
  clients[nom] = await crea("crm_clients", {
    nom_comercial: nom, tipus_client: unTipus(canal), poblacio, provincia, pais,
    forma_pagament: forma, estat: "habitual", potencial, comercial: jo, data_alta: dia(400),
    notes: `${MARCA} client de mostra`,
  });
}

// --- leads -------------------------------------------------------------------
const leads = {};
for (const [nom, origen, estat, valor, poblacio] of [
  ["Bistrot La Gavina", "Fira", "qualificat", 14000, "Palamós"],
  ["Grup Gastronòmic Bruc", "Recomanació", "contactat", 32000, "Barcelona"],
  ["Wine Bar Copa Alta", "Web", "nou", 9000, "Tarragona"],
  ["Rheinland Weinkontor", "Prospecció", "descartat", 45000, "Colònia"],
]) {
  leads[nom] = await crea("crm_leads", {
    nom, origen, estat, valor_estimat: valor, poblacio, tipus_client: unTipus("RESTAURANTE"),
    comercial: jo, data_alta: dia(120), notes: `${MARCA} lead de mostra`,
    ...(estat === "descartat" ? { motiu_descart: "Ja té proveïdor exclusiu" } : {}),
  });
}

// --- contactes ---------------------------------------------------------------
const contactes = {};
for (const [nom, cognoms, carrec, client] of [
  ["Anna", "Roig", "Sommelier", "Restaurant Cal Sadurní"],
  ["Marc", "Puigdemunt", "Cap de compres", "Hotel Mas de la Sal"],
  ["Laia", "Bosch", "Propietària", "Vinoteca El Celleret"],
]) {
  contactes[client] = await crea("crm_contactes", {
    nom, cognoms, carrec, client: clients[client].id, principal: true,
    correu: `${nom.toLowerCase()}@exemple.com`, notes: `${MARCA} contacte de mostra`,
  });
}

// --- oportunitats ------------------------------------------------------------
const oportunitats = {};
for (const [titol, compte, esLead, etapa, valor, obertaFa, assolida] of [
  ["Carta de vins 2027", "Restaurant Cal Sadurní", false, "proposta", 18500, 65, 4],
  ["Ampliació gamma escumosos", "Hotel Mas de la Sal", false, "negociacio", 26000, 90, 5],
  ["Renovació de carta de negres", "Vinoteca El Celleret", false, "guanyada", 12400, 150, 5],
  ["Acord anual de volum", "Distribucions Vall del Ter", false, "guanyada", 54000, 210, 5],
  ["Entrada gamma taronja", "La Botiga del Vi", false, "perduda", 8200, 180, 2],
  ["Primera comanda de prova", "Bistrot La Gavina", true, "tast", 14000, 40, 3],
  ["Acord de distribució", "Grup Gastronòmic Bruc", true, "qualificada", 32000, 25, 2],
  ["Exportació a Dinamarca", "Nordic Wine Import", false, "contacte", 41000, 12, 1],
]) {
  const tancada = etapa === "guanyada" || etapa === "perduda";
  oportunitats[titol] = await crea("crm_oportunitats", {
    titol, etapa, valor, etapa_assolida: assolida,
    [esLead ? "lead" : "client"]: (esLead ? leads : clients)[compte].id,
    tipus_client: unTipus(esLead ? "RESTAURANTE" : "DISTRIBUIDOR"),
    comercial: jo, data_obertura: dia(obertaFa),
    tancament_previst: dia(obertaFa - 60), ...(tancada ? { data_tancament: dia(obertaFa - 30) } : {}),
    ...(etapa === "perduda" ? { motiu_perdua: "Preu" } : {}),
    notes: `${MARCA} oportunitat de mostra`,
  });
}

// --- activitats ---------------------------------------------------------------
const guio = [
  ["visita_celler", "Visita al celler amb el sommelier", "Restaurant Cal Sadurní", 1, "Carta de vins 2027", 8, 6, 320],
  ["visita_amb_vi", "Presentació de la nova anyada", "Restaurant Cal Sadurní", 1, "Carta de vins 2027", 22, null, 85],
  ["trucada", "Seguiment de la proposta", "Restaurant Cal Sadurní", null, "Carta de vins 2027", 4, null, null],
  ["visita_celler", "Jornada de portes obertes", "Hotel Mas de la Sal", 2, "Ampliació gamma escumosos", 15, 4, 260],
  ["visita_amb_vi", "Tast de la gamma d'escumosos", "Hotel Mas de la Sal", 2, "Ampliació gamma escumosos", 45, null, 110],
  ["reunio", "Revisió de condicions anuals", "Hotel Mas de la Sal", null, "Ampliació gamma escumosos", 30, null, null],
  ["visita_sense_vi", "Revisió de rotació a la botiga", "La Botiga del Vi", null, "Entrada gamma taronja", 60, null, null],
  ["correu", "Enviament de tarifa actualitzada", "La Botiga del Vi", null, "Entrada gamma taronja", 75, null, null],
  ["visita_amb_vi", "Tast comparatiu de garnatxes", "Vinoteca El Celleret", 4, "Renovació de carta de negres", 120, null, 95],
  ["visita_celler", "Visita del client al celler", "Vinoteca El Celleret", 3, "Renovació de carta de negres", 100, 3, 180],
  ["trucada", "Confirmació de la comanda mensual", "Vinoteca El Celleret", null, null, 10, null, null],
  ["visita_sense_vi", "Visita de seguiment", "Distribucions Vall del Ter", null, "Acord anual de volum", 170, null, null],
  ["reunio", "Tancament de l'acord anual", "Distribucions Vall del Ter", null, "Acord anual de volum", 185, null, null],
  ["correu", "Fitxes tècniques de la gamma blanca", "Nordic Wine Import", null, "Exportació a Dinamarca", 9, null, null],
  ["trucada", "Primer contacte", "Nordic Wine Import", null, "Exportació a Dinamarca", 12, null, null],
];
let nActivitats = 0;
for (const [tipus, assumpte, compte, celler, oport, fa, assistents, cost] of guio) {
  const esClient = Boolean(clients[compte]);
  await crea("crm_activitats", {
    tipus, assumpte, data: dies(fa), comercial: jo,
    [esClient ? "client" : "lead"]: (esClient ? clients : leads)[compte].id,
    ...(celler && unCeller(celler) ? { celler: unCeller(celler) } : {}),
    ...(oport ? { oportunitat: oportunitats[oport].id } : {}),
    ...(assistents ? { assistents } : {}),
    ...(cost ? { cost } : {}),
    ...(["visita_amb_vi", "visita_celler"].includes(tipus) ? { referencies: "Negre criança 2021, Blanc de guarda 2022" } : {}),
    ...(contactes[compte] ? { contacte: contactes[compte].id } : {}),
    durada_minuts: tipus === "trucada" ? 12 : tipus === "correu" ? 5 : 90,
    resultat: "Positiu", resum: `${MARCA} ${assumpte.toLowerCase()}`,
  });
  nActivitats += 1;
}

// --- tasques ------------------------------------------------------------------
for (const [titol, compte, venc, prioritat, estat] of [
  ["Enviar proposta revisada", "Restaurant Cal Sadurní", -5, "alta", "pendent"],
  ["Preparar mostres per al tast", "Hotel Mas de la Sal", -2, "alta", "pendent"],
  ["Trucar per confirmar la visita al celler", "Vinoteca El Celleret", 3, "normal", "pendent"],
  ["Actualitzar fitxa del client", "Distribucions Vall del Ter", 10, "baixa", "feta"],
  ["Enviar catàleg d'exportació", "Nordic Wine Import", -1, "normal", "pendent"],
]) {
  await crea("crm_tasques", {
    titol, venciment: dia(venc), prioritat, estat, responsable: jo,
    client: clients[compte].id, descripcio: `${MARCA} tasca de mostra`,
  });
}

console.log(`✓ Exemple creat: ${Object.keys(clients).length} clients, ${Object.keys(leads).length} leads, ${Object.keys(oportunitats).length} oportunitats, ${nActivitats} activitats i 5 tasques.`);
console.log("  Per treure-ho: NETEJA=1 node scripts/crm-exemple.mjs");
