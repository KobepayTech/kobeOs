#!/usr/bin/env bash
#
# go-live.sh — one command to finish Cloudflare tunnel publishing on the
# Docker-compose stack, then self-test until subdomains actually serve.
#
# RUN THIS ON THE PRODUCTION SERVER (the host running docker compose),
# from the repo root. It does what a human would do by hand:
#   1. Point the tunnel ingress at nginx (compose topology)
#   2. Bring up the cloudflared container (--protocol http2)
#   3. Poll a random *.kobeapptz.com until it stops returning 530
#
# PREREQUISITES (env vars — never pass secrets as args):
#   export CF_API_TOKEN=***          # scopes: Tunnel:Edit, DNS:Edit, Zone:Read
#   # CLOUDFLARED_TOKEN must be in server/.env (from deploy/cf-setup.sh output)
#
# USAGE:
#   ./deploy/go-live.sh

set -uo pipefail
if [ -t 1 ]; then G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; B='\033[0;36m'; X='\033[0m'; else G=; R=; Y=; B=; X=; fi
note(){ printf "${B}→ %s${X}\n" "$*"; }
ok(){   printf "  ${G}✓ %s${X}\n" "$*"; }
bad(){  printf "  ${R}✗ %s${X}\n" "$*"; }
die(){  bad "$*"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="${ROOT}/server/docker-compose.prod.yml"
DOMAIN="${CF_DOMAIN:-kobeapptz.com}"

command -v docker >/dev/null || die "docker not found — run this on the server"
command -v curl   >/dev/null || die "curl not found"
[ -f "$COMPOSE" ] || die "compose file missing at ${COMPOSE}"
: "${CF_API_TOKEN:?export CF_API_TOKEN (see deploy/CLOUDFLARE-CHECKLIST.md)}"

# server/.env must carry the run token for the cloudflared container.
if ! grep -q '^CLOUDFLARED_TOKEN=' "${ROOT}/server/.env" 2>/dev/null; then
  die "CLOUDFLARED_TOKEN not in server/.env — add it (from ./deploy/cf-setup.sh output)"
fi

# ── 1. point ingress at nginx (compose) ──────────────────────────────────────
note "Pointing tunnel ingress at nginx (compose topology)"
KOBE_INGRESS_URL="https://nginx:443" KOBE_INGRESS_NO_TLS_VERIFY=1 \
  "${ROOT}/deploy/cf-setup.sh" --apply || die "cf-setup.sh failed"

# ── 2. bring up cloudflared ──────────────────────────────────────────────────
note "Starting cloudflared container (--protocol http2)"
docker compose -f "$COMPOSE" up -d cloudflared || die "compose up cloudflared failed"

# ── 3. self-test: poll a random subdomain until it stops 530'ing ─────────────
SLUG="live-check-$$"
HOST="${SLUG}.${DOMAIN}"
note "Waiting for the tunnel to serve https://${HOST} (up to 90s)"
deadline=$(( $(date +%s) + 90 ))
code=000
while [ "$(date +%s)" -lt "$deadline" ]; do
  code=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "https://${HOST}" 2>/dev/null || echo 000)
  # 530 = tunnel not connected; 000 = network hiccup. Anything else = the
  # edge reached an origin (200/404/etc all prove the tunnel is up).
  if [ "$code" != "530" ] && [ "$code" != "000" ]; then break; fi
  printf "  … still %s\n" "$code"
  sleep 5
done

printf "\n"
if [ "$code" = "530" ] || [ "$code" = "000" ]; then
  bad "Tunnel still not serving (last HTTP ${code}). cloudflared logs:"
  docker compose -f "$COMPOSE" logs --tail=40 cloudflared 2>&1 | sed 's/^/    /'
  printf "\n${Y}Most likely: QUIC/UDP-7844 still blocked (we already force http2) or\n"
  printf "the run token is wrong. Check the log lines above for 'Registered tunnel\n"
  printf "connection' (good) vs 'failed to dial'/'Unauthorized'.${X}\n"
  exit 1
fi

ok "Tunnel is live — https://${HOST} returned HTTP ${code} (not 530)"
note "Verifying api + apex"
api=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "https://api.${DOMAIN}/api/health" 2>/dev/null || echo 000)
apex=$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "https://${DOMAIN}" 2>/dev/null || echo 000)
[ "$api" = "200" ] && ok "api health → 200" || printf "  ${Y}! api health → %s (check the api container + /health path)${X}\n" "$api"
[ "$apex" = "200" ] && ok "apex → 200" || printf "  ${Y}! apex → %s${X}\n" "$apex"

printf "\n${G}══ Publishing is live. ══${X}\n"
printf "Create a store in the Store Editor → Publish → it serves instantly at\n"
printf "  https://<slug>.${DOMAIN}\n"
