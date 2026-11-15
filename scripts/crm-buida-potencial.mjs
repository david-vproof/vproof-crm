/**
 * Buida el potencial de tots els clients del CRM, d'un sol cop.
 *
 * El potencial és manual: el posa qui porta el compte. Fins al setembre de
 * 2026, però, el portal hi desava la lletra que ara és la categoria, així que
 * el que hi ha no l'ha triat ningú. Aquest script ho deixa en blanc perquè es
 * pugui posar a mà des de zero. No és idempotent en el sentit útil: si es
 * torna a executar, esborra també el que s'hagi posat a mà. Un sol ús.
 *
 *   DIRECTUS_URL=... DIRECTUS_EMAIL=... DIRECTUS_PASSWORD=... node scripts/crm-buida-potencial.mjs
 *
 * També accepta DIRECTUS_TOKEN si el compte té permís d'escriure a crm_clients.
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI_ESTATIC = process.env.DIRECTUS_TOKEN ?? "";
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";

if (!URL_BASE || (!TESTIMONI_ESTATIC && !(CORREU && CONTRASENYA))) {
  console.error("Cal DIRECTUS_URL i, o bé DIRECTUS_TOKEN, o bé DIRECTUS_EMAIL amb DIRECTUS_PASSWORD.");
  process.exit(1);
}

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
  const cos = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(cos?.errors?.[0]?.message ?? `HTTP ${resposta.status}`);
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

await entra();

const ambPotencial = (await api("/items/crm_clients?fields=id&limit=-1&filter[potencial][_nnull]=true")).data;
for (let i = 0; i < ambPotencial.length; i += 100) {
  const lot = ambPotencial.slice(i, i + 100);
  await api("/items/crm_clients", {
    method: "PATCH",
    body: JSON.stringify({ keys: lot.map((c) => c.id), data: { potencial: null } }),
  });
}
console.log(`✓ potencial buidat a ${ambPotencial.length} clients.`);
