#!/usr/bin/env bash
#
# cf-setup.sh — one-time Cloudflare setup for KobeOS hosted publishing.
#
# Idempotently provisions the shared wildcard tunnel + *.kobeapptz.com
# CNAME so that every store publishes instantly on {slug}.kobeapptz.com.
# Mirrors exactly what CloudflareService.bootstrapWildcardTunnel() does,
# so running this script and hitting the app's bootstrap endpoint are
# interchangeable and never fight.
#
# SECURITY: the API token is read ONLY from the CF_API_TOKEN environment
# variable — never a command-line argument (args show in `ps` and shell
# history). Nothing here echoes the API token.
#
# USAGE
#   export CF_API_TOKEN=***          # required; scopes below
#   export CF_ACCOUNT_ID=***         # optional — auto-resolved if unset
#   export CF_ZONE_ID=***            # optional — auto-resolved from domain
#   export CF_DOMAIN=kobeapptz.com   # optional — default kobeapptz.com
#   export KOBE_LOCAL_PORT=3000      # optional — tunnel ingress target
#
#   ./deploy/cf-setup.sh             # DRY RUN — shows what it would do
#   ./deploy/cf-setup.sh --apply     # actually make the changes
#
# REQUIRED API TOKEN SCOPES (dash.cloudflare.com → My Profile → API Tokens):
#   Account → Cloudflare Tunnel → Edit
#   Zone    → DNS → Edit            (on the kobeapptz.com zone)
#   Zone    → Zone → Read
#
# On success it prints the cloudflared RUN token (needed to run the
# tunnel). Persist it as CLOUDFLARED_TOKEN and run cloudflared as a
# service — e.g.  cloudflared tunnel run --token "$CLOUDFLARED_TOKEN".

set -uo pipefail

# ── args ─────────────────────────────────────────────────────────────────────
APPLY=0
for arg in "$@"; do
  case "$arg" in
    --apply) APPLY=1 ;;
    --dry-run) APPLY=0 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg (use --apply or --dry-run)"; exit 2 ;;
  esac
done

# ── colors ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; B='\033[0;36m'; X='\033[0m'; else G=; R=; Y=; B=; X=; fi
note() { printf "${B}→ %s${X}\n" "$*"; }
ok()   { printf "  ${G}✓${X} %s\n" "$*"; }
bad()  { printf "  ${R}✗ %s${X}\n" "$*"; }
warn() { printf "  ${Y}! %s${X}\n" "$*"; }
die()  { bad "$*"; exit 1; }

# ── deps ─────────────────────────────────────────────────────────────────────
command -v curl >/dev/null || die "curl is required"
command -v jq   >/dev/null || die "jq is required (apt-get install jq / brew install jq)"

# ── config ───────────────────────────────────────────────────────────────────
: "${CF_API_TOKEN:?CF_API_TOKEN env var is required — export it, do not pass it as an arg}"
CF_DOMAIN="${CF_DOMAIN:-kobeapptz.com}"
KOBE_LOCAL_PORT="${KOBE_LOCAL_PORT:-3000}"
TUNNEL_NAME="kobeos-storefronts"
WILDCARD="*.${CF_DOMAIN}"
API="https://api.cloudflare.com/client/v4"

if [ "$APPLY" -eq 1 ]; then
  printf "${Y}══ APPLY MODE — changes WILL be made to Cloudflare ══${X}\n\n"
else
  printf "${B}══ DRY RUN — no changes will be made (pass --apply to execute) ══${X}\n\n"
fi

