#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${APP_ENV:-prod}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.yml}"

echo "=== Starting Blue-Green Deployment for environment: ${APP_ENV} ==="

# 1. Pull latest images
echo "Pulling images for ${APP_ENV}..."
docker compose -f "$COMPOSE_FILE" --profile migrate pull api web site migrate

# 2. Run database migrations against the environment's dedicated database
echo "Running database migrations for ${APP_ENV}..."
docker compose -p "sohizi-${APP_ENV}-migrate" -f "$COMPOSE_FILE" --profile migrate run --rm migrate

# 3. Determine active (PREV_COLOR) and target (NEXT_COLOR) stacks
if [ -n "$(docker compose -p "sohizi-${APP_ENV}-blue" -f "$COMPOSE_FILE" ps -q api 2>/dev/null)" ]; then
  PREV_COLOR="blue"
  NEXT_COLOR="green"
else
  PREV_COLOR="green"
  NEXT_COLOR="blue"
fi

echo "Active slot: ${PREV_COLOR} -> Deploying to slot: ${NEXT_COLOR}"

# 4. Boot NEXT_COLOR and wait for all container healthchecks to pass
if ! docker compose -p "sohizi-${APP_ENV}-${NEXT_COLOR}" -f "$COMPOSE_FILE" up -d --wait --wait-timeout 120 api web site; then
  echo "ERROR: Healthchecks failed for sohizi-${APP_ENV}-${NEXT_COLOR}. Rolling back..."
  docker compose -p "sohizi-${APP_ENV}-${NEXT_COLOR}" -f "$COMPOSE_FILE" logs --tail=100 || true
  docker compose -p "sohizi-${APP_ENV}-${NEXT_COLOR}" -f "$COMPOSE_FILE" down --remove-orphans || true
  exit 1
fi

echo "Slot ${NEXT_COLOR} is healthy and registered with Caddy."

# 5. Gracefully drain and stop PREV_COLOR if running
if [ -n "$(docker compose -p "sohizi-${APP_ENV}-${PREV_COLOR}" -f "$COMPOSE_FILE" ps -q 2>/dev/null)" ]; then
  echo "Draining and stopping previous slot: ${PREV_COLOR}..."
  docker compose -p "sohizi-${APP_ENV}-${PREV_COLOR}" -f "$COMPOSE_FILE" stop -t 30 web site
  docker compose -p "sohizi-${APP_ENV}-${PREV_COLOR}" -f "$COMPOSE_FILE" stop -t 600 api
  docker compose -p "sohizi-${APP_ENV}-${PREV_COLOR}" -f "$COMPOSE_FILE" down --remove-orphans
fi

echo "=== Blue-Green Deployment for ${APP_ENV} (${NEXT_COLOR}) complete ==="
