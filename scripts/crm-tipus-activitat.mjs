/**
 * Porta els tipus d'activitat a una taula de Directus, `crm_tipus_activitat`,
 * perquè se'n puguin crear de nous des de Configuració › Valors CRM.
 *
 * Fa només això: crea la col·lecció i els seus camps, els dona els mateixos
 * permisos que a `crm_categories`, hi posa els tipus de partida si és buida i
 * deixa que el desplegable de `crm_activitats.tipus` accepti valors nous.
 * No toca cap activitat: `tipus` continua desant el mateix valor. És idempotent.
 *
 * A diferència de `crm-directus.mjs`, no retoca res de clients ni d'altres
 * col·leccions: per això es pot executar sobre un Directus que ja està en marxa.
 *
 *   DIRECTUS_URL=... DIRECTUS_EMAIL=... DIRECTUS_PASSWORD=... \
 *     node scripts/crm-tipus-activitat.mjs
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI_ESTATIC = process.env.DIRECTUS_TOKEN ?? "";
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";

if (!URL_BASE || (!TESTIMONI_ESTATIC && !(CORREU && CONTRASENYA))) {
  console.error("Cal DIRECTUS_URL i, o bé DIRECTUS_TOKEN d'administrador, o bé DIRECTUS_EMAIL amb DIRECTUS_PASSWORD.");
  process.exit(1);
}

const COLLECCIO = "crm_tipus_activitat";

/** Igual que `TIPUS_BASE` a domini/crm-tipus-activitat.ts. */
const TIPUS_BASE = [
  { valor: "trucada", nom: "Trucada" },
  { valor: "visita_sense_vi", nom: "Visita normal", visita: true },
  { valor: "visita_amb_vi", nom: "Visita amb vins", visita: true, amb_vi: true },
  { valor: "visita_celler_client", nom: "Visita de celler a client", visita: true, amb_vi: true, amb_celler: true },
  { valor: "visita_cellers_client", nom: "Visita de cellers a client", visita: true, amb_vi: true, amb_celler: true },
  { valor: "visita_celler", nom: "Visita de client/s a celler", visita: true, amb_vi: true, amb_celler: true },
  { valor: "correu", nom: "Correu" },
  { valor: "reunio", nom: "Reunió" },
];

/** Com a `crm_categories`: el portal ho pot tot; l'equip, tot menys esborrar. */
const PERMISOS = [
  ["Portal · lectura del CRM", ["read", "create", "update", "delete"]],
  ["wine_users", ["read", "create", "update"]],
];

const PK = {
  field: "id",
  type: "uuid",
  meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] },
  schema: { is_primary_key: true, length: 36, has_auto_increment: false },
};

const siNo = (field, perDefecte, note) => ({
  field,
  type: "boolean",
  meta: { interface: "boolean", width: "half", note },
  schema: { default_value: perDefecte, is_nullable: false },
});

const CAMPS = [
  { field: "nom", type: "string", meta: { interface: "input", width: "half", required: true }, schema: { is_nullable: false } },
  {
    field: "valor",
    type: "string",
    meta: { interface: "input", width: "half", required: true, readonly: true, note: "El que es desa a cada activitat. Surt del nom en crear el tipus i no canvia mai." },
    schema: { is_nullable: false, is_unique: true },
  },
  siNo("visita", false, "Compta com a visita al tauler."),
  siNo("amb_vi", false, "L'activitat porta els vins presentats."),
  siNo("amb_celler", false, "L'activitat porta un celler."),
  siNo("actiu", true, "S'ofereix en crear activitats. Les que ja el tenen el conserven igualment."),
  { field: "ordre", type: "integer", meta: { interface: "input", width: "half", note: "L'ordre als desplegables." }, schema: { is_nullable: true, default_value: 100 } },
  { field: "date_created", type: "timestamp", meta: { interface: "datetime", special: ["date-created"], readonly: true, hidden: true, width: "half" }, schema: {} },
  { field: "date_updated", type: "timestamp", meta: { interface: "datetime", special: ["date-updated"], readonly: true, hidden: true, width: "half" }, schema: {} },
];

