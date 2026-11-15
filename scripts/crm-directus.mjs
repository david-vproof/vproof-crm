/**
 * Crea (o completa) el model de CRM a Directus.
 *
 * És idempotent: es pot tornar a executar tantes vegades com calgui, perquè
 * només crea el que falta. No esborra mai res ni toca les dades existents.
 *
 *   DIRECTUS_URL=... DIRECTUS_TOKEN=... node scripts/crm-directus.mjs
 *
 * També accepta DIRECTUS_EMAIL i DIRECTUS_PASSWORD si no hi ha testimoni.
 */
const URL_BASE = (process.env.DIRECTUS_URL ?? "").replace(/\/+$/, "");
const TESTIMONI_ESTATIC = process.env.DIRECTUS_TOKEN ?? "";
const CORREU = process.env.DIRECTUS_EMAIL ?? "";
const CONTRASENYA = process.env.DIRECTUS_PASSWORD ?? "";

if (!URL_BASE || (!TESTIMONI_ESTATIC && !(CORREU && CONTRASENYA))) {
  console.error("Cal DIRECTUS_URL i, o bé DIRECTUS_TOKEN, o bé DIRECTUS_EMAIL amb DIRECTUS_PASSWORD.");
  process.exit(1);
}

// ---------------------------------------------------------------- vocabulari
// Els mateixos valors que ja fa servir el portal, per no inventar-ne un de nou.
const FORMES_PAGAMENT = ["Comptat", "Transferència 30 dies", "Rebut domiciliat 60 dies", "Confirming 90 dies", "Targeta"];
const ORIGENS = ["Fira", "Recomanació", "Web", "Prospecció", "Client existent", "Xarxes socials"];

const VERD = "#2ECDA7", BLAU = "#3399FF", GROC = "#FFC23B", VERMELL = "#E35169", GRIS = "#A2B5CD", MORAT = "#8866FF";

const tria = (valors) => valors.map((v) => (typeof v === "string" ? { text: v, value: v } : v));
const etiquetes = (valors) =>
  valors.map(({ text, value, color }) => ({ text, value, foreground: "#FFFFFF", background: color }));

// ------------------------------------------------------------------- ajudants
const camp = (field, type, meta = {}, schema = {}) => ({ field, type, meta, schema });

const text = (field, opcions = {}) =>
  camp(field, "string", { interface: "input", width: "half", ...opcions.meta }, { is_nullable: !opcions.obligatori, ...opcions.schema });

const areaText = (field, nota) =>
  camp(field, "text", { interface: "input-multiline", width: "full", note: nota });

/** Dades estructurades que escriu el portal i que a Directus només es miren. */
const json = (field, nota) =>
  camp(field, "json", { interface: "input-code", options: { language: "json" }, width: "full", note: nota, readonly: true }, { is_nullable: true });

const nombre = (field, opcions = {}) =>
  camp(field, "integer", { interface: "input", width: "half", ...opcions.meta }, { is_nullable: true, ...opcions.schema });

const import_ = (field, nota) =>
  camp(field, "decimal", { interface: "input", width: "half", note: nota, options: { min: 0 }, display: "formatted-value", display_options: { suffix: " €" } },
    { numeric_precision: 12, numeric_scale: 2, is_nullable: true });

/** Un percentatge de l'ERP: retenció d'IRPF, descompte de compra. */
const percentatge = (field, nota) =>
  camp(field, "decimal", { interface: "input", width: "half", note: nota, options: { min: 0, max: 100 }, display: "formatted-value", display_options: { suffix: " %" } },
    { numeric_precision: 5, numeric_scale: 2, is_nullable: true });

/** Un import de facturació que calcula el portal: pot ser negatiu, per les rectificatives. */
const facturat = (field, nota) =>
  camp(field, "decimal", { interface: "input", width: "half", readonly: true, note: nota, display: "formatted-value", display_options: { suffix: " €" } },
    { numeric_precision: 12, numeric_scale: 2, is_nullable: true });

/** Una xifra que copia l'ERP i no es toca: pot ser negativa, com una devolució en un albarà. */
const xifraErp = (field, escala, nota, sufix) =>
  camp(field, "decimal", {
    interface: "input", width: "half", readonly: true, note: nota,
    display: "formatted-value", display_options: sufix ? { suffix: sufix } : null,
  }, { numeric_precision: 14, numeric_scale: escala, is_nullable: true });

/** Un enllaç pel qual es filtra sovint: amb índex, perquè la taula creix de milers en milers. */
const ambIndex = (definicio) => ({ ...definicio, schema: { ...definicio.schema, is_indexed: true } });

/** Grau decimal: prou precisió per a un punt al carrer. */
const coordenada = (field, nota) =>
  camp(field, "decimal", { interface: "input", width: "half", note: nota },
    { numeric_precision: 10, numeric_scale: 7, is_nullable: true });

const data = (field, opcions = {}) =>
  camp(field, opcions.ambHora ? "timestamp" : "date", { interface: "datetime", width: "half", ...opcions.meta }, { is_nullable: true, ...opcions.schema });

const siNo = (field, perDefecte = false, nota) =>
  camp(field, "boolean", { interface: "boolean", width: "half", note: nota }, { default_value: perDefecte, is_nullable: false });

const llista = (field, valors, opcions = {}) =>
  camp(field, "string", {
    interface: "select-dropdown",
    width: "half",
    options: { choices: tria(valors), allowOther: opcions.obert ?? false },
    display: opcions.colors ? "labels" : null,
    display_options: opcions.colors ? { choices: etiquetes(opcions.colors), showAsDot: false } : null,
    note: opcions.nota,
    ...opcions.meta,
  }, { default_value: opcions.perDefecte ?? null, is_nullable: true });

/** Camp M2O + la seva relació. La cara O2M es declara a la col·lecció pare. */
const enllac = (field, cap_a, opcions = {}) => ({
  ...camp(field, "uuid", {
    interface: "select-dropdown-m2o",
    special: ["m2o"],
    width: opcions.ample ?? "half",
    options: { template: opcions.plantilla ?? "{{nom}}" },
    note: opcions.nota,
    conditions: opcions.condicions,
  }, { is_nullable: true }),
  // Què li passa quan s'esborra la fitxa a què apunta. Per defecte es buida;
  // una fila d'enllaç (el vi d'una activitat) no té sentit sola i s'esborra.
  _relacio: { related_collection: cap_a, one_field: opcions.inversa ?? null, on_delete: opcions.enEsborrar ?? "SET NULL" },
});

/** Una imatge de la biblioteca de fitxers de Directus. */
const imatge = (field, nota) => ({
  ...camp(field, "uuid", { interface: "file-image", special: ["file"], width: "half", note: nota }, { is_nullable: true }),
  _relacio: { related_collection: "directus_files", one_field: null },
});

/** Les còpies de l'ERP massa grosses per guardar-ne l'historial de canvis a Directus. */
const SENSE_HISTORIAL = ["crm_albarans", "crm_albarans_linies"];

/** La carpeta de fitxers on la sincronització desa les fotos dels articles. El portal la busca pel nom. */
const CARPETA_FOTOS_ARTICLES = "Articles de FactuSol";

/** La carpeta on el portal desa les fotos de les activitats. També la busca pel nom. */
const CARPETA_FOTOS_ACTIVITATS = "Fotos d'activitats";

const inversa = (field, nota) =>
  camp(field, "alias", { interface: "list-o2m", special: ["o2m"], width: "full", note: nota });

