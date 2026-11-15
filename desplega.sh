#!/usr/bin/env bash
#
# Desplega el portal a Google Cloud Run.
#
#   ./desplega.sh           comprova el codi, pregunta i desplega
#   ./desplega.sh --si      desplega sense preguntar
#   ./desplega.sh --prova   només comprova: no puja res
#
# Puja la carpeta tal com és, també el que encara no s'ha desat a git, la
# compila a Cloud Build amb el Dockerfile i n'estrena una revisió nova. Les
# variables del servei (AUTH_SECRET, DIRECTUS_*, FACTUSOL_*) no es toquen: es
# queden les que ja té. Si la compilació falla, la versió que corre no canvia.
#
# Entra a gcloud amb el compte que té accés al projecte, encara que el compte
# per defecte de gcloud sigui un altre. Es pot canviar amb variables d'entorn:
# COMPTE, PROJECTE, REGIO i SERVEI.

set -euo pipefail

PROJECTE="${PROJECTE:-winebackend-portal}"
REGIO="${REGIO:-europe-west1}"
SERVEI="${SERVEI:-wine-backend}"
COMPTE="${COMPTE:-david@healthivity.io}"

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
avis() { printf '\033[33m! %s\033[0m\n' "$1"; }
falla() {
  printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}
# gcloud amb el compte triat, si se n'ha triat cap.
gcl() {
  if [ -n "$COMPTE" ]; then gcloud --account="$COMPTE" "$@"; else gcloud "$@"; fi
}

# --- Què es desplega ---------------------------------------------------------
pas "Què es desplega"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo sense-git)"
BRANCA="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
CANVIS="$(git status --porcelain 2>/dev/null || true)"
echo "Branca $BRANCA, commit $COMMIT: $(git log -1 --format=%s 2>/dev/null || true)"
if [ -n "$CANVIS" ]; then
  BRUT=si
  avis "Hi ha canvis sense desar a git. Es desplegaran igualment:"
  git status --short
else
  BRUT=no
fi

# --- Comprovacions del codi --------------------------------------------------
# Abans de pujar res: un error de tipus o de lint fa fallar la compilació a
# Cloud Build, però allà es descobreix al cap de minuts.
pas "Comprovant el codi"
if [ ! -d node_modules ]; then
  echo "Instal·lant dependències…"
  npm ci
fi
echo "Tipus…"
npx --no-install tsc --noEmit -p . || falla "Hi ha errors de tipus. No s'ha desplegat res."
echo "Lint…"
npx --no-install eslint . --quiet || falla "Hi ha errors de lint. No s'ha desplegat res."
echo "Codi correcte."

# --- Accés a Google Cloud ----------------------------------------------------
pas "Comprovant l'accés a Google Cloud"
command -v gcloud >/dev/null 2>&1 || falla "No trobo gcloud. Instal·la'l: https://cloud.google.com/sdk/docs/install"
QUI="${COMPTE:-$(gcloud config get-value account 2>/dev/null)}"
gcl auth print-access-token >/dev/null 2>&1 ||
  falla "La sessió de gcloud ($QUI) ha caducat o no n'hi ha. Obre-la amb: gcloud auth login $QUI"
URL="$(gcl run services describe "$SERVEI" --project="$PROJECTE" --region="$REGIO" --format='value(status.url)' 2>/dev/null)" ||
  falla "No puc llegir el servei $SERVEI del projecte $PROJECTE amb el compte $QUI. Comprova que hi té accés."
ABANS="$(gcl run services describe "$SERVEI" --project="$PROJECTE" --region="$REGIO" --format='value(status.latestReadyRevisionName)')"
echo "Compte $QUI"
echo "Servei $SERVEI ($PROJECTE, $REGIO)"
echo "Ara corre la revisió $ABANS a $URL"

if [ "$PROVA" = 1 ]; then
  pas "Tot a punt. És una prova: no s'ha desplegat res."
  exit 0
fi

# --- Confirmació -------------------------------------------------------------
if [ "$PREGUNTA" = 1 ]; then
  [ -t 0 ] || falla "No hi ha terminal per preguntar. Passa --si per desplegar sense preguntar."
  printf '\nDesplego el commit %s%s a %s? [s/N] ' "$COMMIT" "$([ "$BRUT" = si ] && echo ' amb els canvis sense desar')" "$SERVEI"
  read -r resposta
  case "$resposta" in
    s | S | si | Si | SI | sí | Sí | y | Y) ;;
    *)
      echo "No s'ha desplegat res."
      exit 0
      ;;
  esac
fi

# --- Desplegament ------------------------------------------------------------
pas "Desplegant (compilar a Cloud Build triga uns minuts)"
INICI=$SECONDS
# L'etiqueta diu quin commit corre, per saber-ho sense haver de recordar-ho.
gcl run deploy "$SERVEI" \
  --source . \
  --project="$PROJECTE" \
  --region="$REGIO" \
  --update-labels="commit=$COMMIT,canvis-sense-desar=$BRUT" \
  --quiet ||
  falla "El desplegament ha fallat. La versió d'abans ($ABANS) continua funcionant."

ARA="$(gcl run services describe "$SERVEI" --project="$PROJECTE" --region="$REGIO" --format='value(status.latestReadyRevisionName)')"

# --- Comprovació -------------------------------------------------------------
pas "Comprovant que respon"
CODI="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$URL/login" || echo 000)"
if [ "$CODI" = 200 ]; then
  echo "La pàgina d'entrada respon bé."
else
  avis "La pàgina d'entrada respon amb el codi $CODI. Revisa-ho: $URL"
fi

pas "Desplegat en $(((SECONDS - INICI) / 60)) min $(((SECONDS - INICI) % 60)) s"
echo "Revisió $ARA (abans $ABANS)"
echo "$URL"
if [ "$ARA" = "$ABANS" ]; then
  avis "La revisió no ha canviat: potser Cloud Run no ha estrenat la nova."
fi
