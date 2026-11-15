/**
 * Treu de `crm_proveidors` els que no són cellers homologats.
 *
 * La sincronització només porta els proveïdors amb `HOMPRO = 1` («Proveedor
 * homologado» d'Otros datos a FactuSol). Aquest script neteja el que hi hagi
 * quedat d'abans d'aquell filtre: la primera passada va portar els 651
 * proveïdors de F_PRO i només 34 hi han de ser.
 *
 * Prudent per defecte: sense `ESBORRA=1` només diu què faria. I no toca mai
 *   - les fitxes que no vénen de FactuSol (`font` diferent de «factusol»),
 *   - les que tenen notes escrites al portal o a Directus,
 *   - cap celler homologat.
 *
 *   DIRECTUS_URL=... DIRECTUS_TOKEN=... \
 *   api_fabricante=... api_cliente=... api_db=... api_password=... \
 *     node scripts/crm-proveidors-neteja.mjs           # passada en sec
 *     ESBORRA=1 node scripts/crm-proveidors-neteja.mjs # esborra de debò
 *
 * Amb el fitxer .env.local carregat a l'entorn ja hi ha tot el que li cal.
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI = process.env.DIRECTUS_TOKEN ?? "";

if (!URL_BASE || !TESTIMONI) {
  console.error("Cal DIRECTUS_URL i DIRECTUS_TOKEN.");
  process.exit(1);
}

// ------------------------------------------------------------------ FactuSol
const URL_API = (process.env.api_url ?? "https://api.sdelsol.com").replace(/\/+$/, "");
const EXERCICI = (() => {
  const valor = (process.env.api_ejercicio ?? "").trim();
  return !valor || valor.toLowerCase() === "<year>" ? String(new Date().getFullYear()) : valor;
})();

async function codisHomologats() {
  const entrada = await fetch(`${URL_API}/login/Autenticar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codigoFabricante: Number(process.env.api_fabricante),
      codigoCliente: Number(process.env.api_cliente),
      baseDatosCliente: (process.env.api_db ?? "").trim(),
      password: Buffer.from(process.env.api_password ?? "", "utf8").toString("base64"),
    }),
  });
  const sessio = await entrada.json();
  if (sessio.respuesta !== "OK") throw new Error(`FactuSol no autentica: ${sessio.respuesta}`);

  const resposta = await fetch(`${URL_API}/admin/LanzarConsulta`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessio.resultado}` },
    body: JSON.stringify({ ejercicio: EXERCICI, consulta: "SELECT CODPRO FROM F_PRO WHERE HOMPRO = 1" }),
  });
  const dades = await resposta.json();
  if (dades.respuesta !== "OK") throw new Error(`LanzarConsulta: ${dades.respuesta}`);
  // Cada fila arriba com un array de parells {columna, dato}.
  return new Set((dades.resultado ?? []).map((fila) => Number(fila[0].dato)));
}

// ------------------------------------------------------------------ Directus
async function api(ruta, opcions = {}) {
  const resposta = await fetch(`${URL_BASE}${ruta}`, {
    ...opcions,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TESTIMONI}`, ...opcions.headers },
  });
  if (resposta.status === 204) return {};
  const cos = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`${ruta} → ${cos?.errors?.[0]?.message ?? resposta.status}`);
  return cos;
}

const homologats = await codisHomologats();
if (homologats.size === 0) {
  console.error("FactuSol no retorna cap proveïdor homologat: no es toca res.");
  process.exit(1);
}
console.log(`homologats a FactuSol: ${homologats.size}`);

const { data } = await api("/items/crm_proveidors?limit=-1&fields=id,codi_erp,font,nom_comercial,notes");
console.log(`fitxes a Directus:     ${data.length}`);

const esHomologat = (fitxa) => homologats.has(Number(fitxa.codi_erp));
const fora = data.filter((fitxa) => fitxa.font === "factusol" && !esHomologat(fitxa) && !fitxa.notes);
const intactes = data.filter((fitxa) => !esHomologat(fitxa) && !fora.includes(fitxa));

console.log(`es queden (homologats): ${data.filter(esHomologat).length}`);
console.log(`per esborrar:           ${fora.length}`);
if (intactes.length > 0) {
  console.log(`no es toquen (del portal o amb notes): ${intactes.length}`);
  for (const fitxa of intactes) console.log(`   · ${fitxa.nom_comercial}`);
}

if (process.env.ESBORRA !== "1") {
  console.log("\nPassada en sec. Torna-hi amb ESBORRA=1 per esborrar-los.");
  process.exit(0);
}

for (let i = 0; i < fora.length; i += 100) {
  const lot = fora.slice(i, i + 100).map((fitxa) => fitxa.id);
  await api("/items/crm_proveidors", { method: "DELETE", body: JSON.stringify(lot) });
  console.log(`  esborrats ${Math.min(i + 100, fora.length)}/${fora.length}`);
}

const { data: queden } = await api("/items/crm_proveidors?limit=-1&fields=id");
console.log(`\n✓ Queden ${queden.length} cellers a Directus.`);