const AUDITORIA = [
  camp("date_created", "timestamp", { interface: "datetime", special: ["date-created"], readonly: true, hidden: true, width: "half" }),
  camp("date_updated", "timestamp", { interface: "datetime", special: ["date-updated"], readonly: true, hidden: true, width: "half" }),
];

// -------------------------------------------------------------------- model
const FONTS = [
  { text: "FactuSol", value: "factusol", color: "#8A2D3F" },
  { text: "Portal", value: "portal", color: GRIS },
];
const PERIODICITATS = [
  { text: "Cada 15 minuts", value: "15" },
  { text: "Cada hora", value: "60" },
  { text: "Cada 6 hores", value: "360" },
  { text: "Cada dia", value: "1440" },
  { text: "Cada setmana", value: "10080" },
];
const ESTAT_EXECUCIO = [
  { text: "En curs", value: "en_curs", color: BLAU },
  { text: "Correcte", value: "correcte", color: VERD },
  // Ha arribat al final, però Directus no ha acceptat alguna fila: són a `errors`.
  { text: "Amb errors", value: "parcial", color: GROC },
  { text: "Error", value: "error", color: VERMELL },
];

/** Les fases d'una passada, les mateixes que `domini/sincronitzacio.ts`. */
const FASE_EXECUCIO = [
  { text: "Preparant els catàlegs", value: "preparacio" },
  { text: "Llegint", value: "lectura" },
  { text: "Comparant", value: "comparacio" },
  { text: "Escrivint a Directus", value: "escriptura" },
  { text: "Acabant el que hi va lligat", value: "complements" },
  { text: "Tancant el registre", value: "tancament" },
];

/**
 * TIPPRO de FactuSol. Es veu al compte comptable: els de mercaderia van al 600
 * (compres) i els de serveis, al 62x, que a la comptabilitat espanyola són
 * creditors i no proveïdors.
 */
const TIPUS_PROVEIDOR = [
  { text: "Proveïdor", value: "proveidor", color: "#3D7068" },
  { text: "Creditor de serveis", value: "creditor", color: GRIS },
];

const ESTAT_PROVEIDOR = [
  { text: "Actiu", value: "actiu", color: VERD },
  { text: "Inactiu", value: "inactiu", color: GROC },
  { text: "Baixa", value: "baixa", color: VERMELL },
];

/** ESTCLI: el desplegable «Estado» de la fitxa de client de FactuSol, en el mateix ordre. */
const ESTAT_CLIENT = [
  { text: "Sense seleccionar", value: "sense_seleccionar", color: GRIS },
  { text: "Habitual", value: "habitual", color: VERD },
  { text: "Esporàdic", value: "esporadic", color: GROC },
  { text: "Baixa", value: "baixa", color: VERMELL },
  { text: "Captació", value: "captacio", color: BLAU },
];

/** Igual que `FRANGES_PER_DEFECTE` a domini/crm-categoria.ts: E fins a 1.500 €, D fins a 2.500 €… A a partir de 7.500 €. */
const FRANGES_CATEGORIA = [
  { lletra: "E", des_de: 0 },
  { lletra: "D", des_de: 1500 },
  { lletra: "C", des_de: 2500 },
  { lletra: "B", des_de: 5000 },
  { lletra: "A", des_de: 7500 },
];

/** Igual que `TENDENCIES` a domini/facturacio-tendencia.ts. */
const TENDENCIES = [
  { text: "Creix", value: "creix", color: VERD },
  { text: "Estable", value: "estable", color: GROC },
  { text: "Baixa", value: "baixa", color: VERMELL },
  { text: "Nou", value: "nou", color: BLAU },
  { text: "Perdut", value: "perdut", color: "#8A2D3F" },
  { text: "Sense facturació", value: "sense", color: GRIS },
];

/** Igual que `PERIODICITATS` a domini/crm-periodicitat.ts: el valor són activitats l'any. */
const PERIODICITAT_CLIENT = [
  { text: "Setmanal (52 l'any)", value: 52 },
  { text: "Quinzenal (26 l'any)", value: 26 },
  { text: "Mensual (12 l'any)", value: 12 },
  { text: "Bimestral (6 l'any)", value: 6 },
  { text: "Trimestral (4 l'any)", value: 4 },
  { text: "Quadrimestral (3 l'any)", value: 3 },
  { text: "Semestral (2 l'any)", value: 2 },
  { text: "Anual (1 l'any)", value: 1 },
];

/**
 * L'escala d'A a E amb què es qualifica un compte, com un semàfor de cinc
 * passos. La fan servir dos camps: la categoria, que el portal calcula amb la
 * facturació, i el potencial, que es posa a mà.
 */
const LLETRES = [
  { text: "A", value: "A", color: VERD },
  { text: "B", value: "B", color: BLAU },
  { text: "C", value: "C", color: GROC },
  { text: "D", value: "D", color: "#FF9F43" },
  { text: "E", value: "E", color: VERMELL },
];

const ESTAT_LEAD = [
  { text: "Nou", value: "nou", color: BLAU },
  { text: "Contactat", value: "contactat", color: MORAT },
  { text: "Qualificat", value: "qualificat", color: GROC },
  { text: "Convertit", value: "convertit", color: VERD },
  { text: "Descartat", value: "descartat", color: VERMELL },
];

const ETAPES = [
  { text: "Contacte", value: "contacte", color: GRIS },
  { text: "Qualificada", value: "qualificada", color: BLAU },
  { text: "Tast", value: "tast", color: MORAT },
  { text: "Proposta", value: "proposta", color: GROC },
  { text: "Negociació", value: "negociacio", color: "#FF9F43" },
  { text: "Guanyada", value: "guanyada", color: VERD },
  { text: "Perduda", value: "perduda", color: VERMELL },
];

const TIPUS_ACTIVITAT = [
  { text: "Trucada", value: "trucada", color: BLAU },
  { text: "Visita normal", value: "visita_sense_vi", color: GRIS },
  { text: "Visita amb vins", value: "visita_amb_vi", color: MORAT },
  { text: "Visita de celler a client", value: "visita_celler_client", color: "#3D7068" },
  { text: "Visita de cellers a client", value: "visita_cellers_client", color: "#3D7068" },
  { text: "Visita de client/s a celler", value: "visita_celler", color: "#B5446E" },
  { text: "Correu", value: "correu", color: "#7A8592" },
  { text: "Reunió", value: "reunio", color: GROC },
];

/** Les que impliquen vi damunt la taula: hi apareixen el celler i les referències. */
const AMB_VI = ["visita_amb_vi", "visita_celler_client", "visita_cellers_client", "visita_celler"];
/** Les visites amb un celler pel mig: només aquestes porten el camp celler. */
const AMB_CELLER = ["visita_celler_client", "visita_cellers_client", "visita_celler"];
const nomesSiTeVi = (etiqueta) => [
  { name: etiqueta, rule: { tipus: { _in: AMB_VI } }, hidden: false, required: false },
];

