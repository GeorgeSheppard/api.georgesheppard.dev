#!/usr/bin/env bash
set -euo pipefail

# Run by com.docker.compose.update launchd job every 5 minutes from the compose directory
# on the mac mini (e.g. ~/Documents/root). Refreshes compose.yaml from the repo, regenerates
# .env from Infisical (Machine Identity / Universal Auth, no login needed), then pulls and
# (re)starts the stack. `docker compose up -d` only recreates containers whose config actually
# changed, so this is safe to run unconditionally.
#
# Required host env vars: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
# Optional: INFISICAL_ENV (defaults to "prod"), GITHUB_TOKEN (only needed if the repo is private),
#           COMPOSE_SOURCE_URL (defaults to the raw infra/compose.yaml on master)

cd "$(dirname "$0")"

: "${INFISICAL_CLIENT_ID:?INFISICAL_CLIENT_ID is not set}"
: "${INFISICAL_CLIENT_SECRET:?INFISICAL_CLIENT_SECRET is not set}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID is not set}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"
COMPOSE_SOURCE_URL="${COMPOSE_SOURCE_URL:-https://raw.githubusercontent.com/GeorgeSheppard/api.georgesheppard.dev/master/infra/compose.yaml}"

if [ -n "${GITHUB_TOKEN:-}" ]; then
  curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" "$COMPOSE_SOURCE_URL" -o compose.yaml
else
  curl -fsSL "$COMPOSE_SOURCE_URL" -o compose.yaml
fi

INFISICAL_TOKEN="$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)"

infisical export \
  --token="$INFISICAL_TOKEN" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --format=dotenv-export > .env

docker compose pull
docker compose up -d --remove-orphans
