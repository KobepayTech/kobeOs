#!/usr/bin/env bash
#
# make-stores-live.sh — point kobeapptz.com at THIS server and go live.
#
# The simplest path to live: your docker-compose nginx already serves the
# SPA for every subdomain and routes api.* → the backend. So all that's
# missing is DNS. This script replaces the leftover Hostinger "parked"
# records with proxied A records → this server, for:
#
#     kobeapptz.com   (apex)      www.kobeapptz.com
#     *.kobeapptz.com (every store)   api.kobeapptz.com (backend)
#
# After it runs, every published store is live at {slug}.kobeapptz.com and
# "Backend unreachable" clears because api.kobeapptz.com finally reaches
# your NestJS API.
#
# RUN THIS ON THE PRODUCTION SERVER (the box running docker compose).
#
# SECURITY: the API token is read ONLY from CF_API_TOKEN (never an arg —
# args leak into `ps` and shell history). Nothing here echoes it.
#
# USAGE
#   export CF_API_TOKEN=***            # scopes: Zone→DNS→Edit, Zone→Zone→Read
#   ./deploy/make-stores-live.sh              # DRY RUN — shows what it would do
#   ./deploy/make-stores-live.sh --apply      # make the changes + verify
#
# OPTIONS (env)
#   KOBE_SERVER_IP=1.2.3.4   # skip auto-detect; use this public IP
#   CF_DOMAIN=kobeapptz.com  # default kobeapptz.com
#   CF_ZONE_ID / CF_ACCOUNT_ID  # optional — auto-resolved from the domain
#
# PREREQ ON CLOUDFLARE: SSL/TLS mode should be "Full" (not "Full (strict)")
# so Cloudflare accepts nginx's self-signed origin cert. Overview → SSL/TLS.

set -uo pipefail

APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg (use --apply or --dry-run)"; exit 2 ;;
  esac
done

if [ -t 1 ]; then G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; B='\033[0;36m'; X='\033[0m'; else G=; R=; Y=; B=; X=; fi
note() { printf "${B}→ %s${X}\n" "$*"; }
ok()   { printf "  ${G}✓${X} %s\n" "$*"; }
bad()  { printf "  ${R}✗ %s${X}\n" "$*"; }
warn() { printf "  ${Y}! %s${X}\n" "$*"; }
die()  { bad "$*"; exit 1; }

command -v curl >/dev/null || die "curl is required"
command -v jq   >/dev/null || die "jq is required (apt-get install jq)"

: "${CF_API_TOKEN:?CF_API_TOKEN env var is required — export it, do not pass it as an arg}"
CF_DOMAIN="${CF_DOMAIN:-kobeapptz.com}"
WILDCARD="*.${CF_DOMAIN}"
API="https://api.cloudflare.com/client/v4"

if [ "$APPLY" -eq 1 ]; then
  printf "${Y}══ APPLY MODE — DNS changes WILL be made on Cloudflare ══${X}\n\n"
else
  printf "${B}══ DRY RUN — no changes (pass --apply to execute) ══${X}\n\n"
fi

