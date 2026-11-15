#!/usr/bin/env bash
#
# Desplega el portal en un servidor amb Docker, per SSH.
#
#   SERVIDOR=usuari@host ./desplega.sh           comprova el codi, pregunta i desplega
#   SERVIDOR=usuari@host ./desplega.sh --si      desplega sense preguntar
#   ./desplega.sh --prova                        només comprova el codi: no puja res
#
# Puja la carpeta (sense node_modules, .next, .git ni dades) a DESTI al
# servidor i hi fa `docker compose up -d --build`. La base de dades viu al
# volum «dades» del servidor: desplegar no la toca. El fitxer .env del
# servidor tampoc: s'hi ha de crear un cop, a partir de .env.example.
#
# Variables: SERVIDOR (obligatòria per desplegar), DESTI (per defecte
# /opt/vproof-crm) i PORT_SSH (per defecte 22).

set -euo pipefail

SERVIDOR="${SERVIDOR:-}"
DESTI="${DESTI:-/opt/vproof-crm}"
PORT_SSH="${PORT_SSH:-22}"

PREGUNTA=1
PROVA=0
for opcio in "$@"; do
  case "$opcio" in
    -s | --si) PREGUNTA=0 ;;
    --prova) PROVA=1 ;;
    -h | --ajuda)
      sed -n '3,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Opció desconeguda: $opcio. Mira ./desplega.sh --ajuda" >&2
      exit 2
      ;;
  esac
done

cd "$(dirname "$0")"

pas() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
falla() {
  printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

pas "Comprovant el codi"
[ -d node_modules ] || npm ci
npx --no-install tsc --noEmit -p . || falla "Hi ha errors de tipus. No s'ha desplegat res."
npx --no-install eslint . --quiet || falla "Hi ha errors de lint. No s'ha desplegat res."
echo "Codi correcte."

if [ "$PROVA" = 1 ]; then
  pas "Tot a punt. És una prova: no s'ha desplegat res."
  exit 0
fi

[ -n "$SERVIDOR" ] || falla "Falta SERVIDOR=usuari@host."
SSH=(ssh -p "$PORT_SSH" "$SERVIDOR")

pas "Comprovant el servidor $SERVIDOR"
"${SSH[@]}" "command -v docker >/dev/null && docker compose version >/dev/null" ||
  falla "Al servidor no hi ha Docker amb «docker compose»."
"${SSH[@]}" "mkdir -p '$DESTI' && test -f '$DESTI/.env'" ||
  falla "Falta $DESTI/.env al servidor. Crea'l a partir de .env.example (AUTH_SECRET, PORTAL_USUARI, PORTAL_CONTRASENYA)."

COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo sense-git)"
if [ "$PREGUNTA" = 1 ]; then
  [ -t 0 ] || falla "No hi ha terminal per preguntar. Passa --si per desplegar sense preguntar."
  printf '\nDesplego el commit %s a %s:%s? [s/N] ' "$COMMIT" "$SERVIDOR" "$DESTI"
  read -r resposta
  case "$resposta" in s | S | si | Si | sí | Sí | y | Y) ;; *) echo "No s'ha desplegat res."; exit 0 ;; esac
fi

pas "Pujant el codi"
rsync -az --delete -e "ssh -p $PORT_SSH" \
  --exclude node_modules --exclude .next --exclude .git --exclude dades --exclude .env \
  ./ "$SERVIDOR:$DESTI/"

pas "Compilant i arrencant (uns minuts)"
"${SSH[@]}" "cd '$DESTI' && docker compose up -d --build && docker image prune -f >/dev/null"

pas "Comprovant que respon"
PORT_CRM="$("${SSH[@]}" "cd '$DESTI' && grep -E '^CRM_PORT=' .env | cut -d= -f2" || true)"
CODI="$("${SSH[@]}" "curl -s -o /dev/null -w '%{http_code}' --max-time 30 http://localhost:${PORT_CRM:-3000}/login" || echo 000)"
[ "$CODI" = 200 ] && echo "La pàgina d'entrada respon bé." || echo "La pàgina d'entrada respon amb el codi $CODI: revisa-ho amb «docker compose logs»."
pas "Desplegat el commit $COMMIT"