const MODEL = [
  {
    collection: "crm_segments",
    meta: {
      icon: "filter_alt",
      note: "Segments de comptes. No s'assignen a mà: es descriuen amb criteris i els comptes hi encaixen sols.",
      display_template: "{{nom}}", sort: 0, color: "#3399FF",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true } }),
      text("codi", { meta: { note: "Abreujament per als llistats." } }),
      llista("estat", ["actiu", "inactiu"], {
        perDefecte: "actiu",
        colors: [{ text: "Actiu", value: "actiu", color: VERD }, { text: "Inactiu", value: "inactiu", color: GRIS }],
      }),
      nombre("ordre", {
        meta: { note: "Quan un compte encaixa en més d'un segment, es queda amb el de número més baix." },
        schema: { default_value: 100 },
      }),
      llista("mode", ["tots", "algun"], {
        perDefecte: "tots",
        nota: "Si cal complir tots els criteris o només un.",
        colors: [
          { text: "Tots els criteris", value: "tots", color: BLAU },
          { text: "Algun criteri", value: "algun", color: MORAT },
        ],
      }),
      // Les condicions, tal com les munta el portal. Es guarda en JSON perquè
      // el nombre de criteris i la seva forma no són fixos.
      camp("criteris", "json", {
        interface: "input-code",
        width: "full",
        options: { language: "json" },
        note: "Condicions sobre les variables del compte. S'editen des del portal.",
      }, { is_nullable: true }),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}", nota: "Qui l'ha definit." }),
      areaText("notes"),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_zones",
    meta: {
      icon: "map", note: "Zones geogràfiques de venda. Es reparteixen els comptes.",
      display_template: "{{nom}}", sort: 0, color: "#3399FF",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true } }),
      text("codi", { meta: { note: "Abreujament per als llistats." } }),
      llista("estat", ["actiu", "inactiu"], {
        perDefecte: "actiu",
        colors: [{ text: "Actiu", value: "actiu", color: VERD }, { text: "Inactiu", value: "inactiu", color: GRIS }],
      }),
      text("abast", { meta: { width: "full", note: "Què cobreix: comarques, províncies o països." } }),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}", nota: "Qui la porta." }),
      areaText("notes"),
      inversa("comptes", "Els comptes que hi ha en aquesta zona."),
      inversa("leads", "Els leads que hi ha en aquesta zona."),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_tipus_client",
    meta: {
      icon: "category",
      note: "Tipus de client de FactuSol (F_TCL). Els porta la sincronització de clients; aquí només es tria quins fa servir el CRM.",
      display_template: "{{nom}}", sort: 9, color: "#8A2D3F",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true, note: "DESTCL de FactuSol." } }),
      nombre("codi_erp", { meta: { note: "CODTCL de FactuSol: el que desa TCLCLI a la fitxa del client." } }),
      siNo("usat_crm", true, "Es fa servir al CRM: si surt als desplegables del portal."),
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que el tipus s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan el tipus ja no és a FactuSol. Buit si hi és." } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_agents",
    meta: {
      icon: "badge",
      note: "Agents comercials de FactuSol (F_AGE). Els porta la sincronització de clients; cada usuari del portal pot ser-ne un.",
      display_template: "{{nom}}", sort: 10, color: "#8A2D3F",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true, note: "NOMAGE de FactuSol." } }),
      nombre("codi_erp", { meta: { note: "CODAGE de FactuSol: el que desa AGECLI a la fitxa del client." } }),
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que l'agent s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan l'agent ja no és a FactuSol. Buit si hi és." } }),
      ...AUDITORIA,
    ],
  },
  {
    // Col·lecció de sistema: no es crea, només s'hi afegeixen els camps propis del portal.
    collection: "directus_users",
    sistema: true,
    fields: [
      enllac("agent", "crm_agents", { nota: "L'agent comercial de FactuSol que és aquesta persona. Es tria a la pantalla d'Usuaris del portal." }),
      text("telefon", { meta: { note: "El telèfon de contacte d'aquesta persona. Surt al peu de la fulla de vins que treu, amb el seu correu." } }),
    ],
  },
  {
    collection: "crm_clients",
    meta: { icon: "storefront", note: "Comptes que ja compren. El codi_erp els lliga amb FactuSol.", display_template: "{{nom_comercial}}", sort: 2, color: "#8A2D3F" },
    fields: [
      text("nom_comercial", { obligatori: true, meta: { width: "full", required: true } }),
      text("rao_social"), text("nif"),
      enllac("tipus_client", "crm_tipus_client", { nota: "Tipus de client de FactuSol (TCLCLI)." }),
      enllac("agent", "crm_agents", { nota: "Agent comercial de FactuSol (AGECLI)." }),
      llista("estat", ESTAT_CLIENT.map((e) => e.value), { perDefecte: "sense_seleccionar", colors: ESTAT_CLIENT, nota: "ESTCLI de FactuSol." }),
      llista("categoria", LLETRES.map((p) => p.value), {
        colors: LLETRES, meta: { readonly: true },
        nota: "La calcula el portal amb la facturació de l'exercici passat, per les franges de crm_categories. D'A (màxim) a E (mínim).",
      }),
      llista("potencial", LLETRES.map((p) => p.value), { colors: LLETRES, nota: "Potencial comercial que posa qui porta el compte, d'A (màxim) a E (mínim)." }),
      // Enter i no text: així la llista del portal l'ordena de menys a més sovint.
      camp("periodicitat", "integer", {
        interface: "select-dropdown", width: "half", options: { choices: PERIODICITAT_CLIENT },
        note: "Activitats l'any que s'hi volen fer. El portal ho compara amb les fetes enguany.",
      }, { is_nullable: true }),
      enllac("zona", "crm_zones", { inversa: "comptes", nota: "Zona geogràfica de venda." }),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}", nota: "Qui porta el compte." }),
      text("correu"), text("telefon"), text("web"),
      text("adreca", { meta: { width: "full" } }),
      text("poblacio"),
      text("comarca", { meta: { note: "Comarca o divisió equivalent." } }),
      text("provincia"), text("codi_postal"), text("pais"),
      llista("forma_pagament", FORMES_PAGAMENT),
      // Horaris per blocs, amb l'estat de cada dia. Els edita la matriu del
      // portal; en JSON perquè el nombre de blocs per dia no és fix.
      camp("horari_comercial", "json", {
        interface: "input-code", width: "full", options: { language: "json" },
        note: "Quan es pot anar a vendre. S'edita des del portal.",
      }, { is_nullable: true }),
      camp("horari_entregues", "json", {
        interface: "input-code", width: "full", options: { language: "json" },
        note: "Quan es pot entregar. S'edita des del portal.",
      }, { is_nullable: true }),
      nombre("tarifa", { meta: { note: "Llista de preus aplicada (1-6)." } }),
      nombre("codi_erp", { meta: { note: "CODCLI de FactuSol." } }),
      // Per situar el compte al mapa del portal. Les omple la geocodificació,
      // i es poden corregir a mà si el punt no cau on toca.
      coordenada("latitud", "Entre -90 i 90. La pots deixar buida: el portal la calcula de l'adreça."),
      coordenada("longitud", "Entre -180 i 180."),
      data("data_alta"),
      areaText("notes"),
      // Sincronització amb FactuSol. Els omple el portal, no la gent: qui té
      // codi_erp i font «factusol» rep els camps de l'ERP a cada passada.
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      nombre("erp_estat", { meta: { note: "ESTCLI tal com el desa FactuSol.", readonly: true } }),
      text("erp_tipus_client", { meta: { note: "TCLCLI tal com el desa FactuSol, per si F_TCL no el té.", readonly: true } }),
      nombre("erp_agent", { meta: { note: "AGECLI tal com el desa FactuSol, per si F_AGE no el té. 0 és sense agent.", readonly: true } }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que la fitxa s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan el client ja no és a FactuSol. Buit si hi és." } }),
      inversa("contactes"), inversa("activitats"), inversa("oportunitats"),
      // Resum de facturació per a la llista de clients: el calcula la sincronització.
      nombre("facturacio_exercici", { meta: { note: "Any en curs quan es va calcular el resum.", readonly: true } }),
      nombre("facturacio_fins_mes", { meta: { note: "Últim mes tancat del resum: el període va de gener fins aquí.", readonly: true } }),
      facturat("facturacio_any_2", "Exercici sencer de fa dos anys."),
      facturat("facturacio_any_1", "Exercici sencer de l'any passat."),
      facturat("facturacio_periode_2", "Gener fins al mes tancat, de fa dos anys."),
      facturat("facturacio_periode_1", "Gener fins al mes tancat, de l'any passat."),
      facturat("facturacio_periode", "Gener fins al mes tancat, d'enguany."),
      camp("facturacio_variacio", "decimal", {
        interface: "input", width: "half", readonly: true, note: "Variació del període d'enguany respecte del de l'any passat.",
        display: "formatted-value", display_options: { suffix: " %" },
      }, { numeric_precision: 10, numeric_scale: 2, is_nullable: true }),
      llista("facturacio_tendencia", TENDENCIES.map((t) => t.value), { colors: TENDENCIES, meta: { readonly: true }, nota: "Com va respecte de l'any passat." }),
      inversa("facturacio", "Facturació per mes, portada de FactuSol."),
      inversa("establiments", "Els establiments del client: les direccions d'entrega de FactuSol (F_OBR)."),
      inversa("atributs", "El que caracteritza el client, en frases curtes. S'hi posen des de la fitxa o en tancar una activitat."),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_facturacio",
    meta: {
      icon: "receipt_long",
      note: "Facturació dels clients per mes: base imposable de F_FAC, sense IVA, i a l'any en curs també dels albarans de F_ALB encara no facturats. La porta la sincronització de clients; no s'edita.",
      display_template: "{{exercici}}-{{mes}} · {{base}}", sort: 11, color: "#8A2D3F",
    },
    fields: [
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", inversa: "facturacio" }),
      nombre("codi_client_erp", { meta: { note: "CLIFAC de FactuSol.", readonly: true } }),
      nombre("exercici", { meta: { note: "Any de les factures.", readonly: true } }),
      nombre("mes", { meta: { note: "Mes de les factures, de l'1 al 12.", readonly: true } }),
      // Sense mínim: amb rectificatives, un mes pot quedar en negatiu.
      camp("base", "decimal", {
        interface: "input", width: "half", readonly: true, note: "Base imposable del mes, sense IVA. Les rectificatives resten. A l'any en curs hi sumen els albarans encara no facturats.",
        display: "formatted-value", display_options: { suffix: " €" },
      }, { numeric_precision: 12, numeric_scale: 2, is_nullable: false, default_value: 0 }),
      nombre("factures", { meta: { note: "Quantes factures hi ha en aquest mes.", readonly: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que el mes s'ha contrastat amb FactuSol.", readonly: true } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_client_atributs",
    meta: {
      icon: "sell",
      note: "Atributs dels clients: textos curts que el caracteritzen. S'hi posen des de la pestanya Atributs de la fitxa o en tancar una activitat.",
      display_template: "{{text}}", sort: 13, color: "#8A2D3F",
    },
    fields: [
      // Si s'esborra el client, els seus atributs no volen dir res sols.
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", inversa: "atributs", enEsborrar: "CASCADE" }),
      text("text", { obligatori: true, meta: { width: "full", required: true, note: "L'atribut: un text curt." } }),
      enllac("activitat", "crm_activitats", { plantilla: "{{assumpte}}", nota: "L'activitat en què es va apuntar, si va ser en tancar-ne una." }),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}", nota: "Qui el va posar." }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_establiments",
    meta: {
      icon: "storefront",
      note: "Establiments dels clients: les direccions d'entrega de FactuSol (F_OBR). Els porta la sincronització de clients; el mapa els situa.",
      display_template: "{{nom}}", sort: 12, color: "#8A2D3F",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true, note: "NOMOBR de FactuSol." } }),
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", inversa: "establiments" }),
      text("codi_erp", { meta: { note: "Client i número de l'adreça a FactuSol («123-2»). És de text.", readonly: true } }),
      nombre("erp_client", { meta: { note: "CLIOBR de FactuSol: el codi del client.", readonly: true } }),
      nombre("erp_codi", { meta: { note: "CODOBR de FactuSol: el número de l'adreça dins del client.", readonly: true } }),
      text("adreca", { meta: { width: "full" } }),
      text("poblacio"), text("codi_postal"), text("provincia"), text("pais"),
      text("telefon"), text("persona_contacte"), text("correu"),
      siNo("per_reparacions", false, "REPOBR de FactuSol: «dirección de entrega por defecto para la impresión de partes de reparación». Marcada, l'adreça no surt al mapa."),
      // Les omple la ubicació en segon pla, com les dels clients. Si l'adreça
      // canvia a l'ERP, la sincronització les buida perquè es tornin a calcular.
      coordenada("latitud", "La calcula el portal de l'adreça."),
      coordenada("longitud", "La calcula el portal de l'adreça."),
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que l'establiment s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan l'establiment ja no és a FactuSol (o el client és de baixa). Buit si hi és." } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_categories",
    meta: {
      icon: "leaderboard",
      note: "Franges de la categoria dels clients: cada lletra comença a partir de l'import de facturació de l'exercici passat (sense IVA). Es canvien a Configuració › Valors CRM.",
      display_template: "{{lletra}} · {{des_de}}", sort: 12, color: "#2ECDA7",
    },
    fields: [
      llista("lletra", LLETRES.map((p) => p.value), { colors: LLETRES, meta: { required: true } }),
      camp("des_de", "decimal", {
        interface: "input", width: "half", note: "Facturació de l'exercici passat a partir de la qual el client té aquesta lletra.",
        display: "formatted-value", display_options: { suffix: " €" },
      }, { numeric_precision: 12, numeric_scale: 2, is_nullable: false, default_value: 0 }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_tipus_activitat",
    meta: {
      icon: "category",
      note: "Els tipus d'activitat que es poden triar. Es canvien a Configuració › Valors CRM.",
      display_template: "{{nom}}", sort: 12, color: "#2ECDA7",
    },
    fields: [
      text("nom", { obligatori: true, meta: { required: true } }),
      text("valor", {
        obligatori: true,
        meta: { required: true, readonly: true, note: "El que es desa a cada activitat. Surt del nom en crear el tipus i no canvia mai." },
        schema: { is_unique: true },
      }),
      siNo("visita", false, "Compta com a visita al tauler."),
      siNo("amb_vi", false, "L'activitat porta els vins presentats."),
      siNo("amb_celler", false, "L'activitat porta un celler."),
      siNo("actiu", true, "S'ofereix en crear activitats. Les que ja el tenen el conserven igualment."),
      nombre("ordre", { meta: { note: "L'ordre als desplegables." }, schema: { default_value: 100 } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_proveidors",
    meta: {
      icon: "local_shipping",
      note: "Proveïdors i creditors de FactuSol (F_PRO): els cellers de qui es compra. Els manté la sincronització.",
      display_template: "{{nom_comercial}}", sort: 10, color: "#3D7068",
    },
    fields: [
      text("nom_comercial", { obligatori: true, meta: { width: "full", required: true } }),
      text("rao_social"), text("nif"),
      llista("tipus", TIPUS_PROVEIDOR.map((t) => t.value), { perDefecte: "proveidor", colors: TIPUS_PROVEIDOR, nota: "Qui ven mercaderia i qui ven serveis." }),
      llista("estat", ESTAT_PROVEIDOR.map((e) => e.value), { perDefecte: "actiu", colors: ESTAT_PROVEIDOR }),
      text("persona_contacte"),
      text("telefon"), text("mobil"), text("correu"), text("web"),
      text("adreca", { meta: { width: "full" } }),
      text("poblacio"), text("provincia"), text("codi_postal"), text("pais"),
      llista("forma_pagament", FORMES_PAGAMENT, { obert: true, nota: "Tal com la descriu F_FPA." }),
      percentatge("retencio", "Retenció d'IRPF que se li aplica."),
      percentatge("descompte", "Descompte de compra pactat."),
      // Dades de pagament, tal com les porta l'ERP.
      text("iban"), text("bic"), text("banc"),
      text("compte_comptable", { meta: { note: "Compte comptable de l'ERP (600 compres, 62x serveis)." } }),
      nombre("codi_erp", { meta: { note: "CODPRO de FactuSol." } }),
      data("data_alta"),
      data("erp_modificat_el", { meta: { note: "Darrer moviment de la fitxa a FactuSol." } }),
      areaText("observacions", "Observacions escrites a l'ERP."),
      areaText("notes", "Notes del portal. La sincronització no les toca mai."),
      // Sincronització amb FactuSol, igual que als comptes.
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      nombre("erp_estat", { meta: { note: "ESTPRO tal com el desa FactuSol.", readonly: true } }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que la fitxa s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan el proveïdor ja no és a FactuSol. Buit si hi és." } }),
      inversa("activitats", "Visites i accions relacionades amb aquest celler."),
      inversa("articles", "Els articles actius que FactuSol té amb aquest proveïdor habitual."),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_articles",
    meta: {
      icon: "wine_bar",
      note: "Articles de FactuSol (F_ART): els vins. Els manté la sincronització; els descatalogats o no disponibles hi són marcats com a històrics.",
      display_template: "{{nom}}", sort: 11, color: "#3D7068",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true, note: "DESART de FactuSol." } }),
      text("codi_erp", { meta: { note: "CODART de FactuSol. És de text, no un número." } }),
      text("codi_barres", { meta: { note: "EANART de FactuSol." } }),
      text("familia", { meta: { note: "La descripció de la família a F_FAM." } }),
      text("erp_familia", { meta: { note: "FAMART tal com el desa FactuSol.", readonly: true } }),
      enllac("celler", "crm_proveidors", {
        plantilla: "{{nom_comercial}}",
        inversa: "articles",
        nota: "El proveïdor habitual (PHAART), si és un dels cellers homologats.",
      }),
      nombre("erp_proveidor", { meta: { note: "PHAART tal com el desa FactuSol: el codi del proveïdor habitual.", readonly: true } }),
      text("referencia_proveidor", { meta: { note: "REFART: com l'anomena el proveïdor." } }),
      text("garantia", { meta: { note: "GARART de FactuSol." } }),
      // Els cinc camps programables de la fitxa d'article: el títol de cadascun
      // el posa la bodega a FactuSol, i aquí es copien tal qual.
      ...[1, 2, 3, 4, 5].map((n) => text(`camp_programable_${n}`, { meta: { note: `CP${n}ART de FactuSol: camp programable ${n}.` } })),
      data("data_alta"),
      siNo("historic", false, "Descatalogat o no disponible per a l'ús a FactuSol (DSCART o NPUART). Ho posa la sincronització; els catàlegs només l'ensenyen si es demana."),
      imatge("imatge", "La foto de FactuSol. La copia la sincronització quan canvia."),
      text("erp_imatge", { meta: { note: "IMGART de FactuSol: el nom del fitxer de la foto, que porta la data.", readonly: true } }),
      text("imatge_copiada_de", { meta: { note: "L'IMGART de la foto que hi ha copiada. Si no coincideix amb erp_imatge, la propera passada la torna a copiar.", readonly: true, hidden: true } }),
      areaText("notes", "Notes del portal. La sincronització no les toca mai."),
      // Sincronització amb FactuSol, igual que als clients i als proveïdors.
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que l'article s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan l'article ja no és actiu a FactuSol. Buit si ho és." } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_configuracio",
    meta: {
      icon: "settings", note: "Paràmetres del portal que es canvien des de la seva pantalla de Configuració.",
      singleton: true, sort: 20, color: GRIS,
    },
    fields: [
      siNo("sync_clients_activa", false, "Si el portal sincronitza sol els clients de FactuSol."),
      llista("sync_clients_periodicitat", PERIODICITATS, { perDefecte: "1440", nota: "Cada quants minuts es mira si hi ha canvis." }),
      text("sync_clients_hora", { meta: { note: "Hora local (HH:MM) de la passada diària o setmanal." } }),
      siNo("sync_proveidors_activa", false, "Si el portal sincronitza sol els proveïdors de FactuSol."),
      llista("sync_proveidors_periodicitat", PERIODICITATS, { perDefecte: "1440", nota: "Cada quants minuts es mira si hi ha canvis." }),
      text("sync_proveidors_hora", { meta: { note: "Hora local (HH:MM) de la passada diària o setmanal." } }),
      siNo("sync_articles_activa", false, "Si el portal sincronitza sol els articles de FactuSol."),
      llista("sync_articles_periodicitat", PERIODICITATS, { perDefecte: "1440", nota: "Cada quants minuts es mira si hi ha canvis." }),
      text("sync_articles_hora", { meta: { note: "Hora local (HH:MM) de la passada diària o setmanal." } }),
      siNo("sync_albarans_activa", false, "Si el portal sincronitza sol els albarans de FactuSol."),
      llista("sync_albarans_periodicitat", PERIODICITATS, { perDefecte: "1440", nota: "Cada quants minuts es mira si hi ha canvis." }),
      text("sync_albarans_hora", { meta: { note: "Hora local (HH:MM) de la passada diària o setmanal." } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_sync_execucions",
    meta: {
      icon: "sync", note: "Registre de cada sincronització amb FactuSol. L'escriu el portal.",
      display_template: "{{taula}} · {{inici}}", sort: 21, color: GRIS, archive_field: null,
    },
    fields: [
      text("taula", { meta: { note: "Quina taula s'ha sincronitzat: clients, proveïdors, articles o albarans." } }),
      llista("desencadenant", ["manual", "programada"]),
      llista("estat", ESTAT_EXECUCIO.map((e) => e.value), { colors: ESTAT_EXECUCIO }),
      data("inici", { ambHora: true }), data("fi", { ambHora: true }),
      nombre("llegits"), nombre("creats"), nombre("actualitzats"), nombre("absents"), nombre("iguals"),
      areaText("missatge", "Detall de l'error, si n'hi ha hagut."),
      // El seguiment: on és (o on s'ha quedat), quant n'ha fet i què no ha pogut copiar.
      llista("fase", FASE_EXECUCIO, { nota: "La fase on és la passada; si ha fallat, on s'ha quedat." }),
      json("progres", "On era dins de la fase: detall, fets de total i quan va dir res per darrer cop."),
      nombre("fallits", { meta: { note: "Files que Directus no ha acceptat. Les primeres són a «errors»." } }),
      nombre("pendents", { meta: { note: "Files que no han cabut en el temps de la passada i es faran a la següent." } }),
      json("errors", "Les files que no s'han pogut copiar: codi, nom, operació i motiu. Com a molt, cent."),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_leads",
    meta: { icon: "person_search", note: "Possibles clients que encara no compren.", display_template: "{{nom}}", sort: 3, color: "#3399FF" },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true, note: "Nom comercial del negoci." } }),
      text("persona_contacte"), text("carrec"),
      text("correu"), text("telefon"),
      text("poblacio"),
      text("comarca", { meta: { note: "Comarca o divisió equivalent." } }),
      text("provincia"), text("pais"),
      enllac("tipus_client", "crm_tipus_client", { nota: "Els mateixos tipus de client que FactuSol." }),
      enllac("agent", "crm_agents", { nota: "Agent comercial de FactuSol que el porta. Es tria a mà: un lead encara no és a l'ERP." }),
      llista("origen", ORIGENS, { nota: "D'on ha sortit." }),
      enllac("zona", "crm_zones", { inversa: "leads", nota: "Zona geogràfica de venda." }),
      llista("estat", ESTAT_LEAD.map((e) => e.value), { perDefecte: "nou", colors: ESTAT_LEAD }),
      import_("valor_estimat", "Compra anual que se n'espera."),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}" }),
      data("data_alta"), data("data_conversio"),
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", nota: "El compte que ha sortit d'aquest lead, si s'ha convertit." }),
      text("motiu_descart", { meta: { width: "full" } }),
      areaText("notes"),
      // Les tres cares inverses: sense el camp, la relació de l'altra banda
      // apunta al buit i Directus la dona per mal configurada.
      inversa("contactes"), inversa("activitats"), inversa("oportunitats"),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_contactes",
    meta: { icon: "contacts", note: "Persones. Un compte pot tenir-ne diverses.", display_template: "{{nom}} {{cognoms}}", sort: 4, color: "#8866FF" },
    fields: [
      text("nom", { obligatori: true, meta: { required: true } }),
      text("cognoms"), text("carrec"),
      text("correu"), text("telefon"), text("mobil"),
      siNo("principal", false, "Interlocutor de referència del compte."),
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", inversa: "contactes" }),
      enllac("lead", "crm_leads", { inversa: "contactes" }),
      areaText("notes"),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_oportunitats",
    meta: { icon: "trending_up", note: "Embut de venda: què hi ha obert i en quina etapa.", display_template: "{{titol}}", sort: 5, color: "#FFC23B" },
    fields: [
      text("titol", { obligatori: true, meta: { width: "full", required: true } }),
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", inversa: "oportunitats" }),
      enllac("lead", "crm_leads", { inversa: "oportunitats" }),
      enllac("tipus_client", "crm_tipus_client", { nota: "Els mateixos tipus de client que FactuSol." }),
      llista("etapa", ETAPES.map((e) => e.value), { perDefecte: "contacte", colors: ETAPES }),
      nombre("probabilitat", { meta: { note: "Percentatge d'encert estimat.", options: { min: 0, max: 100 } } }),
      nombre("etapa_assolida", { meta: { note: "Fins a quina etapa va arribar. D'una perduda, sense això, no se'n sap el recorregut." } }),
      import_("valor"),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}" }),
      data("data_obertura"), data("tancament_previst"), data("data_tancament"),
      llista("motiu_perdua", ["Preu", "Competència", "Sense pressupost", "No respon", "Producte no encaixa", "Altres"], { obert: true }),
      areaText("notes"),
      inversa("activitats"),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_activitats",
    meta: { icon: "event_note", note: "Tota l'acció comercial: trucades, visites i visites al celler.", display_template: "{{tipus}} · {{assumpte}}", sort: 6, color: "#2ECDA7", archive_field: null },
    fields: [
      // Obert: els tipus es creen a Configuració, i aquesta llista només porta els de partida.
      llista("tipus", TIPUS_ACTIVITAT.map((t) => t.value), { perDefecte: "trucada", obert: true, colors: TIPUS_ACTIVITAT, meta: { width: "half", required: true } }),
      data("data", { ambHora: true, meta: { required: true, note: "Quan ha passat." } }),
      text("assumpte", { obligatori: true, meta: { width: "full", required: true } }),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}", nota: "Qui l'ha feta." }),
      nombre("durada_minuts"),
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", inversa: "activitats" }),
      enllac("lead", "crm_leads", { inversa: "activitats" }),
      enllac("agent", "crm_agents", { nota: "L'agent del client o del lead. El posa el portal en desar; no es tria." }),
      enllac("contacte", "crm_contactes", { plantilla: "{{nom}} {{cognoms}}" }),
      enllac("oportunitat", "crm_oportunitats", { plantilla: "{{titol}}", inversa: "activitats" }),
      enllac("celler", "crm_proveidors", {
        plantilla: "{{nom_comercial}}",
        inversa: "activitats",
        nota: "Quin celler ha anat al client, o a quin celler han anat els clients.",
        condicions: [{ name: "Només si hi ha un celler pel mig", rule: { tipus: { _in: AMB_CELLER } }, hidden: false, required: false }],
        meta: { hidden: true },
      }),
      camp("referencies", "text", {
        interface: "input-multiline", width: "full",
        note: "Text lliure d'abans. Els vins ara es trien del catàleg, a «vins».",
        hidden: true,
        conditions: nomesSiTeVi("Només si hi ha vi pel mig"),
      }),
      inversa("vins", "Els vins presentats o tastats, triats del catàleg d'articles."),
      nombre("assistents", {
        meta: {
          note: "Persones del client que hi han anat.", hidden: true,
          conditions: [{ name: "Només a les visites al celler", rule: { tipus: { _eq: "visita_celler" } }, hidden: false }],
        },
      }),
      text("grup", { meta: { note: "Les activitats d'una mateixa visita de clients al celler porten el mateix grup.", readonly: true, hidden: true } }),
      import_("cost", "Cost de l'activitat: mostres, desplaçament, àpat."),
      llista("resultat", ["Pendent", "Positiu", "Neutre", "Negatiu", "Sense resposta"], {
        perDefecte: "Pendent",
        colors: [
          { text: "Pendent", value: "Pendent", color: GRIS },
          { text: "Positiu", value: "Positiu", color: VERD },
          { text: "Neutre", value: "Neutre", color: BLAU },
          { text: "Negatiu", value: "Negatiu", color: VERMELL },
          { text: "Sense resposta", value: "Sense resposta", color: GROC },
        ],
      }),
      areaText("resum"),
      imatge("foto", "Una foto de l'activitat, feta o triada des del portal."),
      text("proper_pas", { meta: { width: "full" } }),
      data("data_proper_pas"),
      inversa("tasques"),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_tasques",
    meta: { icon: "task_alt", note: "El que queda per fer, amb venciment.", display_template: "{{titol}}", sort: 7, color: "#FF9F43" },
    fields: [
      text("titol", { obligatori: true, meta: { width: "full", required: true } }),
      areaText("descripcio"),
      data("venciment"),
      llista("estat", ["pendent", "feta", "cancellada"], {
        perDefecte: "pendent",
        colors: [
          { text: "Pendent", value: "pendent", color: GROC },
          { text: "Feta", value: "feta", color: VERD },
          { text: "Cancel·lada", value: "cancellada", color: GRIS },
        ],
      }),
      llista("prioritat", ["baixa", "normal", "alta"], {
        perDefecte: "normal",
        colors: [
          { text: "Baixa", value: "baixa", color: GRIS },
          { text: "Normal", value: "normal", color: BLAU },
          { text: "Alta", value: "alta", color: VERMELL },
        ],
      }),
      enllac("responsable", "directus_users", { plantilla: "{{first_name}} {{last_name}}" }),
      enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}" }),
      enllac("lead", "crm_leads"),
      enllac("oportunitat", "crm_oportunitats", { plantilla: "{{titol}}" }),
      enllac("activitat", "crm_activitats", { plantilla: "{{assumpte}}", inversa: "tasques" }),
      data("completada_el", { ambHora: true }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_activitats_vins",
    meta: {
      icon: "wine_bar",
      note: "Els vins presentats o tastats en cada activitat: una fila per vi. Les manté el portal en desar l'activitat.",
      display_template: "{{article.nom}}", sort: 12, color: "#8C2F45",
    },
    fields: [
      enllac("activitat", "crm_activitats", { plantilla: "{{assumpte}}", inversa: "vins", enEsborrar: "CASCADE" }),
      enllac("article", "crm_articles", { plantilla: "{{nom}}", enEsborrar: "CASCADE" }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_plantilles_vins",
    meta: {
      icon: "shopping_basket",
      note: "Plantilles del selector de vins: una cistella desada amb nom, els criteris amb què es va fer i una línia per vi. Les escriu el portal.",
      display_template: "{{nom}}", sort: 15, color: "#8C2F45",
    },
    fields: [
      text("nom", { obligatori: true, meta: { width: "full", required: true } }),
      areaText("descripcio", "Per a què és aquesta selecció."),
      enllac("comercial", "directus_users", { plantilla: "{{first_name}} {{last_name}}", nota: "Qui la va desar." }),
      json("criteris", "Els criteris de selecció amb què es va fer: la cerca, «només amb foto» i els valors triats de cada característica."),
      inversa("linies", "Els vins de la plantilla, amb la quantitat."),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_plantilles_vins_linies",
    meta: {
      icon: "wine_bar",
      note: "Els vins de cada plantilla del selector: una fila per vi, amb la quantitat i l'ordre dins de la cistella.",
      display_template: "{{article.nom}} × {{quantitat}}", sort: 16, color: "#8C2F45",
    },
    fields: [
      enllac("plantilla", "crm_plantilles_vins", { plantilla: "{{nom}}", inversa: "linies", enEsborrar: "CASCADE" }),
      enllac("article", "crm_articles", { plantilla: "{{nom}}", enEsborrar: "CASCADE" }),
      nombre("quantitat", { meta: { note: "Ampolles." }, schema: { default_value: 1 } }),
      nombre("ordre", { meta: { note: "La posició dins de la cistella." } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_albarans",
    meta: {
      icon: "local_shipping",
      note: "Albarans de venda de FactuSol (F_ALB) d'aquest exercici i del passat, dels clients del CRM. Els manté la sincronització.",
      display_template: "{{serie}}/{{numero}} · {{data}}", sort: 13, color: "#8A2D3F",
      // Còpia de l'ERP, de milers de files: vegeu SENSE_HISTORIAL.
      accountability: null,
    },
    fields: [
      text("codi_erp", { meta: { note: "Exercici, sèrie i número: «2026-1-345». El número només és únic dins de l'exercici." } }),
      nombre("exercici"),
      text("serie", { meta: { note: "TIPALB de FactuSol." } }),
      nombre("numero", { meta: { note: "CODALB de FactuSol." } }),
      data("data"),
      ambIndex(enllac("client", "crm_clients", { plantilla: "{{nom_comercial}}", nota: "El client (CLIALB). Només se'n copien dels que surten al CRM." })),
      nombre("erp_client", { meta: { note: "CLIALB tal com el desa FactuSol.", readonly: true } }),
      nombre("erp_estat", { meta: { note: "ESTALB tal com el desa FactuSol.", readonly: true } }),
      inversa("linies", "Les línies de l'albarà."),
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que l'albarà s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan l'albarà ja no és a FactuSol, o el client ja no surt al CRM. Buit si hi és." } }),
      ...AUDITORIA,
    ],
  },
  {
    collection: "crm_albarans_linies",
    meta: {
      icon: "receipt_long",
      note: "Línies dels albarans de venda de FactuSol (F_LAL). Les manté la sincronització d'albarans.",
      display_template: "{{descripcio}}", sort: 14, color: "#8A2D3F",
      accountability: null,
    },
    fields: [
      text("codi_erp", { meta: { note: "El codi de l'albarà i la posició: «2026-1-345-3»." } }),
      ambIndex(enllac("albara", "crm_albarans", { plantilla: "{{serie}}/{{numero}}", inversa: "linies", enEsborrar: "CASCADE" })),
      nombre("posicio", { meta: { note: "POSLAL: l'ordre dins de l'albarà." } }),
      enllac("article", "crm_articles", { plantilla: "{{nom}}", nota: "L'article (ARTLAL), si és a la còpia (també els històrics)." }),
      text("erp_article", { meta: { note: "ARTLAL tal com el desa FactuSol.", readonly: true } }),
      text("descripcio", { meta: { width: "full", note: "DESLAL: el que diu la línia a l'albarà." } }),
      xifraErp("quantitat", 3, "CANLAL."),
      xifraErp("preu", 4, "PRELAL: preu unitari, sense IVA.", " €"),
      percentatge("descompte", "DT1LAL."),
      xifraErp("import", 2, "TOTLAL: import de la línia, sense IVA.", " €"),
      llista("font", FONTS.map((f) => f.value), { perDefecte: "portal", colors: FONTS, nota: "D'on ve la fitxa. Les de FactuSol es sobreescriuen amb l'ERP." }),
      text("erp_empremta", { meta: { note: "Resum dels camps de l'ERP a la darrera sincronització.", readonly: true, hidden: true } }),
      data("erp_sincronitzat_el", { ambHora: true, meta: { note: "Darrer cop que la línia s'ha contrastat amb FactuSol.", readonly: true } }),
      data("erp_absent_des_de", { meta: { note: "Des de quan la línia ja no és a FactuSol. Buit si hi és." } }),
      ...AUDITORIA,
    ],
  },
];

// ------------------------------------------------------------------ execució
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
  if (!resposta.ok) {
    const detall = cos?.errors?.[0]?.message ?? `HTTP ${resposta.status}`;
    const error = new Error(detall);
    error.estat = resposta.status;
    throw error;
  }
  return cos;
}

/**
 * Es prefereix un testimoni estàtic: per a automatismes és millor que la
 * contrasenya d'una persona, que pot canviar en qualsevol moment.
 */
async function entra() {
  if (TESTIMONI_ESTATIC) {
    testimoni = TESTIMONI_ESTATIC;
    await api("/users/me?fields=email");
    return;
  }
  const { data } = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: CORREU, password: CONTRASENYA, mode: "json" }),
  });
  testimoni = data.access_token;
}

const PK = {
  field: "id",
  type: "uuid",
  meta: { hidden: true, readonly: true, interface: "input", special: ["uuid"] },
  schema: { is_primary_key: true, length: 36, has_auto_increment: false },
};

async function provisiona() {
  const creat = { colleccions: 0, camps: 0, relacions: 0 };

  // 1. La carpeta que agrupa tot el CRM a la barra lateral.
  const existents = new Set((await api("/collections")).data.map((c) => c.collection));
  if (!existents.has("crm")) {
    await api("/collections", {
      method: "POST",
      body: JSON.stringify({ collection: "crm", meta: { icon: "hub", note: "CRM comercial", sort: 1 }, schema: null }),
    });
    existents.add("crm");
    creat.colleccions += 1;
    console.log("carpeta  crm");
  }

  // 2. Col·leccions.
  for (const { collection, meta, sistema } of MODEL) {
    if (sistema) continue;
    if (existents.has(collection)) {
      console.log(`ja hi és ${collection}`);
      continue;
    }
    await api("/collections", {
      method: "POST",
      body: JSON.stringify({ collection, meta: { ...meta, group: "crm" }, schema: {}, fields: [PK] }),
    });
    creat.colleccions += 1;
    console.log(`creada   ${collection}`);
  }

  // 3. Camps.
  for (const { collection, fields } of MODEL) {
    const teCamp = new Set((await api(`/fields/${collection}`)).data.map((f) => f.field));
    for (const [ordre, definicio] of fields.entries()) {
      if (teCamp.has(definicio.field)) continue;
      const { _relacio, ...cos } = definicio;
      await api(`/fields/${collection}`, {
        method: "POST",
        body: JSON.stringify({ ...cos, meta: { ...cos.meta, sort: ordre + 2 } }),
      });
      creat.camps += 1;
    }
  }
  console.log(`camps creats: ${creat.camps}`);

  // 4. Relacions (després dels camps, perquè les dues cares ja existeixin).
  const relacions = (await api("/relations")).data;
  const jaRelacionat = new Set(relacions.map((r) => `${r.collection}.${r.field}`));
  for (const { collection, fields } of MODEL) {
    for (const definicio of fields) {
      if (!definicio._relacio) continue;
      if (jaRelacionat.has(`${collection}.${definicio.field}`)) continue;
      await api("/relations", {
        method: "POST",
        body: JSON.stringify({
          collection,
          field: definicio.field,
          related_collection: definicio._relacio.related_collection,
          meta: {
            one_field: definicio._relacio.one_field,
            one_deselect_action: definicio._relacio.on_delete === "CASCADE" ? "delete" : "nullify",
            sort_field: null,
          },
          schema: { on_delete: definicio._relacio.on_delete ?? "SET NULL" },
        }),
      });
      creat.relacions += 1;
    }
  }
  console.log(`relacions creades: ${creat.relacions}`);

  // 5. Retocs a camps que ja existien. La forma de pagament arriba de
  // FactuSol amb la descripció de F_FPA, que no és cap de les cinc de la
  // llista: el desplegable ha d'admetre valors lliures.
  const formaPagament = (await api("/fields/crm_clients/forma_pagament")).data;
  if (formaPagament && !formaPagament.meta?.options?.allowOther) {
    await api("/fields/crm_clients/forma_pagament", {
      method: "PATCH",
      body: JSON.stringify({ meta: { options: { ...(formaPagament.meta?.options ?? {}), allowOther: true } } }),
    });
    console.log("forma_pagament admet valors lliures");
  }

  // El tipus d'una activitat, igual: se'n poden crear de nous a Configuració.
  const tipusDActivitat = (await api("/fields/crm_activitats/tipus")).data;
  if (tipusDActivitat && !tipusDActivitat.meta?.options?.allowOther) {
    await api("/fields/crm_activitats/tipus", {
      method: "PATCH",
      body: JSON.stringify({ meta: { options: { ...(tipusDActivitat.meta?.options ?? {}), allowOther: true } } }),
    });
    console.log("el tipus d'activitat admet valors lliures");
  }

  // 5-bis. L'estat del registre de sincronització va guanyar «parcial» (acabada
  // amb files sense copiar): si el desplegable ja existia sense, s'hi afegeix.
  const estatExecucio = (await api("/fields/crm_sync_execucions/estat")).data;
  const opcionsEstat = estatExecucio?.meta?.options?.choices ?? [];
  if (estatExecucio && !opcionsEstat.some((opcio) => opcio.value === "parcial")) {
    await api("/fields/crm_sync_execucions/estat", {
      method: "PATCH",
      body: JSON.stringify({
        meta: {
          options: { ...(estatExecucio.meta?.options ?? {}), choices: tria(ESTAT_EXECUCIO.map((e) => e.value)) },
          display: "labels",
          display_options: { choices: etiquetes(ESTAT_EXECUCIO), showAsDot: false },
        },
      }),
    });
    console.log("l'estat de les sincronitzacions admet «parcial»");
  }

  // 5a. Sense historial a les còpies grosses de l'ERP. Per cada fila, Directus
  // hi desa una activitat i una revisió: a desenes de milers de línies d'albarà
  // doblaven el temps de cada escriptura, i la història ja és a FactuSol.
  for (const collection of SENSE_HISTORIAL) {
    const actual = (await api(`/collections/${collection}`)).data;
    if (actual?.meta && actual.meta.accountability !== null) {
      await api(`/collections/${collection}`, { method: "PATCH", body: JSON.stringify({ meta: { accountability: null } }) });
      console.log(`sense historial ${collection}`);
    }
  }

  // 5b. Les carpetes de les fotos, perquè no vagin a l'arrel de la biblioteca.
  for (const carpeta of [CARPETA_FOTOS_ARTICLES, CARPETA_FOTOS_ACTIVITATS]) {
    const carpetes = (await api(`/folders?fields=id&filter[name][_eq]=${encodeURIComponent(carpeta)}`)).data;
    if (carpetes.length === 0) {
      await api("/folders", { method: "POST", body: JSON.stringify({ name: carpeta }) });
      console.log(`carpeta de fitxers «${carpeta}»`);
    }
  }

  // 6. Valors de partida de les taules de configuració, només si són buides:
  // un cop hi ha res, mana el que s'hi hagi desat. Les franges abans vivien a
  // `crm_potencial` (quan el que ara és la categoria es deia potencial): si
  // encara hi són, es passen tal qual i la taula vella s'esborra.
  const tipusDesats = (await api("/items/crm_tipus_activitat?fields=id&limit=1")).data;
  if (tipusDesats.length === 0) {
    await api("/items/crm_tipus_activitat", {
      method: "POST",
      body: JSON.stringify(TIPUS_ACTIVITAT.map(({ text: nom, value: valor }, posicio) => ({
        nom, valor, visita: valor.startsWith("visita"), amb_vi: AMB_VI.includes(valor), amb_celler: AMB_CELLER.includes(valor), actiu: true, ordre: (posicio + 1) * 10,
      }))),
    });
    console.log("tipus d'activitat de partida");
  }
  const franges = (await api("/items/crm_categories?fields=id&limit=1")).data;
  if (franges.length === 0) {
    const velles = existents.has("crm_potencial")
      ? (await api("/items/crm_potencial?fields=lletra,des_de&limit=-1")).data
      : [];
    await api("/items/crm_categories", { method: "POST", body: JSON.stringify(velles.length > 0 ? velles : FRANGES_CATEGORIA) });
    console.log(velles.length > 0 ? "franges de categoria passades de crm_potencial" : "franges de categoria de partida");
  }
  if (existents.has("crm_potencial")) {
    await api("/collections/crm_potencial", { method: "DELETE" });
    console.log("esborrada crm_potencial (ara és crm_categories)");
  }

  // 7. La categoria de cada client. Fins ara es desava al camp `potencial`,
  // que passa a ser manual: el que hi ha és la lletra calculada, així que la
  // categoria en surt tal qual. El potencial no es toca; el posarà cadascú.
  const senseCategoria = (await api("/items/crm_clients?fields=id,potencial&limit=-1&filter[categoria][_null]=true&filter[potencial][_nnull]=true")).data;
  for (let i = 0; i < senseCategoria.length; i += 100) {
    const lot = senseCategoria.slice(i, i + 100);
    await api("/items/crm_clients", {
      method: "PATCH",
      body: JSON.stringify(lot.map((c) => ({ id: c.id, categoria: c.potencial }))),
    });
  }
  if (senseCategoria.length > 0) console.log(`categoria copiada del potencial a ${senseCategoria.length} clients`);
  return creat;
}

await entra();
const resum = await provisiona();
console.log(`\n✓ CRM llest: ${resum.colleccions} col·leccions, ${resum.camps} camps i ${resum.relacions} relacions de nou.`);
