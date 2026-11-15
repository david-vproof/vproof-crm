/**
 * L'estat i el tipus de client dels comptes passen a ser els de FactuSol.
 *
 * - L'estat és el desplegable «Estado» de la fitxa de client (ESTCLI).
 * - El tipus de client (TCLCLI) apunta a la taula F_TCL, que al CRM és
 *   `crm_tipus_client`. El camp de text `canal` de comptes, leads i
 *   oportunitats queda substituït per la relació `tipus_client`.
 *
 * Va després de `crm-directus.mjs`, de `crm-acces.mjs` i d'una passada de
 * clients des de Configuració, que és la que omple `crm_tipus_client`. Fa:
 *
 *   1. canvia les opcions de `crm_clients.estat` per les de FactuSol,
 *   2. passa l'estat dels comptes al nou vocabulari: els de FactuSol a partir
 *      d'`erp_estat`, i els del portal traduint el valor vell,
 *   3. passa el `canal` vell dels comptes del portal, dels leads i de les
 *      oportunitats a `tipus_client`,
 *   4. esborra el camp `canal` de cada col·lecció on ja no quedi res per passar.
 *
 * És idempotent. Si queda algun canal que no sap a quin tipus va, no esborra
 * aquell camp i ho diu.
 *
 *   DIRECTUS_URL=... DIRECTUS_EMAIL=... DIRECTUS_PASSWORD=... \
 *     node scripts/crm-estat-tipus-client-erp.mjs
 *
 * També accepta DIRECTUS_TOKEN, però ha de ser d'un compte administrador: el
 * testimoni del portal no pot tocar l'esquema.
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI_ESTATIC = process.env.DIRECTUS_TOKEN ?? "";
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";

if (!URL_BASE || (!TESTIMONI_ESTATIC && !(CORREU && CONTRASENYA))) {
  console.error("Cal DIRECTUS_URL i, o bé DIRECTUS_TOKEN, o bé DIRECTUS_EMAIL amb DIRECTUS_PASSWORD.");
  process.exit(1);
}

const VERD = "#2ECDA7", BLAU = "#3399FF", GROC = "#FFC23B", VERMELL = "#E35169", GRIS = "#A2B5CD";

/** Igual que `ESTATS_CLIENT` a domini/factusol-vocabulari.ts: la posició és l'ESTCLI. */
const ESTAT_CLIENT = [
  { text: "Sense seleccionar", value: "sense_seleccionar", color: GRIS },
  { text: "Habitual", value: "habitual", color: VERD },
  { text: "Esporàdic", value: "esporadic", color: GROC },
  { text: "Baixa", value: "baixa", color: VERMELL },
  { text: "Captació", value: "captacio", color: BLAU },
];

/** Els estats vells, per als comptes creats al portal, que no tenen ESTCLI. */
const ESTAT_VELL = { actiu: "habitual", potencial: "captacio", inactiu: "esporadic", baixa: "baixa" };

/** Els canals vells cap al tipus de client de F_TCL que hi correspon. */
const CANAL_VELL = {
  "Restauració": "RESTAURANTE",
  "Hotel": "RESTAURANTE",
  "Distribució": "DISTRIBUIDOR",
  "Exportació": "DISTRIBUIDOR",
  "Vinoteca": "TIENDA ESPECIALIZADA",
  "Botiga especialitzada": "TIENDA ESPECIALIZADA",
};

let testimoni = "";

async function api(ruta, opcions = {}) {
  const resposta = await fetch(`${URL_BASE}${ruta}`, {
    ...opcions,
    headers: {
      "Content-Type": "application/json",
      ...(testimoni ? { Authorization: `Bearer ${testimoni}` } : {}),
      ...opcions.headers,
    },
  });
  if (resposta.status === 204) return {};
  const cos = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const error = new Error(cos?.errors?.[0]?.message ?? `HTTP ${resposta.status}`);
    error.estat = resposta.status;
    throw error;
  }
  return cos;
}

async function entra() {
  if (TESTIMONI_ESTATIC) {
    testimoni = TESTIMONI_ESTATIC;
    return;
  }
  const { data } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: CORREU, password: CONTRASENYA, mode: "json" }),
  });
  testimoni = data.access_token;
}

/** Null si el camp no existeix. */
async function camp(colleccio, nom) {
  try {
    return (await api(`/fields/${colleccio}/${nom}`)).data;
  } catch (error) {
    if (error.estat === 403 || error.estat === 404) return null;
    throw error;
  }
}

