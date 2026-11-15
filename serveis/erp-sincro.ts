/**
 * La sincronització amb vprooferp (ERPNext): de l'ERP cap al CRM, en una sola
 * direcció. Cada passada porta, en aquest ordre (cada pas apunta a l'anterior):
 *
 *   1. grups de client     → tipus de client      (Customer Group)
 *   2. comercials          → agents comercials    (Sales Person)
 *   3. proveïdors          → laboratoris          (Supplier)
 *   4. clients             → clients              (Customer, amb l'adreça principal i el comercial)
 *   5. adreces d'entrega   → establiments         (Address lligades a un client)
 *   6. articles            → productes            (Item, amb el preu de venda, l'estoc i la foto)
 *   7. albarans de venda   → albarans i línies    (Delivery Note, d'aquest exercici i del passat)
 *   8. factures de venda   → facturació mensual   (Sales Invoice, tres exercicis) i resum de cada client
 *
 * Un pas que falla no atura els següents: es diu al resultat. El que és només
 * del CRM (potencial, periodicitat, notes, horaris, comercial del CRM…) no es
 * toca mai. Les fitxes que l'ERP ja no porta queden marcades com a absents.
 */
import "server-only";

import { actualitzaCamps, idPerCamp, idsPerErpId, importa, valorsPerErpId, type FilaImportada, type ResultatImportacio } from "@/apis/sqlite/importa";
import { creaItem, actualitzaItem, llistaAmbTotal } from "@/apis/sqlite/crm";
import { pujaFitxer } from "@/apis/sqlite/crm";
import { baixaFitxer, llistaTot, usuariConnectat, type ConfigErp } from "@/apis/vprooferp";
import { configuracioErp } from "@/serveis/erp";
import { senseAbast } from "@/lib/abast-actual";
import { recalculaResumsDeClients } from "@/serveis/facturacio";

// ------------------------------------------------------------------ tipus de l'ERP

type GrupClient = { name: string; customer_group_name: string | null; is_group: 0 | 1 };
type Comercial = { name: string; sales_person_name: string | null; enabled: 0 | 1; is_group: 0 | 1 };
type Proveidor = {
  name: string; supplier_name: string | null; supplier_group: string | null; tax_id: string | null; disabled: 0 | 1;
  country: string | null; email_id: string | null; mobile_no: string | null; website: string | null; supplier_primary_address: string | null;
};
type Client = {
  name: string; customer_name: string | null; customer_group: string | null; territory: string | null; tax_id: string | null;
  disabled: 0 | 1; email_id: string | null; mobile_no: string | null; website: string | null; customer_primary_address: string | null;
  payment_terms: string | null; creation: string | null;
};
type EquipVendes = { parent: string; sales_person: string | null; idx: number };
type Adreca = {
  name: string; address_title: string | null; address_line1: string | null; address_line2: string | null; city: string | null;
  county: string | null; state: string | null; pincode: string | null; country: string | null; phone: string | null; email_id: string | null;
  is_primary_address: 0 | 1; is_shipping_address: 0 | 1; disabled: 0 | 1;
};
type EnllacDinamic = { parent: string; link_doctype: string; link_name: string };
type Article = {
  name: string; item_name: string | null; item_group: string | null; brand: string | null; disabled: 0 | 1; is_sales_item: 0 | 1;
  image: string | null; creation: string | null; stock_uom: string | null;
};
type ArticleDefecte = { parent: string; default_supplier: string | null };
type ArticleProveidor = { parent: string; supplier: string | null; supplier_part_no: string | null; idx: number };
type PreuArticle = { item_code: string; price_list: string; price_list_rate: number };
type Magatzem = { item_code: string; actual_qty: number; reserved_qty: number };
type Albara = { name: string; customer: string | null; posting_date: string | null; naming_series: string | null };
type LiniaAlbara = {
  name: string; parent: string; idx: number; item_code: string | null; item_name: string | null; qty: number;
  net_rate: number | null; rate: number | null; discount_percentage: number | null; net_amount: number | null; amount: number | null;
};
type Factura = { name: string; customer: string | null; posting_date: string | null; base_net_total: number | null };

