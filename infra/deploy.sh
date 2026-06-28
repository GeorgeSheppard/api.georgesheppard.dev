#!/usr/bin/env bash
set -euo pipefail

# Polled by cron every 2 minutes from ~/deploy on the mac mini. Each run:
#   1. Fetches the latest infra/compose.yaml from master
#   2. Pulls secrets from Infisical into .env (Machine Identity / Universal Auth, no login needed)
#   3. Pulls the latest api image
#   4. Only restarts the stack if the image, compose.yaml, or secrets actually changed
# Silent when nothing changed, so the cron log doesn't fill up with no-op runs.
#
# Required host env vars: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
# Optional: INFISICAL_ENV (defaults to "prod")

cd "$(dirname "$0")"

: "${INFISICAL_CLIENT_ID:?INFISICAL_CLIENT_ID is not set}"
: "${INFISICAL_CLIENT_SECRET:?INFISICAL_CLIENT_SECRET is not set}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID is not set}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"
IMAGE="georgeshep/bord:api.georgesheppard.dev"

curl -fsSL https://raw.githubusercontent.com/GeorgeSheppard/api.georgesheppard.dev/master/infra/compose.yaml \
  -o compose.yaml.new

INFISICAL_TOKEN="$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)"

infisical export \
  --token="$INFISICAL_TOKEN" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --format=dotenv-export > .env.new

COMPOSE_CHANGED=false
cmp -s compose.yaml.new compose.yaml 2>/dev/null || COMPOSE_CHANGED=true

ENV_CHANGED=false
cmp -s .env.new .env 2>/dev/null || ENV_CHANGED=true

BEFORE_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || echo none)"
docker pull "$IMAGE" >/dev/null
AFTER_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}')"

mv compose.yaml.new compose.yaml
mv .env.new .env

if [ "$BEFORE_ID" = "$AFTER_ID" ] && [ "$COMPOSE_CHANGED" = false ] && [ "$ENV_CHANGED" = false ]; then
  exit 0
fi

docker compose up -d --remove-orphans
echo "$(date -u +%FT%TZ) deployed image $AFTER_ID (compose_changed=$COMPOSE_CHANGED env_changed=$ENV_CHANGED)"
