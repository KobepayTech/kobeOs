#!/usr/bin/env bash
#
# pages-deploy.sh — build the KobeOS SPA and ship it to Cloudflare Pages.
#
# This is publishing "Option 2": the whole app + every tenant storefront is
# served from Cloudflare's edge (one Pages project, wildcard custom domain).
# No tunnel and no origin server for the frontend.
#
# WHAT IT DOES
#   1. Builds the SPA with an absolute API base so storefronts call the
#      backend cross-origin (backend CORS already allows *.kobeapptz.com).
#   2. Drops deploy/_redirects into dist/ (SPA fallback for React Router).
#   3. Uploads dist/ to the `kobeos-app` Pages project via Wrangler.
#
# AUTH (never pass secrets as args — env or interactive login only)
#   Option A:  wrangler login                       # interactive, one-time
#   Option B:  export CLOUDFLARE_API_TOKEN=***       # scopes: Pages:Edit
#              export CLOUDFLARE_ACCOUNT_ID=***       # optional, disambiguates
#
# USAGE
#   ./deploy/pages-deploy.sh                 # build + deploy to production
#   API_BASE=https://api.kobeapptz.com/api ./deploy/pages-deploy.sh
#   BRANCH=preview ./deploy/pages-deploy.sh  # deploy a preview branch
#
set -uo pipefail
if [ -t 1 ]; then G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; B='\033[0;36m'; X='\033[0m'; else G=; R=; Y=; B=; X=; fi
note(){ printf "${B}→ %s${X}\n" "$*"; }
ok(){   printf "  ${G}✓ %s${X}\n" "$*"; }
die(){  printf "  ${R}✗ %s${X}\n" "$*"; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${PAGES_PROJECT:-kobeos-app}"
API_BASE="${API_BASE:-https://api.kobeapptz.com/api}"
TENANT_DOMAIN="${VITE_TENANT_BASE_DOMAIN:-kobeapptz.com}"

command -v npm >/dev/null || die "npm not found"
[ -f "${ROOT}/package.json" ] || die "package.json missing at repo root"

# Wrangler comes from devDeps or npx; prefer the local one for a pinned version.
WRANGLER=(npx --yes wrangler)
if [ -x "${ROOT}/node_modules/.bin/wrangler" ]; then WRANGLER=("${ROOT}/node_modules/.bin/wrangler"); fi

# ── 1. build ──────────────────────────────────────────────────────────────────
note "Building SPA (VITE_API_BASE=${API_BASE})"
( cd "$ROOT" \
    && VITE_API_BASE="$API_BASE" VITE_TENANT_BASE_DOMAIN="$TENANT_DOMAIN" npm run build ) \
  || die "build failed"
[ -d "${ROOT}/dist" ] || die "dist/ not produced by build"
ok "dist/ built"

# ── 2. SPA fallback rules ─────────────────────────────────────────────────────
if [ -f "${ROOT}/deploy/_redirects" ]; then
  cp "${ROOT}/deploy/_redirects" "${ROOT}/dist/_redirects"
  ok "_redirects copied into dist/"
else
  printf "  ${Y}! deploy/_redirects missing — SPA deep links may 404${X}\n"
fi

# ── 3. deploy ─────────────────────────────────────────────────────────────────
note "Deploying dist/ → Pages project '${PROJECT}'"
DEPLOY_ARGS=(pages deploy "${ROOT}/dist" --project-name "$PROJECT")
[ -n "${BRANCH:-}" ] && DEPLOY_ARGS+=(--branch "$BRANCH")
"${WRANGLER[@]}" "${DEPLOY_ARGS[@]}" || die "wrangler pages deploy failed (run 'wrangler login' or set CLOUDFLARE_API_TOKEN)"

printf "\n${G}══ Deployed. ══${X}\n"
printf "First time? Add the custom domains once (dashboard → Pages → %s → Custom domains):\n" "$PROJECT"
printf "  %s   www.%s   *.%s\n" "$TENANT_DOMAIN" "$TENANT_DOMAIN" "$TENANT_DOMAIN"
printf "Then every published store serves instantly at https://<slug>.%s\n" "$TENANT_DOMAIN"