// ------------------------------------------------------------------ ajudes

const net = (valor: string | null | undefined) => (valor ?? "").trim() || null;

/** Els països arriben en anglès de l'ERP. Els d'aquí, en català; la resta, tal qual. */
const PAISOS: Record<string, string> = {
  spain: "Espanya", france: "França", andorra: "Andorra", portugal: "Portugal", italy: "Itàlia", germany: "Alemanya",
  "united kingdom": "Regne Unit", belgium: "Bèlgica", netherlands: "Països Baixos", switzerland: "Suïssa",
};
const pais = (valor: string | null) => (valor ? (PAISOS[valor.trim().toLowerCase()] ?? valor.trim()) : null);

function adrecaDe(adreca: Adreca | undefined) {
  if (!adreca) return {};
  return {
    adreca: [net(adreca.address_line1), net(adreca.address_line2)].filter(Boolean).join(", ") || null,
    poblacio: net(adreca.city),
    codi_postal: net(adreca.pincode),
    provincia: net(adreca.state) ?? net(adreca.county),
    pais: pais(adreca.country),
  };
}

/** El número d'un document de l'ERP: «MAT-DN-2026-00042» → 42. La sèrie, el que va davant. */
function numeroDeDocument(nom: string) {
  const parts = /^(.*?)(\d+)$/.exec(nom);
  return parts ? { serie: parts[1].replace(/[-/.\s]+$/, "") || null, numero: Number(parts[2]) } : { serie: nom, numero: null };
}

const anyActual = () => new Date().getFullYear();

// ------------------------------------------------------------------ passos

type Pas = { clau: string; nom: string; fes: (erp: ConfigErp, llistaPreus: string | null) => Promise<ResultatImportacio & { nota?: string }> };

async function grupsDeClient(erp: ConfigErp) {
  const grups = await llistaTot<GrupClient>(erp, "Customer Group", { camps: ["name", "customer_group_name", "is_group"] });
  const files: FilaImportada[] = grups
    .filter((grup) => !grup.is_group)
    .map((grup) => ({ erp_id: grup.name, nom: net(grup.customer_group_name) ?? grup.name, codi_erp: grup.name, usat_crm: true }));
  return importa("crm_tipus_client", files, {
    adopta: (fila) => idPerCamp("crm_tipus_client", "nom", fila.nom),
    nomesEnCrear: ["usat_crm"],
  });
}

async function comercials(erp: ConfigErp) {
  const persones = await llistaTot<Comercial>(erp, "Sales Person", { camps: ["name", "sales_person_name", "enabled", "is_group"] });
  const files: FilaImportada[] = persones
    .filter((persona) => !persona.is_group)
    .map((persona) => ({ erp_id: persona.name, nom: net(persona.sales_person_name) ?? persona.name, codi_erp: persona.name }));
  return importa("crm_agents", files, { adopta: (fila) => idPerCamp("crm_agents", "nom", fila.nom) });
}

async function adrecesPerNom(erp: ConfigErp, noms: string[]) {
  const unics = [...new Set(noms.filter(Boolean))];
  const perNom = new Map<string, Adreca>();
  for (let i = 0; i < unics.length; i += 100) {
    const tros = unics.slice(i, i + 100);
    const files = await llistaTot<Adreca>(erp, "Address", { camps: CAMPS_ADRECA, filtres: [["name", "in", tros]] });
    for (const adreca of files) perNom.set(adreca.name, adreca);
  }
  return perNom;
}

const CAMPS_ADRECA = [
  "name", "address_title", "address_line1", "address_line2", "city", "county", "state", "pincode", "country", "phone", "email_id",
  "is_primary_address", "is_shipping_address", "disabled",
];

