#!/usr/bin/env bash
#
# S'executa a la VM, per SSH, des del workflow de desplegament. Carrega la
# imatge que el workflow hi ha copiat i arrenca el contenidor `vproof-crm`.
# No toca res de l'ERP: el CRM és un contenidor a part, amb el seu volum de
# dades (`vproof-crm-dades`) i la seva configuració a /var/lib/vproof-crm/env.
#
# Entrada (variables d'entorn): ETIQUETA (la de la imatge), CRM_PORT i,
# opcionalment, CRM_ADMIN_PASSWORD. Sense, el primer cop se'n genera una
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

echo "▸ Arrencant el contenidor"
sudo docker rm -f vproof-crm >/dev/null 2>&1 || true
sudo docker run -d --name vproof-crm --restart unless-stopped \
  -p "$CRM_PORT:3000" \
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