async function totes(colleccio, camps) {
  const { data } = await api(`/items/${colleccio}?fields=${camps.join(",")}&limit=-1`);
  return data;
}

/** Agrupa per valor nou i escriu d'un cop cada grup. */
async function escriu(colleccio, canvis) {
  const perValor = new Map();
  for (const { id, dades } of canvis) {
    const clau = JSON.stringify(dades);
    perValor.set(clau, [...(perValor.get(clau) ?? []), id]);
  }
  for (const [clau, ids] of perValor) {
    for (let i = 0; i < ids.length; i += 100) {
      await api(`/items/${colleccio}`, { method: "PATCH", body: JSON.stringify({ keys: ids.slice(i, i + 100), data: JSON.parse(clau) }) });
    }
    console.log(`${String(ids.length).padStart(5)} ${colleccio} ← ${clau}`);
  }
}

const etiquetes = (valors) =>
  valors.map(({ text, value, color }) => ({ text, value, foreground: "#FFFFFF", background: color }));

await entra();

if (!(await camp("crm_clients", "tipus_client"))) {
  console.error("Falta crm_clients.tipus_client: executa abans scripts/crm-directus.mjs.");
  process.exit(1);
}
const tipus = await totes("crm_tipus_client", ["id", "nom"]);
if (tipus.length === 0) {
  console.error("crm_tipus_client és buida: fes abans una passada de clients des de Configuració.");
  process.exit(1);
}
const idTipus = new Map(tipus.map((fila) => [fila.nom, fila.id]));
const tipusDeCanal = (canal) => idTipus.get(CANAL_VELL[canal] ?? canal) ?? null;

// 1. Les opcions de l'estat.
const estat = await camp("crm_clients", "estat");
await api("/fields/crm_clients/estat", {
  method: "PATCH",
  body: JSON.stringify({
    meta: {
      options: { ...(estat?.meta?.options ?? {}), choices: ESTAT_CLIENT.map(({ text, value }) => ({ text, value })), allowOther: false },
      display: "labels",
      display_options: { choices: etiquetes(ESTAT_CLIENT), showAsDot: false },
      note: "ESTCLI de FactuSol.",
    },
    schema: { default_value: "sense_seleccionar" },
  }),
});
console.log("opcions  crm_clients.estat");

// 2. L'estat de cada compte.
const clients = await totes("crm_clients", ["id", "font", "estat", "erp_estat"]);
const canvisEstat = [];
const estatsDesconeguts = new Set();
for (const client of clients) {
  const nou =
    client.font === "factusol"
      ? (ESTAT_CLIENT[Number(client.erp_estat)] ?? ESTAT_CLIENT[0]).value
      : ESTAT_CLIENT.some((e) => e.value === client.estat) || !client.estat
        ? client.estat
        : ESTAT_VELL[client.estat];
  if (nou === undefined) estatsDesconeguts.add(client.estat);
  else if (nou !== client.estat) canvisEstat.push({ id: client.id, dades: { estat: nou } });
}
await escriu("crm_clients", canvisEstat);
if (estatsDesconeguts.size > 0) console.log(`Estats sense traduir: ${[...estatsDesconeguts].map((e) => `«${e}»`).join(", ")}`);

// 3 i 4. Del canal de text a la relació, i fora el camp vell.
for (const colleccio of ["crm_clients", "crm_leads", "crm_oportunitats"]) {
  if (!(await camp(colleccio, "canal"))) {
    console.log(`ja no hi és ${colleccio}.canal`);
    continue;
  }
  const files = await totes(colleccio, ["id", "canal", "tipus_client"]);
  const canvis = [];
  const perduts = new Set();
  for (const fila of files) {
    if (!fila.canal || fila.tipus_client) continue;
    const id = tipusDeCanal(fila.canal);
    if (id) canvis.push({ id: fila.id, dades: { tipus_client: id } });
    else perduts.add(fila.canal);
  }
  await escriu(colleccio, canvis);
  if (perduts.size > 0) {
    console.log(`es queda ${colleccio}.canal: no sé a quin tipus van ${[...perduts].map((c) => `«${c}»`).join(", ")}`);
    continue;
  }
  await api(`/fields/${colleccio}/canal`, { method: "DELETE" });
  console.log(`esborrat ${colleccio}.canal`);
}

console.log("\n✓ Fet.");