async function laboratoris(erp: ConfigErp) {
  const proveidors = await llistaTot<Proveidor>(erp, "Supplier", {
    camps: ["name", "supplier_name", "supplier_group", "tax_id", "disabled", "country", "email_id", "mobile_no", "website", "supplier_primary_address"],
  });
  const adreces = await adrecesPerNom(erp, proveidors.map((p) => p.supplier_primary_address ?? ""));
  const files: FilaImportada[] = proveidors.map((p) => {
    const adreca = adreces.get(p.supplier_primary_address ?? "");
    return {
      erp_id: p.name,
      codi_erp: p.name,
      nom_comercial: net(p.supplier_name) ?? p.name,
      rao_social: net(p.supplier_name),
      nif: net(p.tax_id),
      tipus: "proveidor",
      estat: p.disabled ? "baixa" : "actiu",
      correu: net(p.email_id) ?? net(adreca?.email_id),
      telefon: net(p.mobile_no) ?? net(adreca?.phone),
      web: net(p.website),
      ...adrecaDe(adreca),
      ...(adreca ? {} : { pais: pais(p.country) }),
    };
  });
  return importa("crm_proveidors", files, {
    adopta: (fila) => idPerCamp("crm_proveidors", "nif", fila.nif) ?? idPerCamp("crm_proveidors", "nom_comercial", fila.nom_comercial),
  });
}

async function clients(erp: ConfigErp) {
  const llista = await llistaTot<Client>(erp, "Customer", {
    camps: ["name", "customer_name", "customer_group", "territory", "tax_id", "disabled", "email_id", "mobile_no", "website", "customer_primary_address", "payment_terms", "creation"],
  });
  const [adreces, equips] = await Promise.all([
    adrecesPerNom(erp, llista.map((c) => c.customer_primary_address ?? "")),
    llistaTot<EquipVendes>(erp, "Sales Team", { camps: ["parent", "sales_person", "idx"], pare: "Customer", ordre: "idx asc" }).catch(() => [] as EquipVendes[]),
  ]);
  const comercialDe = new Map<string, string>();
  for (const equip of equips) if (equip.sales_person && !comercialDe.has(equip.parent)) comercialDe.set(equip.parent, equip.sales_person);
  const tipus = idsPerErpId("crm_tipus_client");
  const agents = idsPerErpId("crm_agents");

  const files: FilaImportada[] = llista.map((c) => {
    const adreca = adreces.get(c.customer_primary_address ?? "");
    const agent = comercialDe.get(c.name);
    return {
      erp_id: c.name,
      codi_erp: c.name,
      nom_comercial: net(c.customer_name) ?? c.name,
      rao_social: net(c.customer_name),
      nif: net(c.tax_id),
      tipus_client: c.customer_group ? (tipus.get(c.customer_group) ?? null) : null,
      erp_tipus_client: net(c.customer_group),
      // L'agent només si l'ERP en porta: si no, el que s'hi hagi posat al CRM es queda.
      ...(agent ? { agent: agents.get(agent) ?? undefined } : {}),
      // Inactiu a l'ERP és baixa; si torna a estar actiu, deixa de ser-ho. La resta d'estats els posa el CRM.
      estat: (actual: unknown) => (c.disabled ? "baixa" : actual === "baixa" || !actual || actual === "sense_seleccionar" ? "habitual" : actual),
      correu: net(c.email_id) ?? net(adreca?.email_id),
      telefon: net(c.mobile_no) ?? net(adreca?.phone),
      web: net(c.website),
      forma_pagament: net(c.payment_terms),
      data_alta: c.creation?.slice(0, 10) ?? null,
      ...adrecaDe(adreca),
    };
  });
  return importa("crm_clients", files, {
    adopta: (fila) => idPerCamp("crm_clients", "nif", fila.nif),
    // Si l'adreça canvia, les coordenades es tornen a calcular.
    quanCanvia: { camps: ["adreca", "poblacio", "codi_postal", "provincia", "pais"], buida: ["latitud", "longitud"] },
  });
}

