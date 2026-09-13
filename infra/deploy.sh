#!/usr/bin/env bash
set -Eeuo pipefail

# Run by com.docker.compose.update launchd job every 5 minutes from the compose directory
# on the mac mini (e.g. ~/Documents/root). Refreshes compose.yaml from the repo, regenerates
# .env from Infisical (Machine Identity / Universal Auth, no login needed), then pulls and
# (re)starts the stack. `docker compose up -d` only recreates containers whose config actually
# changed, so this is safe to run unconditionally.
#
# Required host env vars: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID
# Optional: INFISICAL_ENV (defaults to "prod")
#
# Pings healthchecks.io on every run so a silently-broken deploy (expired credentials, a
# launchd job that stopped firing, Docker itself being down, ...) gets noticed within
# minutes instead of discovered by accident weeks later. If this box's check hasn't pinged
# within its grace period, healthchecks.io emails/alerts. Losing network access to
# hc-ping.com must never fail the deploy itself, so every ping is best-effort.
HEALTHCHECK_URL="https://hc-ping.com/b1addef2-6c79-417b-9ad2-8eeaf5e7329b"

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

ping_healthcheck() {
  curl -fsS -m 10 --retry 3 "$1" -o /dev/null || true
}

on_error() {
  log "Deploy failed"
  ping_healthcheck "$HEALTHCHECK_URL/fail"
}
trap on_error ERR

cd "$(dirname "$0")"

: "${INFISICAL_CLIENT_ID:?INFISICAL_CLIENT_ID is not set}"
: "${INFISICAL_CLIENT_SECRET:?INFISICAL_CLIENT_SECRET is not set}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID is not set}"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

log "Starting deploy"
ping_healthcheck "$HEALTHCHECK_URL/start"

log "Refreshing compose.yaml from master"
curl -fsSL https://raw.githubusercontent.com/GeorgeSheppard/api.georgesheppard.dev/master/infra/compose.yaml -o ~/Documents/root/compose.yaml

log "Authenticating with Infisical"
INFISICAL_TOKEN="$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --silent --plain)"

log "Exporting secrets from Infisical ($INFISICAL_ENV)"
infisical export \
  --token="$INFISICAL_TOKEN" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --format=dotenv-export > .env

log "Pulling images"
docker compose pull

log "Restarting any containers with a changed image or config"
docker compose up -d --remove-orphans

log "Deploy succeeded"
ping_healthcheck "$HEALTHCHECK_URL"