let testimoni = TESTIMONI_ESTATIC;

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
  if (!resposta.ok) throw new Error(`${ruta} → ${cos?.errors?.[0]?.message ?? `HTTP ${resposta.status}`}`);
  return cos;
}

if (!testimoni) {
  testimoni = (await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: CORREU, password: CONTRASENYA, mode: "json" }),
  })).data.access_token;
}

// 1. La col·lecció, dins de la carpeta del CRM.
const colleccions = (await api("/collections")).data.map((colleccio) => colleccio.collection);
if (colleccions.includes(COLLECCIO)) {
  console.log(`ja hi és ${COLLECCIO}`);
} else {
  await api("/collections", {
    method: "POST",
    body: JSON.stringify({
      collection: COLLECCIO,
      meta: {
        icon: "category",
        note: "Els tipus d'activitat que es poden triar. Es canvien a Configuració › Valors CRM.",
        display_template: "{{nom}}", sort: 12, color: "#2ECDA7", group: "crm",
      },
      schema: {},
      fields: [PK],
    }),
  });
  console.log(`creada   ${COLLECCIO}`);
}

// 2. Els camps.
const teCamp = new Set((await api(`/fields/${COLLECCIO}`)).data.map((camp) => camp.field));
for (const [ordre, definicio] of CAMPS.entries()) {
  if (teCamp.has(definicio.field)) continue;
  await api(`/fields/${COLLECCIO}`, {
    method: "POST",
    body: JSON.stringify({ ...definicio, meta: { ...definicio.meta, sort: ordre + 2 } }),
  });
  console.log(`camp     ${definicio.field}`);
}

// 3. Els permisos.
for (const [nom, accions] of PERMISOS) {
  const politica = (await api(`/policies?filter[name][_eq]=${encodeURIComponent(nom)}&fields=id`)).data[0];
  if (!politica) {
    console.warn(`atenció  no hi ha la política «${nom}»: executa scripts/crm-acces.mjs`);
    continue;
  }
  const jaTe = new Set(
    (await api(`/permissions?filter[policy][_eq]=${politica.id}&filter[collection][_eq]=${COLLECCIO}&fields=action&limit=-1`)).data.map((permis) => permis.action),
  );
  for (const action of accions) {
    if (jaTe.has(action)) continue;
    await api("/permissions", {
      method: "POST",
      body: JSON.stringify({ policy: politica.id, collection: COLLECCIO, action, fields: ["*"], permissions: {}, validation: {} }),
    });
    console.log(`permís   ${nom}: ${action}`);
  }
}

// 4. Els tipus de partida, només si és buida: un cop hi ha res, mana el que s'hi hagi desat.
const hiHa = (await api(`/items/${COLLECCIO}?fields=id&limit=1`)).data;
if (hiHa.length === 0) {
  await api(`/items/${COLLECCIO}`, {
    method: "POST",
    body: JSON.stringify(
      TIPUS_BASE.map((tipus, posicio) => ({ visita: false, amb_vi: false, amb_celler: false, actiu: true, ordre: (posicio + 1) * 10, ...tipus })),
    ),
  });
  console.log(`tipus    ${TIPUS_BASE.length} de partida`);
} else {
  console.log("tipus    ja n'hi ha: no es toquen");
}

// 5. L'aplicació de Directus ha d'acceptar els tipus creats al portal.
const tipus = (await api("/fields/crm_activitats/tipus")).data;
if (!tipus.meta?.options?.allowOther) {
  await api("/fields/crm_activitats/tipus", {
    method: "PATCH",
    body: JSON.stringify({ meta: { options: { ...(tipus.meta?.options ?? {}), allowOther: true } } }),
  });
  console.log("opcions  crm_activitats.tipus admet valors lliures");
}

console.log("\n✓ Fet.");
