#!/usr/bin/env bash
#
# Manté el CRM dins del proxy (Caddy) de l'ERP. S'instal·la a la VM com a
# /usr/local/sbin/vproof-crm-proxy i el crida el desplegament i, cada cinc
# minuts, el temporitzador vproof-crm-proxy.timer: si un desplegament de l'ERP
# reescriu el Caddyfile, el bloc del CRM hi torna sol.
#
# El bloc va entre dues marques i només es toca el que hi ha entre elles. Abans
# de recarregar Caddy se'n valida la configuració; si no la valida, el
# Caddyfile es deixa com estava.

set -euo pipefail

# CRM_HOST (el nom pel qual s'entra al CRM) i, si cal, CADDYFILE.
source /etc/vproof-crm/proxy.env
CADDYFILE="${CADDYFILE:-/opt/erpnext/Caddyfile}"

CADDY="$(docker ps --format '{{.Names}}' | grep -E '(^|-)caddy(-|$)' | head -1 || true)"
[ -n "$CADDY" ] && [ -f "$CADDYFILE" ] || exit 0

INICI="# >>> vproof-crm"
FI="# <<< vproof-crm"
BLOC="$INICI (l'afegeix el desplegament del CRM; no el toquis a mà)
$CRM_HOST {
	reverse_proxy vproof-crm:3000
}
$FI"

actual="$(awk -v i="$INICI" -v f="$FI" 'index($0, i) == 1 { s = 1 } s { print } index($0, f) == 1 { s = 0 }' "$CADDYFILE")"
[ "$actual" = "$BLOC" ] && exit 0

sense="$(awk -v i="$INICI" -v f="$FI" 'index($0, i) == 1 { s = 1 } !s { print } index($0, f) == 1 { s = 0 }' "$CADDYFILE")"
copia="$(cat "$CADDYFILE")"
# Amb redirecció i no amb sed -i: el fitxer ha de ser el mateix (el mateix inode), que és el que el contenidor té muntat.
printf '%s\n\n%s\n' "$sense" "$BLOC" > "$CADDYFILE"

if docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 &&
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  echo "proxy: $CRM_HOST → vproof-crm:3000"
else
  printf '%s\n' "$copia" > "$CADDYFILE"
  echo "proxy: Caddy no accepta el bloc del CRM; el Caddyfile es deixa com estava." >&2
  exit 1
fi