# cf <METHOD> <path> [json-body] → prints .result, returns non-zero on error.
cf() {
  local method="$1" path="$2" body="${3:-}" resp
  if [ -n "$body" ]; then
    resp=$(curl -sS -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" --data "$body")
  else
    resp=$(curl -sS -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json")
  fi
  if [ "$(echo "$resp" | jq -r '.success')" != "true" ]; then
    bad "Cloudflare API error on ${method} ${path}:"
    echo "$resp" | jq -r '.errors[]? | "    - [\(.code)] \(.message)"' >&2
    return 1
  fi
  echo "$resp" | jq -c '.result'
}

# ── 1. determine this server's public IP ──────────────────────────────────────
note "Determining this server's public IP"
if [ -n "${KOBE_SERVER_IP:-}" ]; then
  SERVER_IP="$KOBE_SERVER_IP"; ok "Using KOBE_SERVER_IP=${SERVER_IP}"
else
  # Cloudflare's own trace is the most reliable; fall back to ipify.
  SERVER_IP=$(curl -sS -m 10 https://cloudflare.com/cdn-cgi/trace 2>/dev/null | sed -n 's/^ip=//p')
  [ -n "$SERVER_IP" ] || SERVER_IP=$(curl -sS -m 10 https://api.ipify.org 2>/dev/null || true)
  [ -n "$SERVER_IP" ] || die "Could not auto-detect public IP — set KOBE_SERVER_IP=<ip>"
  ok "Detected public IP: ${SERVER_IP}"
fi
# Sanity: looks like an IPv4 address.
echo "$SERVER_IP" | grep -qE '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' \
  || warn "‘${SERVER_IP}’ doesn't look like an IPv4 — double-check KOBE_SERVER_IP"

# ── 2. verify token, resolve zone ─────────────────────────────────────────────
note "Verifying API token"
VERIFY=$(cf GET "/user/tokens/verify") || die "Token verification failed — check CF_API_TOKEN"
[ "$(echo "$VERIFY" | jq -r '.status // empty')" = "active" ] && ok "Token is active" || die "Token not active"

note "Resolving zone for ${CF_DOMAIN}"
if [ -n "${CF_ZONE_ID:-}" ]; then
  ZONE_ID="$CF_ZONE_ID"; ok "Using CF_ZONE_ID from env"
else
  ZRES=$(cf GET "/zones?name=${CF_DOMAIN}") || die "Could not query zones — set CF_ZONE_ID"
  ZONE_ID=$(echo "$ZRES" | jq -r '.[0].id // empty')
  [ -n "$ZONE_ID" ] || die "No zone for ${CF_DOMAIN} on this account — set CF_ZONE_ID"
  ok "Zone: ${ZONE_ID}"
fi

# ── 3. upsert proxied A records → this server ─────────────────────────────────
# Replaces ANY existing record of that name (including the stale Hostinger
# parking record) with a proxied A → SERVER_IP.
upsert_a() {
  local name="$1" existing rid rtype body
  existing=$(cf GET "/zones/${ZONE_ID}/dns_records?name=${name}") || die "Could not list DNS for ${name}"
  rid=$(echo "$existing" | jq -r '.[0].id // empty')
  rtype=$(echo "$existing" | jq -r '.[0].type // empty')
  body=$(jq -nc --arg n "$name" --arg c "$SERVER_IP" '{type:"A", name:$n, content:$c, proxied:true, ttl:1}')
  if [ "$APPLY" -eq 1 ]; then
    if [ -n "$rid" ]; then
      cf PUT "/zones/${ZONE_ID}/dns_records/${rid}" "$body" >/dev/null || die "Update ${name} failed"
      ok "Updated ${name} (${rtype}→A) → ${SERVER_IP} [proxied]"
    else
      cf POST "/zones/${ZONE_ID}/dns_records" "$body" >/dev/null || die "Create ${name} failed"
      ok "Created ${name} A → ${SERVER_IP} [proxied]"
    fi
  else
    if [ -n "$rid" ]; then
      warn "Would REPLACE ${name} (currently ${rtype}) → A ${SERVER_IP} [proxied]"
    else
      warn "Would CREATE ${name} A → ${SERVER_IP} [proxied]"
    fi
  fi
}

note "Pointing DNS at this server: ${CF_DOMAIN}, www, ${WILDCARD}, api"
upsert_a "${CF_DOMAIN}"
upsert_a "www.${CF_DOMAIN}"
upsert_a "${WILDCARD}"
upsert_a "api.${CF_DOMAIN}"

# ── 4. verify go-live ─────────────────────────────────────────────────────────
printf "\n"
if [ "$APPLY" -ne 1 ]; then
  printf "${Y}Dry run complete.${X} Re-run with ${B}--apply${X} to make the changes above.\n"
  exit 0
fi

note "Verifying (DNS + Cloudflare propagate in a few seconds)"
check() { # host expected-substring-absent
  local host="$1" body
  body=$(curl -sS -m 10 "https://${host}" 2>/dev/null || true)
  if echo "$body" | grep -qi "Parked Domain"; then echo "parked"; return; fi
  echo "$body" | grep -qiE '<title>|<!doctype|kobe|<div id="root"' && echo "serving" || echo "empty"
}
api_health() { curl -sS -m 10 "https://api.${CF_DOMAIN}/api/health" 2>/dev/null || true; }

deadline=$(( $(date +%s) + 60 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  APEX=$(check "${CF_DOMAIN}")
  H=$(api_health)
  if [ "$APEX" = "serving" ] && echo "$H" | grep -q '"db"'; then break; fi
  printf "  … apex=%s  api-health=%s\n" "$APEX" "$(echo "$H" | grep -oE '"db":"[a-z]+"' || echo pending)"
  sleep 5
done

printf "\n"
APEX=$(check "${CF_DOMAIN}")
H=$(api_health)
[ "$APEX" = "serving" ] && ok "apex serves the app (no longer parked)" || warn "apex still: ${APEX}"
if echo "$H" | grep -q '"db":"connected"'; then
  ok "api.${CF_DOMAIN}/api/health → database connected"
  printf "\n${G}══ Stores are live. ══${X}\n"
  printf "Publish a store → it serves instantly at https://<slug>.${CF_DOMAIN}\n"
else
  warn "api health not green yet: $(echo "$H" | head -c 120)"
  printf "\n${Y}DNS is pointed correctly. If api health isn't green:${X}\n"
  printf "  • Is the stack up?   docker compose -f server/docker-compose.prod.yml ps\n"
  printf "  • Is 443 open to the internet on this box (cloud firewall / security group)?\n"
  printf "  • Cloudflare SSL/TLS mode = Full (Overview → SSL/TLS), not Full(strict).\n"
  printf "  • If this box has NO public IP / can't open 443, use the tunnel instead:\n"
  printf "      ./deploy/go-live.sh\n"
fi
