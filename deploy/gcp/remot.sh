#!/usr/bin/env bash
#
# S'executa a la VM, per SSH, des del workflow de desplegament. Carrega la
# imatge que el workflow hi ha copiat i arrenca el contenidor `vproof-crm`.
# No toca res de l'ERP: el CRM és un contenidor a part, amb el seu volum de
# dades (`vproof-crm-dades`) i la seva configuració a /var/lib/vproof-crm/env.
#
# Entrada (variables d'entorn): ETIQUETA (la de la imatge), CRM_PORT, CRM_HOST
# (el nom pel qual s'entra, a través del Caddy de l'ERP) i,
# opcionalment, CRM_ADMIN_PASSWORD, VPROOFERP_API_KEY i VPROOFERP_API_SECRET.
# Sense CRM_ADMIN_PASSWORD, el primer cop se'n genera una
# d'aleatòria i s'escriu al port sèrie de la VM, com fa l'ERP amb la seva.

set -euo pipefail

ETIQUETA="${ETIQUETA:?Falta ETIQUETA}"
CRM_PORT="${CRM_PORT:-3000}"
DIR=/var/lib/vproof-crm
ADMIN=admin@vproof.local

aleatori() { head -c "$1" /dev/urandom | base64 | tr -d '/+=\n'; }

echo "▸ Carregant la imatge"
sudo docker load -i /tmp/vproof-crm.tar.gz
rm -f /tmp/vproof-crm.tar.gz

sudo mkdir -p "$DIR"
if ! sudo test -f "$DIR/env"; then
  echo "▸ Primer desplegament: es crea la configuració"
  CONTRASENYA="${CRM_ADMIN_PASSWORD:-$(aleatori 18)}"
  printf 'AUTH_SECRET=%s\nPORTAL_USUARI=%s\nPORTAL_CONTRASENYA=%s\n' "$(aleatori 48)" "$ADMIN" "$CONTRASENYA" |
    sudo tee "$DIR/env" >/dev/null
  sudo chmod 600 "$DIR/env"
  if [ -z "${CRM_ADMIN_PASSWORD:-}" ]; then
    # Al port sèrie: es llegeix a la consola de Google Cloud (VM › Registres › Port sèrie 1). No surt al registre del workflow.
    echo "VPROOF_CRM_ADMIN usuari=$ADMIN contrasenya=$CONTRASENYA" | sudo tee /dev/ttyS0 >/dev/null || true
    echo "  La contrasenya inicial de $ADMIN és al port sèrie de la VM (línia VPROOF_CRM_ADMIN)."
  fi
fi

# --- Connexió amb l'ERP ------------------------------------------------------
# El CRM parla amb l'ERP per la xarxa interna de Docker: s'uneix a la xarxa
# del frontend de l'ERP i hi entra amb el nom del site a la capçalera Host. La
# clau d'API la porta el workflow (secrets VPROOFERP_API_KEY i
# VPROOFERP_API_SECRET del repositori) i només es desa a $DIR/env.
FRONTEND="$(sudo docker ps --format '{{.Names}}' | grep -E '(^|-)frontend(-|$)' | head -1 || true)"
BACKEND="$(sudo docker ps --format '{{.Names}}' | grep -E '(^|-)backend(-|$)' | head -1 || true)"
XARXA=""
if [ -n "$FRONTEND" ] && [ -n "$BACKEND" ]; then
  XARXA="$(sudo docker inspect -f '{{range $nom, $x := .NetworkSettings.Networks}}{{$nom}} {{end}}' "$FRONTEND" | awk '{print $1}')"
  SITE="$(sudo docker exec -w /home/frappe/frappe-bench/sites "$BACKEND" sh -c 'for d in */site_config.json; do echo "${d%/site_config.json}"; done' 2>/dev/null | head -1 || true)"
  echo "▸ ERP: frontend $FRONTEND, xarxa $XARXA, site ${SITE:-?}"
  if [ -n "${VPROOFERP_API_KEY:-}" ] && [ -n "${VPROOFERP_API_SECRET:-}" ] && [ -n "$SITE" ]; then
    # Es reescriuen sempre: si la clau canvia als secrets, el CRM fa servir la nova.
    sudo sed -i '/^VPROOFERP_\(URL\|HOST\|API_KEY\|API_SECRET\)=/d' "$DIR/env"
    printf 'VPROOFERP_URL=http://%s:8080\nVPROOFERP_HOST=%s\nVPROOFERP_API_KEY=%s\nVPROOFERP_API_SECRET=%s\n' \
      "$FRONTEND" "$SITE" "$VPROOFERP_API_KEY" "$VPROOFERP_API_SECRET" | sudo tee -a "$DIR/env" >/dev/null
    echo "  Connexió amb l'ERP configurada."
  elif sudo grep -q '^VPROOFERP_API_SECRET=' "$DIR/env"; then
    echo "  Es manté la connexió amb l'ERP que ja hi havia."
  else
    echo "  Sense clau d'API de l'ERP (secrets VPROOFERP_API_KEY i VPROOFERP_API_SECRET): el CRM arrenca sense sincronització."
  fi
