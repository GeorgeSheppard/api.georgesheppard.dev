#!/usr/bin/env bash
set -euo pipefail

# Pulls secrets from Infisical into ./.env, then pulls and (re)starts the stack.
# Auth: a Machine Identity (Universal Auth) with INFISICAL_CLIENT_ID/INFISICAL_CLIENT_SECRET
# set as host env vars (e.g. in ~/.zshrc or a systemd/launchd EnvironmentFile). No login needed.
#
# Required host env vars: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
# Optional: INFISICAL_ENV (defaults to "prod")

cd "$(dirname "$0")"

: "${INFISICAL_CLIENT_ID:?INFISICAL_CLIENT_ID is not set}"
: "${INFISICAL_CLIENT_SECRET:?INFISICAL_CLIENT_SECRET is not set}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID is not set}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent \
  --plain > /tmp/infisical-token

infisical export \
  --token="$(cat /tmp/infisical-token)" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --format=dotenv-export > .env
rm -f /tmp/infisical-token

docker compose pull
docker compose up -d --remove-orphans