async function establiments(erp: ConfigErp) {
  const enllacos = await llistaTot<EnllacDinamic>(erp, "Dynamic Link", {
    camps: ["parent", "link_doctype", "link_name"],
    pare: "Address",
    filtres: [["link_doctype", "=", "Customer"]],
  });
  const adreces = await adrecesPerNom(erp, enllacos.map((e) => e.parent));
  const clients = idsPerErpId("crm_clients");
  const files: FilaImportada[] = [];
  for (const enllac of enllacos) {
    const adreca = adreces.get(enllac.parent);
    const client = clients.get(enllac.link_name);
    // Les d'entrega, i no la principal de facturació (que ja és la del client).
    if (!adreca || !client || adreca.disabled || (!adreca.is_shipping_address && adreca.is_primary_address)) continue;
    files.push({
      erp_id: `${enllac.parent}|${enllac.link_name}`,
      codi_erp: enllac.parent,
      client,
      nom: net(adreca.address_title) ?? enllac.parent,
      telefon: net(adreca.phone),
      correu: net(adreca.email_id),
      ...adrecaDe(adreca),
    });
  }
  return importa("crm_establiments", files, {
    quanCanvia: { camps: ["adreca", "poblacio", "codi_postal", "provincia", "pais"], buida: ["latitud", "longitud"] },
  });
}

