#!/usr/bin/env bash
#
# Només llegeix: com està muntat el proxy (Caddy) de l'ERP a la VM, per saber on
# afegir-hi el CRM. No n'ensenya el contingut sencer (els registres del
# workflow són públics): només on és el Caddyfile, quins noms serveix i a quines
# xarxes és.
set -uo pipefail

CADDY="$(sudo docker ps --format '{{.Names}}' | grep -E '(^|-)caddy(-|$)' | head -1)"
echo "▸ Contenidor del proxy: ${CADDY:-cap}"
[ -n "$CADDY" ] || exit 0
sudo docker inspect -f 'Imatge: {{.Config.Image}}' "$CADDY"
echo "Muntatges:"
sudo docker inspect -f '{{range .Mounts}}  {{.Type}} {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' "$CADDY"
echo "Xarxes: $(sudo docker inspect -f '{{range $nom, $x := .NetworkSettings.Networks}}{{$nom}} {{end}}' "$CADDY")"
echo "Projecte de compose: $(sudo docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$CADDY")"
echo "Ordre: $(sudo docker inspect -f '{{json .Config.Cmd}}' "$CADDY")"
echo "Noms que serveix (capçaleres de bloc del Caddyfile):"
sudo docker exec "$CADDY" sh -c 'grep -nE "^[^[:space:]#].*\{[[:space:]]*$|^[[:space:]]*import " /etc/caddy/Caddyfile' 2>&1 | sed 's/^/  /'
echo "Xarxes del CRM: $(sudo docker inspect -f '{{range $nom, $x := .NetworkSettings.Networks}}{{$nom}} {{end}}' vproof-crm 2>/dev/null)"

# --- La sincronització del CRM: com han anat les darreres passades -----------
# Només recomptes i missatges d'estat: res de noms de clients ni de productes.
if sudo docker ps --format '{{.Names}}' | grep -qx vproof-crm; then
  echo "▸ Darreres sincronitzacions del CRM"
  sudo docker exec -i vproof-crm node - <<'JS' 2>&1 | sed 's/^/  /'
const Database = require("better-sqlite3");
const bd = new Database(process.env.SQLITE_RUTA, { readonly: true });
for (const f of bd.prepare("SELECT inici, fi, estat, desencadenant, missatge FROM crm_sync_execucions ORDER BY inici DESC LIMIT 3").all()) {
  console.log(`${f.inici} → ${f.fi ?? "…"} · ${f.estat} · ${f.desencadenant}`);
  for (const linia of String(f.missatge ?? "").split("\n")) console.log(`    ${linia}`);
}
const recompte = (taula, extra = "") => bd.prepare(`SELECT COUNT(*) AS n ${extra} FROM ${taula}`).get();
console.log("Productes:", JSON.stringify(recompte("crm_articles", ", SUM(font = 'erp') AS de_l_erp, SUM(historic) AS historics, SUM(erp_absent_des_de IS NOT NULL) AS absents, SUM(preu IS NOT NULL) AS amb_preu, SUM(estoc_actual > 0) AS amb_estoc, SUM(imatge IS NOT NULL) AS amb_foto")));
console.log("Clients:", JSON.stringify(recompte("crm_clients", ", SUM(font = 'erp') AS de_l_erp")));
console.log("Laboratoris:", JSON.stringify(recompte("crm_proveidors", ", SUM(font = 'erp') AS de_l_erp")));
const cfg = bd.prepare("SELECT url IS NOT NULL AS te_url, host, llista_preus, minuts FROM crm_connexio_erp LIMIT 1").get();
console.log("Connexió desada:", JSON.stringify(cfg ?? null));
JS
fi

# --- Com veu les adreces dels clients l'usuari de l'ERP del CRM (només recomptes) ---
if sudo docker ps --format '{{.Names}}' | grep -qx vproof-crm; then
  echo "▸ Adreces de l'ERP vistes amb la clau del CRM"
  sudo docker exec -i vproof-crm node - <<'JS' 2>&1 | sed 's/^/  /'