# cf <METHOD> <path> [json-body] → prints .result, dies on API error
cf() {
  local method="$1" path="$2" body="${3:-}"
  local resp
  if [ -n "$body" ]; then
    resp=$(curl -sS -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body")
  else
    resp=$(curl -sS -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json")
  fi
  # return (not exit) on API error so callers in $(...) see a non-zero
  # exit and can `|| die` — an `exit` here would only kill the subshell
  # and let the parent script barrel on with an empty result.
  if [ "$(echo "$resp" | jq -r '.success')" != "true" ]; then
    bad "Cloudflare API error on ${method} ${path}:"
    echo "$resp" | jq -r '.errors[]? | "    - [\(.code)] \(.message)"' >&2
    return 1
  fi
  echo "$resp" | jq -c '.result'
}

# ── 1. verify token ──────────────────────────────────────────────────────────
note "Verifying API token"
VERIFY=$(cf GET "/user/tokens/verify") || die "Token verification failed — check CF_API_TOKEN"
status=$(echo "$VERIFY" | jq -r '.status // empty')
[ "$status" = "active" ] && ok "Token is active" || die "Token status: ${status:-unknown}"

# ── 2. resolve account id ────────────────────────────────────────────────────
note "Resolving account"
if [ -n "${CF_ACCOUNT_ID:-}" ]; then
  ACCOUNT_ID="$CF_ACCOUNT_ID"; ok "Using CF_ACCOUNT_ID from env: ${ACCOUNT_ID}"
else
  ACCT=$(cf GET "/accounts?per_page=50") || die "Could not list accounts — set CF_ACCOUNT_ID"
  ACCOUNT_ID=$(echo "$ACCT" | jq -r '.[0].id // empty')
  [ -n "$ACCOUNT_ID" ] || die "No account found — set CF_ACCOUNT_ID"
  ok "Auto-resolved account: ${ACCOUNT_ID}"
fi

# ── 3. resolve zone id ───────────────────────────────────────────────────────
note "Resolving zone for ${CF_DOMAIN}"
if [ -n "${CF_ZONE_ID:-}" ]; then
  ZONE_ID="$CF_ZONE_ID"; ok "Using CF_ZONE_ID from env: ${ZONE_ID}"
else
  ZRES=$(cf GET "/zones?name=${CF_DOMAIN}") || die "Could not query zones — set CF_ZONE_ID"
  ZONE_ID=$(echo "$ZRES" | jq -r '.[0].id // empty')
  [ -n "$ZONE_ID" ] || die "No zone found for ${CF_DOMAIN} — is the domain on this account? Set CF_ZONE_ID"
  ok "Zone: ${ZONE_ID}"
fi

# ── 4. shared tunnel ─────────────────────────────────────────────────────────
note "Shared wildcard tunnel '${TUNNEL_NAME}'"
TLIST=$(cf GET "/accounts/${ACCOUNT_ID}/cfd_tunnel?name=${TUNNEL_NAME}&is_deleted=false") || die "Could not list tunnels"
TUNNEL_ID=$(echo "$TLIST" | jq -r '.[0].id // empty')
if [ -n "$TUNNEL_ID" ]; then
  ok "Reusing existing tunnel: ${TUNNEL_ID}"
elif [ "$APPLY" -eq 1 ]; then
  SECRET=$(openssl rand -base64 32)
  TUNNEL_BODY=$(jq -nc --arg n "$TUNNEL_NAME" --arg s "$SECRET" '{name:$n, tunnel_secret:$s}')
  TCREATE=$(cf POST "/accounts/${ACCOUNT_ID}/cfd_tunnel" "$TUNNEL_BODY") || die "Tunnel create failed"
  TUNNEL_ID=$(echo "$TCREATE" | jq -r '.id')
  ok "Created tunnel: ${TUNNEL_ID}"
else
  warn "Would CREATE tunnel '${TUNNEL_NAME}'"
fi

# ── 5. tunnel CNAMEs: wildcard + apex + www ──────────────────────────────────
# Point *.kobeapptz.com AND the apex kobeapptz.com (+ www) at the tunnel.
# The apex is easy to forget — if a leftover registrar/parking record is
# still there (e.g. Hostinger "Parked Domain"), the wildcard works but the
# root serves the parking page. Cloudflare CNAME-flattening makes a root
# CNAME to cfargotunnel valid.
CFARGO="${TUNNEL_ID}.cfargotunnel.com"

# upsert_cname <record-name>  — idempotent CNAME → the tunnel, proxied.
# ANY existing record with that name (CNAME or a stale A) is replaced,
# so a parked A record at the apex gets overwritten.
upsert_cname() {
  local name="$1"
  local existing
  existing=$(cf GET "/zones/${ZONE_ID}/dns_records?name=${name}") || die "Could not list DNS for ${name}"
  local rid rtype
  rid=$(echo "$existing" | jq -r '.[0].id // empty')
  rtype=$(echo "$existing" | jq -r '.[0].type // empty')
  local body
  body=$(jq -nc --arg n "$name" --arg c "$CFARGO" '{type:"CNAME", name:$n, content:$c, proxied:true, ttl:1}')
  if [ "$APPLY" -eq 1 ] && [ -n "$TUNNEL_ID" ]; then
    if [ -n "$rid" ]; then
      cf PUT "/zones/${ZONE_ID}/dns_records/${rid}" "$body" >/dev/null
      ok "Updated ${name} (${rtype}→CNAME) → ${CFARGO}"
    else
      cf POST "/zones/${ZONE_ID}/dns_records" "$body" >/dev/null
      ok "Created ${name} CNAME → ${CFARGO}"
    fi
  else
    if [ -n "$rid" ]; then
      warn "Would REPLACE ${name} (currently ${rtype}, id ${rid}) → tunnel CNAME"
    else
      warn "Would CREATE ${name} CNAME → tunnel"
    fi
  fi
}

note "Routing DNS → tunnel: ${WILDCARD}, ${CF_DOMAIN} (apex), www.${CF_DOMAIN}"
upsert_cname "${WILDCARD}"
upsert_cname "${CF_DOMAIN}"
upsert_cname "www.${CF_DOMAIN}"

# ── 6. catch-all ingress ─────────────────────────────────────────────────────
# Where the tunnel forwards traffic. Override for your topology:
#   Host install (app on the host, port ${KOBE_LOCAL_PORT} mapped):
#       KOBE_INGRESS_URL=http://localhost:${KOBE_LOCAL_PORT}   (default)
#   Docker compose (cloudflared runs as a container on kobe-net):
#       KOBE_INGRESS_URL=https://nginx:443 KOBE_INGRESS_NO_TLS_VERIFY=1
#       — routes through nginx so api.* → api and everything else → the
#         web/SPA container, exactly as the 443 server blocks intend.
INGRESS_URL="${KOBE_INGRESS_URL:-http://localhost:${KOBE_LOCAL_PORT}}"
NO_TLS="${KOBE_INGRESS_NO_TLS_VERIFY:-}"
note "Tunnel ingress → ${INGRESS_URL} (catch-all)${NO_TLS:+ [noTLSVerify]}"
if [ "$APPLY" -eq 1 ] && [ -n "$TUNNEL_ID" ]; then
  if [ -n "$NO_TLS" ]; then
    ING=$(jq -nc --arg svc "$INGRESS_URL" '{config:{ingress:[{service:$svc, originRequest:{noTLSVerify:true}}]}}')
  else
    ING=$(jq -nc --arg svc "$INGRESS_URL" '{config:{ingress:[{service:$svc}]}}')
  fi
  cf PUT "/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" "$ING" >/dev/null
  ok "Ingress configured"
else
  warn "Would set catch-all ingress → ${INGRESS_URL}${NO_TLS:+ [noTLSVerify]}"
fi

# ── 7. run token + next steps ────────────────────────────────────────────────
printf "\n"
if [ "$APPLY" -eq 1 ] && [ -n "$TUNNEL_ID" ]; then
  TRESP=$(cf GET "/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/token") || die "Could not fetch run token"
  RUN_TOKEN=$(echo "$TRESP" | jq -r '.')
  printf "${G}══ DONE ══${X}\n\n"
  printf "Persist this cloudflared RUN token (NOT your API token) and run the tunnel:\n\n"
  printf "  ${B}export CLOUDFLARED_TOKEN='%s'${X}\n" "$RUN_TOKEN"
  printf "  ${B}cloudflared tunnel run --token \"\$CLOUDFLARED_TOKEN\"${X}\n\n"
  printf "Then add CLOUDFLARED_TOKEN to server/.env and run cloudflared as a\n"
  printf "systemd service (or the compose tunnel container) so it survives reboots.\n\n"
  printf "After that, every store's Publish click is live instantly at\n"
  printf "  https://<slug>.${CF_DOMAIN}\n"
else
  printf "${Y}Dry run complete.${X} Re-run with ${B}--apply${X} to make the changes above.\n"
  printf "Also confirm DNS: the wildcard record is created here, but the zone's\n"
  printf "nameservers must point at Cloudflare for it to resolve.\n"
fi