/** La llista de preus de venda: la de Configuració, o «Standard Selling», o la que més articles té. */
function triaLlistaDePreus(preus: PreuArticle[], volguda: string | null) {
  if (volguda) return volguda;
  const quantes = new Map<string, number>();
  for (const preu of preus) quantes.set(preu.price_list, (quantes.get(preu.price_list) ?? 0) + 1);
  if (quantes.has("Standard Selling")) return "Standard Selling";
  return [...quantes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const FOTOS_PER_PASSADA = 60;

async function productes(erp: ConfigErp, llistaPreus: string | null) {
  const [articles, defectes, proveidorsArticle, preus, estocs] = await Promise.all([
    llistaTot<Article>(erp, "Item", { camps: ["name", "item_name", "item_group", "brand", "disabled", "is_sales_item", "image", "creation", "stock_uom"] }),
    llistaTot<ArticleDefecte>(erp, "Item Default", { camps: ["parent", "default_supplier"], pare: "Item" }).catch(() => [] as ArticleDefecte[]),
    llistaTot<ArticleProveidor>(erp, "Item Supplier", { camps: ["parent", "supplier", "supplier_part_no", "idx"], pare: "Item", ordre: "idx asc" }).catch(
      () => [] as ArticleProveidor[],
    ),
    llistaTot<PreuArticle>(erp, "Item Price", { camps: ["item_code", "price_list", "price_list_rate"], filtres: [["selling", "=", 1]] }),
    llistaTot<Magatzem>(erp, "Bin", { camps: ["item_code", "actual_qty", "reserved_qty"] }),
  ]);
  const laboratoris = idsPerErpId("crm_proveidors");
  const proveidorDe = new Map<string, { supplier: string; referencia: string | null }>();
  for (const fila of defectes) if (fila.default_supplier && !proveidorDe.has(fila.parent)) proveidorDe.set(fila.parent, { supplier: fila.default_supplier, referencia: null });
  for (const fila of proveidorsArticle) {
    if (!fila.supplier) continue;
    const previ = proveidorDe.get(fila.parent);
    if (!previ) proveidorDe.set(fila.parent, { supplier: fila.supplier, referencia: net(fila.supplier_part_no) });
    else if (previ.supplier === fila.supplier && !previ.referencia) previ.referencia = net(fila.supplier_part_no);
  }
  const llista = triaLlistaDePreus(preus, llistaPreus);
  const preuDe = new Map(preus.filter((p) => p.price_list === llista).map((p) => [p.item_code, p.price_list_rate]));
  const estocDe = new Map<string, { actual: number; disponible: number }>();
  for (const bin of estocs) {
    const estoc = estocDe.get(bin.item_code) ?? { actual: 0, disponible: 0 };
    estoc.actual += Number(bin.actual_qty) || 0;
    estoc.disponible += (Number(bin.actual_qty) || 0) - (Number(bin.reserved_qty) || 0);
    estocDe.set(bin.item_code, estoc);
  }

  const files: FilaImportada[] = articles.map((a) => {
    const proveidor = proveidorDe.get(a.name);
    const estoc = estocDe.get(a.name);
    return {
      erp_id: a.name,
      codi_erp: a.name,
      nom: net(a.item_name) ?? a.name,
      familia: net(a.item_group),
      erp_familia: net(a.item_group),
      ...(proveidor ? { laboratori: laboratoris.get(proveidor.supplier) ?? undefined, referencia_proveidor: proveidor.referencia } : {}),
      historic: Boolean(a.disabled) || !a.is_sales_item,
      preu: preuDe.get(a.name) ?? null,
      estoc_actual: estoc?.actual ?? 0,
      estoc_disponible: estoc?.disponible ?? 0,
      data_alta: a.creation?.slice(0, 10) ?? null,
      erp_imatge: net(a.image),
    };
  });
  const resultat = importa("crm_articles", files, { adopta: (fila) => idPerCamp("crm_articles", "codi_erp", fila.codi_erp) });

  // Les fotos que han canviat, per tandes: cada una és una baixada.
  const actuals = valorsPerErpId<{ erp_imatge: string | null; imatge_copiada_de: string | null; imatge: string | null }>("crm_articles", [
    "erp_imatge", "imatge_copiada_de", "imatge",
  ]);
  const perCopiar = [...actuals.values()].filter((a) => a.erp_imatge && a.erp_imatge !== a.imatge_copiada_de).slice(0, FOTOS_PER_PASSADA);
  let fotos = 0;
  let fotosFallides = 0;
  for (const article of perCopiar) {
    try {
      const { dades, tipus } = await baixaFitxer(erp, article.erp_imatge!);
      if (!tipus.startsWith("image/")) throw new Error(tipus);
      const nom = article.erp_imatge!.split("/").pop() || "foto";
      const nou = await pujaFitxer({ nom, tipus, dades: new Uint8Array(dades), titol: `Producte ${nom}` });
      actualitzaCamps("crm_articles", article.id, { imatge: nou, imatge_copiada_de: article.erp_imatge });
      fotos += 1;
    } catch {
      // Es marca igualment perquè no es torni a provar a cada passada; si la foto canvia a l'ERP, canviarà el nom.
      actualitzaCamps("crm_articles", article.id, { imatge_copiada_de: article.erp_imatge });
      fotosFallides += 1;
    }
  }
  const nota = [
    llista ? `preus de «${llista}»` : "sense llista de preus de venda",
    fotos ? `${fotos} fotos copiades` : null,
    fotosFallides ? `${fotosFallides} fotos que no s'han pogut baixar` : null,
  ].filter(Boolean).join(", ");
  return { ...resultat, nota };
}

async function albarans(erp: ConfigErp) {
  const desde = `${anyActual() - 1}-01-01`;
  const documents = await llistaTot<Albara>(erp, "Delivery Note", {
    camps: ["name", "customer", "posting_date", "naming_series"],
    filtres: [["docstatus", "=", 1], ["posting_date", ">=", desde]],
  });
  const clients = idsPerErpId("crm_clients");
  const capcaleres: FilaImportada[] = documents.map((d) => {
    const { serie, numero } = numeroDeDocument(d.name);
    return {
      erp_id: d.name,
      codi_erp: d.name,
      exercici: d.posting_date ? Number(d.posting_date.slice(0, 4)) : null,
      serie,
      numero,
      data: d.posting_date,
      client: d.customer ? (clients.get(d.customer) ?? null) : null,
    };
  });
  const resultat = importa("crm_albarans", capcaleres);

  const linies = await llistaTot<LiniaAlbara>(erp, "Delivery Note Item", {
    camps: ["name", "parent", "idx", "item_code", "item_name", "qty", "net_rate", "rate", "discount_percentage", "net_amount", "amount"],
    pare: "Delivery Note",
    filtres: [["docstatus", "=", 1], ["creation", ">=", `${anyActual() - 2}-12-01`]],
  });
  const albaransCrm = idsPerErpId("crm_albarans");
  const articles = idsPerErpId("crm_articles");
  const filesLinies: FilaImportada[] = linies
    .filter((l) => albaransCrm.has(l.parent))
    .map((l) => ({
      erp_id: l.name,
      codi_erp: `${l.parent}-${l.idx}`,
      albara: albaransCrm.get(l.parent)!,
      posicio: l.idx,
      article: l.item_code ? (articles.get(l.item_code) ?? null) : null,
      erp_article: net(l.item_code),
      descripcio: net(l.item_name),
      quantitat: l.qty,
      preu: l.net_rate ?? l.rate,
      descompte: l.discount_percentage || null,
      import: l.net_amount ?? l.amount,
    }));
  const deLinies = importa("crm_albarans_linies", filesLinies);
  return { ...resultat, nota: `${deLinies.llegits} línies (${deLinies.creats} noves, ${deLinies.actualitzats} canviades)` };
}

async function facturacio(erp: ConfigErp) {
  const desde = `${anyActual() - 2}-01-01`;
  const factures = await llistaTot<Factura>(erp, "Sales Invoice", {
    camps: ["name", "customer", "posting_date", "base_net_total"],
    filtres: [["docstatus", "=", 1], ["posting_date", ">=", desde]],
  });
  const clients = idsPerErpId("crm_clients");
  const perMes = new Map<string, { client: string; exercici: number; mes: number; base: number; factures: number }>();
  for (const factura of factures) {
    const client = factura.customer ? clients.get(factura.customer) : undefined;
    if (!client || !factura.posting_date) continue;
    const exercici = Number(factura.posting_date.slice(0, 4));
    const mes = Number(factura.posting_date.slice(5, 7));
    const clau = `${factura.customer}|${exercici}|${mes}`;
    const fila = perMes.get(clau) ?? { client, exercici, mes, base: 0, factures: 0 };
    // Les rectificatives ja arriben en negatiu: resten.
    fila.base += Number(factura.base_net_total) || 0;
    fila.factures += 1;
    perMes.set(clau, fila);
  }
  const files: FilaImportada[] = [...perMes.entries()].map(([clau, fila]) => ({
    erp_id: clau,
    client: fila.client,
    exercici: fila.exercici,
    mes: fila.mes,
    base: Math.round(fila.base * 100) / 100,
    factures: fila.factures,
  }));
  const resultat = importa("crm_facturacio", files);
  // Amb els mesos al dia, el resum i la categoria de cada client.
  const resums = await recalculaResumsDeClients(new Date());
  return { ...resultat, nota: `${factures.length} factures; ${resums} clients amb el resum posat al dia` };
}

const PASSOS: Pas[] = [
  { clau: "tipus_client", nom: "Tipus de client", fes: grupsDeClient },
  { clau: "agents", nom: "Agents comercials", fes: comercials },
  { clau: "laboratoris", nom: "Laboratoris", fes: laboratoris },
  { clau: "clients", nom: "Clients", fes: clients },
  { clau: "establiments", nom: "Establiments", fes: establiments },
  { clau: "productes", nom: "Productes", fes: productes },
  { clau: "albarans", nom: "Albarans", fes: albarans },
  { clau: "facturacio", nom: "Facturació", fes: facturacio },
];

// ------------------------------------------------------------------ passada

export type ResultatPas = { clau: string; nom: string; correcte: boolean; resultat?: ResultatImportacio; nota?: string; error?: string };
export type ResultatSincro = { inici: string; fi: string; usuari: string | null; passos: ResultatPas[]; correcte: boolean };

let enCurs: Promise<ResultatSincro> | null = null;

/** Si ja n'hi ha una en marxa, s'hi enganxa: dues alhora es trepitjarien. */
export function sincronitzaAmbErp(desencadenant: "manual" | "programada"): Promise<ResultatSincro> {
  enCurs ??= senseAbast(() => passada(desencadenant)).finally(() => {
    enCurs = null;
  });
  return enCurs;
}

export function hiHaSincroEnCurs() {
  return enCurs !== null;
}

function resumDelPas(pas: ResultatPas) {
  if (!pas.correcte) return `${pas.nom}: error (${pas.error})`;
  const r = pas.resultat!;
  const parts = [`${r.llegits} llegits`, r.creats ? `${r.creats} nous` : null, r.actualitzats ? `${r.actualitzats} canviats` : null, r.absents ? `${r.absents} absents` : null];
  return `${pas.nom}: ${parts.filter(Boolean).join(", ")}${pas.nota ? ` (${pas.nota})` : ""}`;
}

async function passada(desencadenant: "manual" | "programada"): Promise<ResultatSincro> {
  const { config: erp, llistaPreus } = await configuracioErp();
  const inici = new Date().toISOString();
  if (!erp) throw new Error("Falta la connexió amb l'ERP: l'adreça, la clau o el secret d'API (Configuració › Connexió amb l'ERP).");

  const registre = await creaItem("crm_sync_execucions", { taula: "erp", desencadenant, estat: "en_curs", inici });
  const passos: ResultatPas[] = [];
  let usuari: string | null = null;
  try {
    usuari = await usuariConnectat(erp);
    for (const pas of PASSOS) {
      try {
        const { nota, ...resultat } = await pas.fes(erp, llistaPreus);
        passos.push({ clau: pas.clau, nom: pas.nom, correcte: true, resultat, nota });
      } catch (error) {
        passos.push({ clau: pas.clau, nom: pas.nom, correcte: false, error: (error as Error).message });
      }
    }
  } catch (error) {
    passos.push({ clau: "connexio", nom: "Connexió", correcte: false, error: (error as Error).message });
  }

  const fi = new Date().toISOString();
  const correcte = passos.every((pas) => pas.correcte);
  const suma = (camp: keyof ResultatImportacio) => passos.reduce((total, pas) => total + (pas.resultat?.[camp] ?? 0), 0);
  await actualitzaItem("crm_sync_execucions", registre, {
    estat: correcte ? "correcte" : passos.some((pas) => pas.correcte) ? "parcial" : "error",
    fi,
    llegits: suma("llegits"),
    creats: suma("creats"),
    actualitzats: suma("actualitzats"),
    iguals: suma("iguals"),
    absents: suma("absents"),
    missatge: passos.map(resumDelPas).join("\n"),
    progres: { usuari, passos },
  });
  return { inici, fi, usuari, passos, correcte };
}

export type DarreraSincro = { inici: string | null; fi: string | null; estat: string | null; desencadenant: string | null; missatge: string | null };

/** Les darreres passades, per a Configuració. */
export async function darreresSincros(quantes = 5): Promise<DarreraSincro[]> {
  const { files } = await llistaAmbTotal<DarreraSincro>("crm_sync_execucions", {
    camps: ["inici", "fi", "estat", "desencadenant", "missatge"],
    ordre: "-inici",
    limit: quantes,
    condicions: [{ taula: { _eq: "erp" } }],
  });
  return files;
}
