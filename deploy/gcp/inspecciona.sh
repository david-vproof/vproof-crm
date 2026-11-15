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
