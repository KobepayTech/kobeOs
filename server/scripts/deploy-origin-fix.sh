#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-kobeapptz.com}"
TEST_TENANT="${TEST_TENANT:-tenant-healthcheck}"
TRACK_ID="${TRACK_ID:-KM-TEST}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed on this server." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin is not installed on this server." >&2
  exit 1
fi

if [[ ! -f nginx/certs/wildcard-fullchain.pem || ! -f nginx/certs/wildcard-privkey.pem ]]; then
  cat >&2 <<EOF
ERROR: wildcard certificate files are missing.
Expected:
  server/nginx/certs/wildcard-fullchain.pem
  server/nginx/certs/wildcard-privkey.pem

Create/renew a wildcard cert first, usually with DNS-01, then rerun this script.
EOF
  exit 1
fi

if [[ ! -f nginx/certs/fullchain.pem || ! -f nginx/certs/privkey.pem ]]; then
  echo "WARNING: api cert files fullchain.pem / privkey.pem are missing. API TLS may fail if api.${DOMAIN} points to this nginx." >&2
fi

echo "==> Building and starting KobeOS production stack"
docker compose -f "$COMPOSE_FILE" up -d --build web api nginx

echo "==> Testing nginx config inside container"
docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -t

echo "==> Reloading nginx"
docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload || docker compose -f "$COMPOSE_FILE" restart nginx

echo "==> Container status"
docker compose -f "$COMPOSE_FILE" ps

check_url() {
  local label="$1"
  local url="$2"
  echo
  echo "==> $label: $url"
  curl -k -I --max-time 20 "$url" | sed -n '1,12p'
}

check_body_marker() {
  local label="$1"
  local url="$2"
  echo
  echo "==> Body marker: $label"
  local body
  body="$(curl -k -L --max-time 20 "$url" | head -c 5000 || true)"
  if echo "$body" | grep -qiE 'hostinger|parked domain|domain is parked'; then
    echo "FAIL: Hostinger/parked-domain content is still being served for $url"
    return 1
  fi
  if echo "$body" | grep -qiE '<div id="root"|/assets/|KobeOS|Kobe'; then
    echo "PASS: Looks like the KobeOS SPA bundle for $url"
    return 0
  fi
  echo "WARN: Could not find a clear KobeOS marker for $url. First 400 bytes:"
  echo "$body" | head -c 400
}

check_url "Apex headers" "https://${DOMAIN}/"
check_url "WWW headers" "https://www.${DOMAIN}/"
check_url "Tenant wildcard headers" "https://${TEST_TENANT}.${DOMAIN}/"
check_url "API health headers" "https://api.${DOMAIN}/health"
check_url "SPA /tuma headers" "https://${DOMAIN}/tuma"
check_url "SPA /mzigo deep-link headers" "https://${DOMAIN}/mzigo/track/${TRACK_ID}"

check_body_marker "apex" "https://${DOMAIN}/"
check_body_marker "www" "https://www.${DOMAIN}/"
check_body_marker "tenant wildcard" "https://${TEST_TENANT}.${DOMAIN}/"
check_body_marker "tuma deep link" "https://${DOMAIN}/tuma"
check_body_marker "mzigo deep link" "https://${DOMAIN}/mzigo/track/${TRACK_ID}"

echo
echo "Done. Expected response headers should include: X-Kobe-Origin: web-spa for web routes."
echo "If Hostinger still appears, Cloudflare DNS is still pointing to Hostinger/old origin, or another process owns ports 80/443 on this VPS."