const http = require("node:http");
const Database = require("better-sqlite3");
const bd = new Database(process.env.SQLITE_RUTA, { readonly: true });
const c = bd.prepare("SELECT * FROM crm_connexio_erp LIMIT 1").get() ?? {};
const url = new URL(c.url || process.env.VPROOFERP_URL);
const host = c.host || process.env.VPROOFERP_HOST;
const auth = `token ${c.api_key || process.env.VPROOFERP_API_KEY}:${c.api_secret || process.env.VPROOFERP_API_SECRET}`;
const demana = (doctype, fields, extra = {}) =>
  new Promise((resol) => {
    const p = new URLSearchParams({ fields: JSON.stringify(fields), limit_page_length: "2000", ...extra });
    http.get(new URL(`/api/resource/${encodeURIComponent(doctype)}?${p}`, url), { headers: { Host: host, Authorization: auth } }, (res) => {
      let cos = "";
      res.on("data", (t) => (cos += t));
      res.on("end", () => resol(res.statusCode === 200 ? JSON.parse(cos).data : `HTTP ${res.statusCode} ${cos.slice(0, 200).replace(/<[^>]+>/g, "")}`));
    }).on("error", (e) => resol(`error ${e.message}`));
  });
const resum = (nom, files, camps) => {
  if (!Array.isArray(files)) return console.log(`${nom}: ${files}`);
  const arriben = Object.keys(files[0] ?? {});
  const plens = Object.fromEntries(camps.map((camp) => [camp, files.filter((f) => f[camp] !== null && f[camp] !== undefined && f[camp] !== "").length]));
  console.log(`${nom}: ${files.length} files · camps que arriben: ${arriben.join(",")} · amb valor: ${JSON.stringify(plens)}`);
};
(async () => {
  const clients = await demana("Customer", ["name", "customer_primary_address", "primary_address", "customer_primary_contact"]);
  resum("Customer", clients, ["customer_primary_address", "primary_address", "customer_primary_contact"]);
  const adreces = await demana("Address", ["name", "address_line1", "city", "pincode", "state", "country", "address_type", "is_primary_address", "is_shipping_address", "disabled"]);
  resum("Address", adreces, ["address_line1", "city", "pincode", "state", "country", "is_primary_address", "is_shipping_address"]);
  if (Array.isArray(adreces)) console.log("  address_type:", JSON.stringify(adreces.reduce((m, a) => ((m[a.address_type] = (m[a.address_type] ?? 0) + 1), m), {})));
  const enllacos = await demana("Dynamic Link", ["parent", "link_doctype", "link_name"], { parent: "Address" });
  resum("Dynamic Link (parent=Address)", enllacos, ["link_name"]);
  if (Array.isArray(enllacos)) console.log("  link_doctype:", JSON.stringify(enllacos.reduce((m, e) => ((m[e.link_doctype] = (m[e.link_doctype] ?? 0) + 1), m), {})));
  const ambFill = await demana("Address", ["name", "`tabDynamic Link`.link_doctype", "`tabDynamic Link`.link_name"]);
  resum("Address amb `tabDynamic Link`", ambFill, ["link_doctype", "link_name"]);
  const ambPunt = await demana("Address", ["name", "links.link_doctype", "links.link_name"]);
  resum("Address amb links.*", ambPunt, ["link_doctype", "link_name", "links.link_name"]);
  const crm = bd.prepare("SELECT COUNT(*) n, SUM(adreca IS NOT NULL) amb_adreca, SUM(poblacio IS NOT NULL) amb_poblacio, SUM(codi_postal IS NOT NULL) amb_cp FROM crm_clients WHERE font = 'erp'").get();
  console.log("Clients de l'ERP al CRM:", JSON.stringify(crm));
})();
JS
fi
