/**
 * Treu les coordenades dels clients i establiments que són al mig del poble o
 * del codi postal en comptes de a la seva adreça, perquè el portal els torni a
 * situar amb el geocodificador nou (que neteja el pis i la porta de l'adreça).
 *
 * Com se sap quins són: OpenStreetMap, quan no trobava l'adreça, deixava el
 * compte al centre del codi postal o del poble, i tots els que hi queien
 * comparteixen exactament el mateix punt. Es buiden els que comparteixen punt
 * amb algú altre i tenen un número de carrer a l'adreça: els que no en tenen
 * no se situarien millor. Un punt posat a mà no el comparteix ningú.
 *
 * Un cop buidats, el programador del portal (o obrir el mapa) els torna a
 * situar per tandes, a una consulta per segon: uns quants centenars triguen
 * una bona estona, i mentrestant no surten al mapa.
 *
 *   DIRECTUS_URL=... DIRECTUS_TOKEN=... node scripts/crm-reubica.mjs          (només diu què faria)
 *   DIRECTUS_URL=... DIRECTUS_TOKEN=... node scripts/crm-reubica.mjs --aplica (ho fa)
 *
 * També accepta DIRECTUS_EMAIL amb DIRECTUS_PASSWORD en comptes del testimoni.
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI_ESTATIC = process.env.DIRECTUS_TOKEN ?? "";
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";
const APLICA = process.argv.includes("--aplica");

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

const COLLECCIONS = ["crm_clients", "crm_establiments"];
const CAMPS = { crm_clients: "id,adreca,poblacio,latitud,longitud", crm_establiments: "id,client,adreca,poblacio,latitud,longitud" };

/** Clau del punt: amb cinc decimals, que és un metre; dos comptes al mateix metre són el mateix centre. */
const punt = (fila) => `${Number(fila.latitud).toFixed(5)},${Number(fila.longitud).toFixed(5)}`;
const ambNumero = (fila) => /\d/.test(fila.adreca ?? "");

const files = [];
for (const colleccio of COLLECCIONS) {
  try {
    const { data } = await api(
      `/items/${colleccio}?fields=${CAMPS[colleccio]}&limit=-1&filter[latitud][_nnull]=true&filter[longitud][_nnull]=true`,
    );
    files.push(...data.map((fila) => ({ ...fila, colleccio })));
  } catch (error) {
    // Els establiments poden no existir encara (l'script de Directus no s'ha executat).
    if (colleccio === "crm_establiments") console.log(`(sense ${colleccio}: ${error.message})`);
    else throw error;
  }
}

// Un punt és un centre si hi ha dos clients diferents o més. Un establiment
// compta pel seu client: el que copia el punt del client perquè és a la
// mateixa adreça no fa que el punt sigui cap centre, però un establiment d'un
// client i la fitxa d'un altre al mateix metre, sí.
const clientsAlPunt = new Map();
for (const fila of files) {
  const client = fila.colleccio === "crm_clients" ? fila.id : fila.client;
  if (!client) continue;
  if (!clientsAlPunt.has(punt(fila))) clientsAlPunt.set(punt(fila), new Set());
  clientsAlPunt.get(punt(fila)).add(client);
}
const alCentre = (fila) => (clientsAlPunt.get(punt(fila))?.size ?? 0) > 1;
const perBuidar = files.filter((fila) => alCentre(fila) && ambNumero(fila));

console.log(`${files.length} fitxes amb coordenades; ${files.filter(alCentre).length} són en un punt que comparteixen dos clients o més; ${perBuidar.length} tenen número de carrer i es tornaran a situar.`);
for (const fila of perBuidar.slice(0, 15)) console.log(`  ${fila.colleccio} · ${fila.adreca} · ${fila.poblacio ?? ""}`);
if (perBuidar.length > 15) console.log(`  … i ${perBuidar.length - 15} més.`);

if (!APLICA) {
  console.log("No s'ha tocat res: torna-ho a executar amb --aplica per buidar-los.");
  process.exit(0);
}

for (const colleccio of COLLECCIONS) {
  const ids = perBuidar.filter((fila) => fila.colleccio === colleccio).map((fila) => fila.id);
  for (let i = 0; i < ids.length; i += 100) {
    await api(`/items/${colleccio}`, {
      method: "PATCH",
      body: JSON.stringify({ keys: ids.slice(i, i + 100), data: { latitud: null, longitud: null } }),
    });
  }
  if (ids.length) console.log(`✓ ${ids.length} de ${colleccio} sense coordenades: el portal els tornarà a situar.`);
}
