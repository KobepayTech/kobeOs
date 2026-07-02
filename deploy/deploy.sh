#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KobeOS Frontend Deploy Script — Cloudflare Pages
# ═══════════════════════════════════════════════════════════════════════════════
#
# One-command deploy of the KobeOS frontend to Cloudflare Pages.
# Run this from the deploy/ directory.
#
# Prerequisites:
#   - npm installed
#   - Wrangler CLI installed: npm install -g wrangler
#   - Logged into Cloudflare: wrangler login
#   - Cloudflare Pages project created (or this will create one)
#
# Usage:
#   cd deploy
#   ./deploy.sh [environment]
#
# Environments:
#   production  (default) — deploys with api.kobeapptz.com backend
#   staging     — deploys with api-staging.kobeapptz.com backend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV="${1:-production}"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║        KobeOS Frontend → Cloudflare Pages Deploy               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Environment: $ENV"
echo "  Repo root:   $REPO_ROOT"
echo ""

# ══ Validate prerequisites ════════════════════════════════════════════════════

if ! command -v npm &> /dev/null; then
  echo "❌ npm not found. Install Node.js first: https://nodejs.org"
  exit 1
fi

if ! command -v wrangler &> /dev/null; then
  echo "📦 Installing Wrangler CLI..."
  npm install -g wrangler
fi

if ! wrangler whoami &> /dev/null; then
  echo "🔐 Please login to Cloudflare first:"
  echo "   wrangler login"
  exit 1
fi

echo "✓ Wrangler CLI ready"

# ══ Set project name based on environment ═════════════════════════════════════

case "$ENV" in
  production)
    PAGES_PROJECT="kobeos-app"
    ;;
  staging)
    PAGES_PROJECT="kobeos-app-staging"
    ;;
  *)
    echo "❌ Unknown environment: $ENV"
    echo "   Use: production | staging"
    exit 1
    ;;
esac

echo "  Project:     $PAGES_PROJECT"
echo "  API routing: /api/* → proxied to backend via _redirects"
echo ""

# ══ Install dependencies ══════════════════════════════════════════════════════

echo "📦 Installing dependencies..."
cd "$REPO_ROOT"
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
echo "✓ Dependencies installed"
echo ""

# ══ Build the frontend ════════════════════════════════════════════════════════

echo "🔨 Building frontend..."
echo "   (API_BASE defaults to /api — relative, proxied via _redirects)"
npm run build 2>&1 | tail -10
echo ""

if [ ! -f "$REPO_ROOT/dist/index.html" ]; then
  echo "❌ Build failed — dist/index.html not found"
  exit 1
fi
echo "✓ Build complete"

# ══ Copy deployment files ═════════════════════════════════════════════════════

echo "📋 Copying deployment config files..."
cp "$SCRIPT_DIR/_redirects" "$REPO_ROOT/dist/_redirects"
cp "$SCRIPT_DIR/_headers" "$REPO_ROOT/dist/_headers"

echo "✓ Config files copied"
echo ""

# ══ Deploy to Cloudflare Pages ════════════════════════════════════════════════

echo "🚀 Deploying to Cloudflare Pages..."
echo "   Project: $PAGES_PROJECT"
echo ""
wrangler pages deploy "$REPO_ROOT/dist" --project-name="$PAGES_PROJECT" --branch="$ENV"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEPLOY SUCCESS!                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your KobeOS frontend is now live at:"
echo ""
case "$ENV" in
  production)
    echo "   https://kobeos-app.pages.dev  (Cloudflare domain)"
    echo "   https://app.kobeapptz.com     (your custom domain — set up DNS CNAME)"
    ;;
  staging)
    echo "   https://kobeos-app-staging.pages.dev"
    ;;
esac
echo ""
echo "Next steps:"
echo ""
echo "  1. Add DNS CNAME record in Cloudflare dashboard:"
echo "       Type: CNAME | Name: app | Target: <pages-domain>.pages.dev"
echo ""
echo "  2. Ensure your backend server is running and the tunnel is active:"
echo "       api.kobeapptz.com must route to your server"
echo ""
echo "  3. Update backend CORS to allow the frontend domain:"
echo "       CORS_ORIGIN=https://app.kobeapptz.com,https://kobeos-app.pages.dev"
echo ""
echo "  4. Test by visiting the URL and signing in"
echo ""
