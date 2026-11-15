/**
 * Puja al CRM les notes i la periodicitat que es porten a mà al full de càlcul
 * comercial (pestanya CLIENTS, desada com a CSV).
 *
 * El full té una fila per client amb el codi de FactuSol, així que els clients
 * es troben per `codi_erp`. Només es toquen dos camps, i tots dos són del CRM:
 * l'ERP no els mana i la sincronització no els trepitja.
 *
 * És idempotent: el que ja hi és igual no es torna a escriure. Per no perdre
 * res, un camp que al CRM ja tingui valor no es sobreescriu (se n'avisa al
 * final); amb `--forca` sí.
 *
 *   DIRECTUS_URL=... DIRECTUS_TOKEN=... \
 *     node scripts/crm-importa-clients-csv.mjs clients.csv [--prova] [--forca]
 *
 * Columnes que llegeix, pel nom de la capçalera: «Código», «PERIODICITAT» i
 * «Notes». La resta s'ignoren.
 */
import { readFileSync } from "node:fs";

const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI = process.env.DIRECTUS_TOKEN ?? "";
const arguments_ = process.argv.slice(2);
const FITXER = arguments_.find((a) => !a.startsWith("--"));
const PROVA = arguments_.includes("--prova");
const FORCA = arguments_.includes("--forca");

if (!URL_BASE || !TESTIMONI || !FITXER) {
  console.error("Ús: DIRECTUS_URL=... DIRECTUS_TOKEN=... node scripts/crm-importa-clients-csv.mjs clients.csv [--prova] [--forca]");
  process.exit(1);
}

// ------------------------------------------------------------------- CSV

/** Un CSV com el que desa l'Excel: cometes dobles, i comes i salts de línia a dins. */
function llegeixCsv(text) {
  const files = [];
  let fila = [];
  let valor = "";
  let entreCometes = false;

  for (let i = 0; i < text.length; i += 1) {
    const lletra = text[i];
    if (entreCometes) {
      if (lletra !== '"') valor += lletra;
      else if (text[i + 1] === '"') (valor += '"'), (i += 1);
      else entreCometes = false;
      continue;
    }
    if (lletra === '"') entreCometes = true;
    else if (lletra === ",") (fila.push(valor), (valor = ""));
    else if (lletra === "\n") (fila.push(valor), files.push(fila), (fila = []), (valor = ""));
    else if (lletra !== "\r") valor += lletra;
  }
  if (valor !== "" || fila.length > 0) (fila.push(valor), files.push(fila));

  const capcalera = files.shift() ?? [];
  return files
    .filter((f) => f.some((cella) => cella.trim() !== ""))
    .map((f) => Object.fromEntries(capcalera.map((nom, i) => [nom.trim(), (f[i] ?? "").trim()])));
}

// --------------------------------------------------------- periodicitat

/** Les opcions del CRM: activitats l'any. Igual que `PERIODICITATS` a domini/crm-periodicitat.ts. */
const PERIODICITATS = [52, 26, 12, 6, 4, 3, 2, 1];

/** Paraules del full que ja diuen quantes n'hi ha l'any. */
const PARAULES = [
  [/setmanal/i, 52],
  [/quinzenal/i, 26],
  [/mensual/i, 12],
  [/bimestral/i, 6],
  [/trimestral/i, 4],
  [/quadrimestral/i, 3],
  [/semestral/i, 2],
  [/anual/i, 1],
];

/**
 * El que diu el full, convertit a activitats l'any. «3/6 vegades l'any» es
 * queda amb la més sovint, que és com es va acordar. «No visitar» no té
 * equivalent al CRM: es deixa buida i ho diuen les notes.
 */
function periodicitatDe(text) {
  const net = text.trim();
  if (!net) return { valor: null };
  if (/no\s+visitar/i.test(net)) return { valor: null, aLesNotes: net.toUpperCase() };

  for (const [paraula, quantes] of PARAULES) if (paraula.test(net)) return { valor: quantes };

  // «6 vegades l'any», «6 cops l'any», «3/6 vegades l'any»: mana el número més gran.
  const numeros = net.match(/\d+/g)?.map(Number).filter((n) => n > 0) ?? [];
  if (numeros.length > 0) {
    const demanades = Math.max(...numeros);
    const trobada = PERIODICITATS.find((quantes) => quantes === demanades);
    if (trobada) return { valor: trobada };
    // Sense opció exacta, la més propera per sota: promet menys i no enganya el seguiment.
    const perSota = PERIODICITATS.find((quantes) => quantes < demanades);
    if (perSota) return { valor: perSota, avis: `«${net}» → ${perSota} l'any` };
  }
  return { valor: null, avis: `no s'entén «${net}»` };
}

// --------------------------------------------------------------- Directus

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

const files = llegeixCsv(readFileSync(FITXER, "utf8"));
const { data: clients } = await api("/items/crm_clients?limit=-1&fields=id,codi_erp,nom_comercial,notes,periodicitat");
const perCodi = new Map(clients.map((client) => [Number(client.codi_erp), client]));

const avisos = [];
const sensePujar = [];
let canviats = 0;
let iguals = 0;
let senseClient = 0;

for (const fila of files) {
  const codi = Number(fila["Código"]);
  if (!codi) continue;
  const client = perCodi.get(codi);
  if (!client) {
    senseClient += 1;
    avisos.push(`${codi}: no hi ha cap client amb aquest codi al CRM`);
    continue;
  }

  const { valor: periodicitat, aLesNotes, avis } = periodicitatDe(fila.PERIODICITAT ?? "");
  if (avis) avisos.push(`${codi} ${client.nom_comercial}: ${avis}`);

  // El que no cap a la periodicitat va a les notes, a la primera línia.
  const notes = [aLesNotes, (fila.Notes ?? "").trim()].filter(Boolean).join("\n") || null;

  const canvis = {};
  for (const [camp, nou] of [["notes", notes], ["periodicitat", periodicitat]]) {
    if (nou === null) continue;
    const actual = client[camp];
    const teValor = actual !== null && actual !== undefined && String(actual).trim() !== "";
    if (teValor && String(actual).trim() === String(nou).trim()) continue;
    if (teValor && !FORCA) {
      sensePujar.push(`${codi} ${client.nom_comercial}: ${camp} ja té valor al CRM`);
      continue;
    }
    canvis[camp] = nou;
  }

  if (Object.keys(canvis).length === 0) {
    iguals += 1;
    continue;
  }
  if (!PROVA) await api(`/items/crm_clients/${client.id}`, { method: "PATCH", body: JSON.stringify(canvis) });
  canviats += 1;
}

console.log(`\nfiles al full: ${files.length}`);
console.log(`clients ${PROVA ? "per canviar" : "canviats"}: ${canviats}`);
console.log(`ja estaven igual: ${iguals}`);
if (senseClient > 0) console.log(`sense client al CRM: ${senseClient}`);
for (const avis of avisos) console.log(`  ! ${avis}`);
for (const cas of sensePujar) console.log(`  · ${cas} (no es toca; amb --forca sí)`);
console.log(PROVA ? "\n(prova: no s'ha escrit res)" : "\n✓ fet");