else
  echo "▸ No he trobat els contenidors de l'ERP: el CRM arrenca sense connexió."
fi

echo "▸ Arrencant el contenidor"
sudo docker rm -f vproof-crm >/dev/null 2>&1 || true
sudo docker run -d --name vproof-crm --restart unless-stopped \
  ${XARXA:+--network "$XARXA"} \
  -p "127.0.0.1:$CRM_PORT:3000" \
  --env-file "$DIR/env" \
  -v vproof-crm-dades:/app/dades \
  "vproof-crm:$ETIQUETA" >/dev/null

echo "▸ Comprovant que respon"
CODI=000
for _ in $(seq 1 40); do
  CODI="$(sudo docker exec vproof-crm node -e "fetch('http://127.0.0.1:3000/login').then(r=>console.log(r.status)).catch(()=>console.log(0))" 2>/dev/null || echo 0)"
  [ "$CODI" = 200 ] && break
  sleep 3
done
echo "  /login respon $CODI"

# Les imatges velles del CRM, fora; la que corre es queda.
sudo docker images vproof-crm --format '{{.Tag}}' | grep -vx "$ETIQUETA" | xargs -r -I{} sudo docker rmi "vproof-crm:{}" >/dev/null 2>&1 || true

[ "$CODI" = 200 ] || { sudo docker logs --tail 60 vproof-crm; exit 1; }

# --- Proxy -------------------------------------------------------------------
# S'entra al CRM pel Caddy de l'ERP (ports 80 i 443), amb el nom CRM_HOST.
# proxy.sh hi afegeix el bloc del CRM, i un temporitzador el manté.
if [ -n "${CRM_HOST:-}" ]; then
  echo "▸ Proxy: $CRM_HOST"
  sudo install -m 0755 /tmp/proxy.sh /usr/local/sbin/vproof-crm-proxy
  sudo mkdir -p /etc/vproof-crm
  printf 'CRM_HOST=%s\n' "$CRM_HOST" | sudo tee /etc/vproof-crm/proxy.env >/dev/null
  printf '[Unit]\nDescription=vproof CRM: manté el CRM al proxy de l%sERP\nAfter=docker.service\n\n[Service]\nType=oneshot\nExecStart=/usr/local/sbin/vproof-crm-proxy\n' "'" |
    sudo tee /etc/systemd/system/vproof-crm-proxy.service >/dev/null
  printf '[Unit]\nDescription=vproof CRM: comprova el proxy cada cinc minuts\n\n[Timer]\nOnBootSec=3min\nOnUnitActiveSec=5min\n\n[Install]\nWantedBy=timers.target\n' |
    sudo tee /etc/systemd/system/vproof-crm-proxy.timer >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl enable --now vproof-crm-proxy.timer >/dev/null 2>&1
  sudo /usr/local/sbin/vproof-crm-proxy
fi
rm -f /tmp/proxy.sh
