/**
 * Els cellers passen a ser els proveïdors de l'ERP.
 *
 * Fins ara `crm_cellers` era una taula pròpia del portal, amb quatre fitxes de
 * mostra. Els cellers de debò són els proveïdors que ve de FactuSol, així que
 * aquesta migració:
 *
 *   1. repunta `crm_activitats.celler` cap a `crm_proveidors`,
 *   2. hi afegeix la cara inversa (`crm_proveidors.activitats`),
 *   3. esborra la col·lecció `crm_cellers`.
 *
 * És idempotent: si ja s'ha passat, no fa res. I no esborra res mentre hi hagi
 * cap activitat que apunti a un celler antic; en aquest cas s'atura i ho diu,
 * perquè primer cal decidir a quin proveïdor va cadascuna.
 *
 *   DIRECTUS_URL=... DIRECTUS_EMAIL=... DIRECTUS_PASSWORD=... \
 *     node scripts/crm-cellers-erp.mjs
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

const VELLA = "crm_cellers";
const NOVA = "crm_proveidors";

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

const colleccions = new Set((await api("/collections")).data.map((c) => c.collection));
if (!colleccions.has(NOVA)) {
  console.error(`Falta ${NOVA}. Executa abans scripts/crm-directus.mjs.`);
  process.exit(1);
}

// 1. Cap activitat pot quedar apuntant a un celler que s'esborrarà.
const relacions = (await api("/relations")).data;
const relacioCeller = relacions.find((r) => r.collection === "crm_activitats" && r.field === "celler");
if (relacioCeller?.related_collection === VELLA) {
  const { meta } = await api('/items/crm_activitats?limit=0&meta=filter_count&filter={"celler":{"_nnull":true}}');
  if (meta.filter_count > 0) {
    console.error(
      `Hi ha ${meta.filter_count} activitats que apunten a un celler de ${VELLA}. ` +
        "Cal reassignar-les a un proveïdor abans de migrar: aquesta migració no endevina a quin.",
    );
    process.exit(1);
  }

  // 2. El camp es torna a fer, apuntant a la col·lecció nova. Se'n conserva la
  // presentació (condicions, nota, amplada i posició) tal com estava.
  const previ = await camp("crm_activitats", "celler");
  const presentacio = previ?.meta ?? {};
  await api("/fields/crm_activitats/celler", { method: "DELETE" });
  await api("/fields/crm_activitats", {
    method: "POST",
    body: JSON.stringify({
      field: "celler",
      type: "uuid",
      meta: {
        interface: "select-dropdown-m2o",
        special: ["m2o"],
        width: presentacio.width ?? "half",
        note: presentacio.note ?? "De qui són les referències, o on ha anat el client.",
        conditions: presentacio.conditions ?? null,
        hidden: presentacio.hidden ?? true,
        sort: presentacio.sort ?? null,
        options: { template: "{{nom_comercial}}" },
      },
      schema: { is_nullable: true },
    }),
  });
  await api("/relations", {
    method: "POST",
    body: JSON.stringify({
      collection: "crm_activitats",
      field: "celler",
      related_collection: NOVA,
      meta: { one_field: "activitats", one_deselect_action: "nullify", sort_field: null },
      schema: { on_delete: "SET NULL" },
    }),
  });
  console.log(`repuntat crm_activitats.celler → ${NOVA}`);
} else {
  console.log(`ja hi és  crm_activitats.celler → ${relacioCeller?.related_collection ?? "(sense relació)"}`);
}

// 3. La cara inversa, perquè el proveïdor ensenyi les seves visites.
if (!(await camp(NOVA, "activitats"))) {
  await api(`/fields/${NOVA}`, {
    method: "POST",
    body: JSON.stringify({
      field: "activitats",
      type: "alias",
      meta: {
        interface: "list-o2m",
        special: ["o2m"],
        width: "full",
        note: "Visites i accions relacionades amb aquest celler.",
      },
    }),
  });
  console.log(`creat     ${NOVA}.activitats`);
} else {
  console.log(`ja hi és  ${NOVA}.activitats`);
}

// 4. Fora la taula antiga, amb les seves fitxes de mostra.
if (colleccions.has(VELLA)) {
  const { meta } = await api(`/items/${VELLA}?limit=0&meta=total_count`);
  await api(`/collections/${VELLA}`, { method: "DELETE" });
  console.log(`esborrada ${VELLA} (${meta.total_count} fitxes)`);
} else {
  console.log(`ja no hi és ${VELLA}`);
}

console.log("\n✓ Els cellers són els proveïdors de l'ERP.");
