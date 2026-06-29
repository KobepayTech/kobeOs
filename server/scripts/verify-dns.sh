#!/usr/bin/env bash
#
# verify-dns.sh — sanity-check subdomain DNS + TLS + origin reachability
# after a Cloudflare proxy-mode flip (or any DNS change).
#
# Usage:
#   ./server/scripts/verify-dns.sh                  # defaults to kobeapptz.com
#   ./server/scripts/verify-dns.sh yourdomain.com   # override
#
# Exits non-zero if anything fails so you can run it from cron / CI.

set -u

DOMAIN="${1:-kobeapptz.com}"
EXPECTED_IP="${EXPECTED_IP:-}"   # optional; we'll show what we got
SUBDOMAINS=(api tuma mzigo cargo me track posys app)
RANDOM_TENANT="tenant-$(printf '%04d' $((RANDOM % 10000)))"

# colors (skip if not a tty)
if [ -t 1 ]; then
  G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; B='\033[0;36m'; X='\033[0m'
else
  G=; R=; Y=; B=; X=
fi

PASS=0; FAIL=0; WARN=0
note() { printf "${B}→ %s${X}\n" "$*"; }
ok()   { printf "  ${G}✓${X} %s\n" "$*"; PASS=$((PASS+1)); }
bad()  { printf "  ${R}✗${X} %s\n" "$*"; FAIL=$((FAIL+1)); }
warn() { printf "  ${Y}!${X} %s\n" "$*"; WARN=$((WARN+1)); }

need() { command -v "$1" >/dev/null 2>&1 || { echo "need $1; install it"; exit 2; }; }
need dig
need curl
need openssl

# ── 1. DNS resolution ────────────────────────────────────────────────────────
note "DNS resolution for ${DOMAIN}"
APEX_IP=$(dig +short A "${DOMAIN}" | grep -E '^[0-9.]+$' | head -1)
if [ -z "$APEX_IP" ]; then
  bad "${DOMAIN} (apex) has no A record"
else
  ok "${DOMAIN} → ${APEX_IP}"
fi

for sub in "${SUBDOMAINS[@]}"; do
  IP=$(dig +short A "${sub}.${DOMAIN}" | grep -E '^[0-9.]+$' | head -1)
  if [ -z "$IP" ]; then
    bad "${sub}.${DOMAIN} has no A record"
  else
    ok "${sub}.${DOMAIN} → ${IP}"
  fi
done

# Wildcard coverage probe — random label that nobody pre-created.
note "Wildcard coverage (random label, proves *.${DOMAIN} works)"
RND_IP=$(dig +short A "${RANDOM_TENANT}.${DOMAIN}" | grep -E '^[0-9.]+$' | head -1)
if [ -z "$RND_IP" ]; then
  bad "${RANDOM_TENANT}.${DOMAIN} did not resolve — wildcard is missing"
else
  ok "${RANDOM_TENANT}.${DOMAIN} → ${RND_IP}  (wildcard works)"
fi

# Optional: warn if apex IP differs from subdomain IPs (mixed proxy mode).
if [ -n "$APEX_IP" ]; then
  MISMATCH=0
  for sub in tuma mzigo posys; do
    SUB_IP=$(dig +short A "${sub}.${DOMAIN}" | grep -E '^[0-9.]+$' | head -1)
    [ -n "$SUB_IP" ] && [ "$SUB_IP" != "$APEX_IP" ] && MISMATCH=1
  done
  if [ "$MISMATCH" = 1 ]; then
    warn "apex IP differs from some subdomain IPs — likely mixed Cloudflare proxy mode (apex orange, wildcard grey OR vice-versa). Align them per DNS-INSTRUCTIONS.md."
  else
    ok "apex + subdomains share the same IP (uniform proxy mode)"
  fi
fi

# ── 2. HTTPS reachability + cert chain ────────────────────────────────────────
note "HTTPS reachability"
probe_https() {
  local host="$1" expect_code="$2"
  local code
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 "https://${host}/" || echo 000)
  if [ "$code" = "$expect_code" ] || { [ "$expect_code" = "any" ] && [ "$code" != "000" ]; }; then
    ok "https://${host}/ → ${code}"
  else
    bad "https://${host}/ → ${code} (expected ${expect_code})"
  fi
}
probe_https "${DOMAIN}"            200
probe_https "tuma.${DOMAIN}"       200
probe_https "mzigo.${DOMAIN}"      200
probe_https "posys.${DOMAIN}"      200
probe_https "me.${DOMAIN}"         200
probe_https "${RANDOM_TENANT}.${DOMAIN}" any  # tenant slug may 404 on the API for a non-existent slug, but the SPA itself must load

