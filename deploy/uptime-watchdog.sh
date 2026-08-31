#!/usr/bin/env sh
#
# uptime-watchdog.sh — keep api.kobeapptz.com (and the tunnel behind it) online.
#
# RUN THIS ON THE PRODUCTION SERVER (the host running docker compose), on a
# 1-minute schedule via deploy/kobeos-watchdog.timer. It is the thing that
# turns "the tunnel dropped at 2am and nobody noticed" (Cloudflare 1033/530)
# into "the tunnel dropped at 2am and healed itself in 60s".
#
# What it does, cheaply and idempotently, every run:
#   1. Ask Cloudflare's edge whether the API is actually serving
#      (https://api.<domain>/api/health → expect 200).
#   2. If not, confirm it's not just a blip by re-checking, then bring the
#      whole compose stack back up (`up -d` is a no-op when already healthy,
#      and restarts anything that has died) and bounce the tunnel connectors.
#   3. Optionally POST a one-line alert to $WATCHDOG_ALERT_WEBHOOK so a human
#      finds out. Never prints secrets.
#
# It only ever RESTARTS your own stack — it never touches Cloudflare DNS or the
# tunnel token, so it is safe to run unattended.
#
# Config (env, all optional except where noted):
#   CF_DOMAIN               apex domain (default: kobeapptz.com)
#   KOBE_COMPOSE            path to the prod compose file
#                           (default: <repo>/server/docker-compose.prod.yml)
#   WATCHDOG_ALERT_WEBHOOK  URL to POST {"text": "..."} on state changes
#   WATCHDOG_STATE_FILE     where to remember up/down (default: /tmp/kobeos-watchdog.state)

set -u

DOMAIN="${CF_DOMAIN:-kobeapptz.com}"
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE="${KOBE_COMPOSE:-${ROOT}/server/docker-compose.prod.yml}"
STATE_FILE="${WATCHDOG_STATE_FILE:-/tmp/kobeos-watchdog.state}"
HEALTH_URL="https://api.${DOMAIN}/api/health"

log() { printf '%s watchdog: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Probe the public health URL. 200 = the whole path (DNS → tunnel → nginx →
# api) is healthy. Anything else (000 network, 530/1033 tunnel down, 5xx api
# down) counts as unhealthy.
probe() {
  curl -fsS -m 10 -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000
}

alert() {
  [ -n "${WATCHDOG_ALERT_WEBHOOK:-}" ] || return 0
  curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
    --data "$(printf '{"text":"KobeOS watchdog: %s"}' "$1")" \
    "$WATCHDOG_ALERT_WEBHOOK" >/dev/null 2>&1 || true
}

remember() { printf '%s\n' "$1" > "$STATE_FILE" 2>/dev/null || true; }
previous()  { cat "$STATE_FILE" 2>/dev/null || echo unknown; }

code="$(probe)"
if [ "$code" = "200" ]; then
  if [ "$(previous)" = "down" ]; then
    log "recovered — ${HEALTH_URL} is 200 again"
    alert "api.${DOMAIN} recovered (HTTP 200)"
  fi
  remember up
  exit 0
fi

# One retry to avoid flapping on a transient edge hiccup.
sleep 5
code="$(probe)"
[ "$code" = "200" ] && { remember up; exit 0; }

log "DOWN — ${HEALTH_URL} returned HTTP ${code}; bringing the stack back up"
[ "$(previous)" = "down" ] || alert "api.${DOMAIN} DOWN (HTTP ${code}) — self-healing"
remember down

if command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE" ]; then
  # `up -d` recreates anything stopped/dead and is a no-op for healthy
  # services; then force-restart just the tunnel connectors, which are the
  # usual culprit for a 1033 while the API itself is fine.
  docker compose -f "$COMPOSE" up -d 2>&1 | sed 's/^/  /'
  docker compose -f "$COMPOSE" restart cloudflared cloudflared-ha 2>/dev/null | sed 's/^/  /'
else
  log "docker or compose file not found (${COMPOSE}) — cannot self-heal here"
fi
exit 1
