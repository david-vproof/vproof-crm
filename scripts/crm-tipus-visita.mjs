/**
 * Els tipus de visita refinats a `crm_activitats`.
 *
 * Les visites passen a ser quatre: normal, amb vins, de celler a client i de
 * client/s a celler. Els valors vells es conserven (`visita_sense_vi`,
 * `visita_amb_vi`, `visita_celler`) i se n'afegeix un (`visita_celler_client`),
 * així que no cal tocar cap activitat. Aquesta migració:
 *
 *   1. canvia les opcions i els colors del camp `tipus`,
 *   2. fa que el celler i els vins presentats surtin també a la visita de celler a client,
 *   3. crea el camp `grup`, que lliga les activitats d'una visita de diversos clients al celler.
 *
 * És idempotent.
 *
 *   DIRECTUS_URL=... DIRECTUS_EMAIL=... DIRECTUS_PASSWORD=... \
 *     node scripts/crm-tipus-visita.mjs
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI_ESTATIC = process.env.DIRECTUS_TOKEN ?? "";
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";

if (!URL_BASE || (!TESTIMONI_ESTATIC && !(CORREU && CONTRASENYA))) {
  console.error("Cal DIRECTUS_URL i, o bé DIRECTUS_TOKEN, o bé DIRECTUS_EMAIL amb DIRECTUS_PASSWORD.");
  process.exit(1);
}

const BLAU = "#3399FF", GROC = "#FFC23B", GRIS = "#A2B5CD", MORAT = "#8866FF";

/** Igual que `TIPUS_ACTIVITAT` a domini/crm-fitxes.ts. */
const TIPUS_ACTIVITAT = [
  { text: "Trucada", value: "trucada", color: BLAU },
  { text: "Visita normal", value: "visita_sense_vi", color: GRIS },
  { text: "Visita amb vins", value: "visita_amb_vi", color: MORAT },
  { text: "Visita de celler a client", value: "visita_celler_client", color: "#3D7068" },
  { text: "Visita de client/s a celler", value: "visita_celler", color: "#B5446E" },
  { text: "Correu", value: "correu", color: "#7A8592" },
  { text: "Reunió", value: "reunio", color: GROC },
];

const AMB_VI = ["visita_amb_vi", "visita_celler_client", "visita_celler"];
/** El celler només surt quan n'hi ha un pel mig; els vins presentats, a totes les visites amb vi. */
const AMB_CELLER = ["visita_celler_client", "visita_celler"];

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

await entra();

// 1. Les opcions del tipus.
const tipus = await camp("crm_activitats", "tipus");
await api("/fields/crm_activitats/tipus", {
  method: "PATCH",
  body: JSON.stringify({
    meta: {
      options: { ...(tipus?.meta?.options ?? {}), choices: TIPUS_ACTIVITAT.map(({ text, value }) => ({ text, value })) },
      display: "labels",
      display_options: {
        choices: TIPUS_ACTIVITAT.map(({ text, value, color }) => ({ text, value, foreground: "#FFFFFF", background: color })),
        showAsDot: false,
      },
    },
  }),
});
console.log("opcions  crm_activitats.tipus");

// 2. El celler, a les visites amb un celler pel mig; els vins presentats, a totes les visites amb vi.
for (const [nom, tipus] of [["celler", AMB_CELLER], ["referencies", AMB_VI]]) {
  const actual = await camp("crm_activitats", nom);
  if (!actual) continue;
  const condicions = (actual.meta?.conditions ?? []).map((condicio) =>
    condicio?.rule?.tipus?._in ? { ...condicio, rule: { tipus: { _in: tipus } } } : condicio,
  );
  await api(`/fields/crm_activitats/${nom}`, { method: "PATCH", body: JSON.stringify({ meta: { conditions: condicions } }) });
  console.log(`condició crm_activitats.${nom}`);
}

// 3. El grup de les visites de diversos clients.
if (await camp("crm_activitats", "grup")) {
  console.log("ja hi és crm_activitats.grup");
} else {
  await api("/fields/crm_activitats", {
    method: "POST",
    body: JSON.stringify({
      field: "grup",
      type: "string",
      meta: {
        interface: "input", width: "half", readonly: true, hidden: true,
        note: "Les activitats d'una mateixa visita de clients al celler porten el mateix grup.",
      },
      schema: { is_nullable: true },
    }),
  });
  console.log("creat    crm_activitats.grup");
}

console.log("\n✓ Fet.");
