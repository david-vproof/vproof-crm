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