# API health endpoint — separate cert chain in some setups.
note "API health"
if curl -sf --max-time 8 "https://api.${DOMAIN}/health" >/dev/null; then
  ok "https://api.${DOMAIN}/health → 200"
else
  bad "https://api.${DOMAIN}/health did not return 2xx"
fi

# ── 3. Cert chain — wildcard SAN + expiry ────────────────────────────────────
note "TLS certificate(s)"
inspect_cert() {
  local host="$1"
  local cert
  cert=$(echo | openssl s_client -servername "$host" -connect "${host}:443" 2>/dev/null \
    | openssl x509 -noout -subject -ext subjectAltName -enddate 2>/dev/null) || {
    bad "${host}: could not fetch cert"; return;
  }
  local sans expiry
  sans=$(echo "$cert" | grep -A1 'X509v3 Subject Alternative Name' | tail -1 | tr ',' '\n' | sed 's/^[[:space:]]*//')
  expiry=$(echo "$cert" | grep -i 'notAfter=' | sed 's/notAfter=//')

  if echo "$sans" | grep -qx "DNS:\*\.${DOMAIN}"; then
    ok "${host}: wildcard SAN present  (expires ${expiry})"
  elif echo "$sans" | grep -qx "DNS:${host}"; then
    warn "${host}: single-host cert only (no wildcard SAN). Fine if you issue per-host, but you'll need a new cert for every new subdomain."
  else
    bad "${host}: cert SAN does not cover this host  (have: $(echo "$sans" | tr '\n' ' '))"
  fi
}
inspect_cert "${DOMAIN}"
inspect_cert "tuma.${DOMAIN}"
inspect_cert "api.${DOMAIN}"

# ── 4. Headers that prove origin behaviour, not CF edge behaviour ────────────
note "Origin behaviour signals"
# server header — origin nginx should be 'nginx/<version>'. CF rewrites to 'cloudflare'.
hdr=$(curl -sIk --max-time 6 "https://tuma.${DOMAIN}/" | tr -d '\r' | awk -F': ' '/^[Ss]erver:/{print $2}' | head -1)
case "${hdr,,}" in
  cloudflare*) warn "tuma.${DOMAIN} responded with Server: ${hdr}  → traffic is going through Cloudflare proxy (orange cloud). DNS-INSTRUCTIONS.md recommends grey for KobeOS." ;;
  nginx*)      ok   "tuma.${DOMAIN} responded with Server: ${hdr}  → direct to origin nginx" ;;
  '')          warn "tuma.${DOMAIN} returned no Server header" ;;
  *)           warn "tuma.${DOMAIN} Server: ${hdr}  (unexpected)" ;;
esac

# CF-Ray header proves Cloudflare touched it.
if curl -sIk --max-time 6 "https://${DOMAIN}/" | grep -qi '^cf-ray:'; then
  warn "${DOMAIN}: CF-Ray header present → apex is proxied. KobeOS rate limiter needs Transform Rule (cf.connecting_ip → X-Real-IP) — see DNS-INSTRUCTIONS.md."
else
  ok "${DOMAIN}: no CF-Ray → direct to origin"
fi

# ── 5. SPA fallback sanity ───────────────────────────────────────────────────
note "SPA fallback (deep links should serve index.html, not 404)"
for path in /tuma /mzigo /mzigo/track/KM-TEST /me /posys /track/PA-TEST; do
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 6 "https://${DOMAIN}${path}")
  if [ "$code" = "200" ]; then
    ok "GET ${path} → 200"
  else
    bad "GET ${path} → ${code} (SPA fallback broken or origin not serving the bundle)"
  fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
printf "\n"
printf "${G}✓ %d passed${X}    ${Y}! %d warning${X}    ${R}✗ %d failed${X}\n" "$PASS" "$WARN" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  printf "${R}DNS / TLS / origin not ready.${X} Re-check server/DNS-INSTRUCTIONS.md.\n"
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  printf "${Y}Setup is reachable but not aligned with the recommended config.${X}\n"
  exit 0   # warnings are non-fatal
fi
printf "${G}All checks passed.${X} Subdomains are live.\n"
exit 0
