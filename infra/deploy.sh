#!/bin/bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/deploy}"
IMAGE="georgeshep/bord:api.georgesheppard.dev"
COMPOSE_URL="https://raw.githubusercontent.com/GeorgeSheppard/api.georgesheppard.dev/master/infra/compose.yaml"

mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Fetch latest compose.yaml from the public repo
COMPOSE_CHANGED=false
if curl -fsSL "$COMPOSE_URL" -o compose.yaml.tmp 2>/dev/null; then
  if ! cmp -s compose.yaml.tmp compose.yaml 2>/dev/null; then
    mv compose.yaml.tmp compose.yaml
    COMPOSE_CHANGED=true
  else
    rm -f compose.yaml.tmp
  fi
else
  rm -f compose.yaml.tmp
fi

# Check for new image by comparing image IDs before and after pull
OLD_ID=$(docker image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || echo "none")
docker compose pull -q 2>/dev/null
NEW_ID=$(docker image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || echo "unknown")

IMAGE_CHANGED=$([ "$OLD_ID" != "$NEW_ID" ] && echo true || echo false)

if [ "$IMAGE_CHANGED" = "true" ] || [ "$COMPOSE_CHANGED" = "true" ]; then
  echo "$(date): Deploying (image_changed=$IMAGE_CHANGED, compose_changed=$COMPOSE_CHANGED)"
  docker compose up -d --remove-orphans
  echo "$(date): Deploy complete"
fi
