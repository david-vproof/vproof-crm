/**
 * Posa l'agent a les activitats que ja hi havia.
 *
 * L'agent d'una activitat és el del seu client (o el del seu lead): el portal
 * l'hi copia en desar-la, però les que es van crear abans que el camp existís
 * el tenen buit i no sortirien en filtrar l'agenda per agent.
 *
 * És idempotent, i no toca cap activitat que ja en tingui: si algú l'ha
 * canviat a mà a Directus, mana el que hi ha.
 *
 *   DIRECTUS_URL=... DIRECTUS_TOKEN=... node scripts/crm-agent-activitats.mjs [--prova]
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI = process.env.DIRECTUS_TOKEN ?? "";
const PROVA = process.argv.includes("--prova");

if (!URL_BASE || !TESTIMONI) {
  console.error("Cal DIRECTUS_URL i DIRECTUS_TOKEN.");
  process.exit(1);
}

async function api(ruta, opcions = {}) {
  const resposta = await fetch(`${URL_BASE}${ruta}`, {
    ...opcions,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TESTIMONI}`, ...opcions.headers },
  });
  if (resposta.status === 204) return {};
  const cos = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(cos?.errors?.[0]?.message ?? `HTTP ${resposta.status}`);
  return cos;
}

const { data: activitats } = await api(
  "/items/crm_activitats?limit=-1&fields=id,agent,client.agent,lead.agent",
);

const pendents = activitats
  .filter((activitat) => !activitat.agent)
  .map((activitat) => ({ id: activitat.id, agent: activitat.client?.agent ?? activitat.lead?.agent ?? null }))
  .filter((activitat) => activitat.agent);

console.log(`activitats: ${activitats.length}`);
console.log(`sense agent: ${activitats.filter((a) => !a.agent).length}`);
console.log(`${PROVA ? "per posar" : "amb agent nou"}: ${pendents.length}`);

if (!PROVA) {
  // Per lots: una sola petició amb milers d'elements la rebutjaria el servidor.
  const LOT = 100;
  for (let i = 0; i < pendents.length; i += LOT) {
    await api("/items/crm_activitats", { method: "PATCH", body: JSON.stringify(pendents.slice(i, i + LOT)) });
  }
}

console.log(PROVA ? "\n(prova: no s'ha escrit res)" : "\n✓ fet");
