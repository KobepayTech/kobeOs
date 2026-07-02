#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# KobeOS Storefront Setup Script — Run this ONCE on your KobeOS server
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script:
#   1. Installs dependencies (root + server)
#   2. Builds the storefront SPA
#   3. Sets up the database migration
#   4. Configures Cloudflare env vars
#   5. Starts the server
#
# Usage:
#   chmod +x setup-storefront.sh
#   ./setup-storefront.sh
#
# Prerequisites:
#   - Node.js 20+ installed
#   - PostgreSQL running with kobeos database
#   - CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID set below

set -e  # Exit on any error

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║          KobeOS Storefront — Zero-Config Setup                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ══ CONFIGURE THESE 3 VALUES ═════════════════════════════════════════════════
# Get them from your Cloudflare dashboard (dash.cloudflare.com):
#
# CF_API_TOKEN:   My Profile → API Tokens → Create Token →
#                 Use template "Cloudflare Tunnel:Edit" + "Zone:DNS:Edit"
#                 OR: Custom token with Account:Cloudflare Tunnel:Edit,
#                      Zone:DNS:Edit, Zone:Zone:Read
#
# CF_ACCOUNT_ID:  Dashboard top-right corner (click the domain dropdown)
# CF_ZONE_ID:     kobeapptz.com domain → Overview → right sidebar
#
CF_API_TOKEN="${CF_API_TOKEN:-}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:-}"
CF_ZONE_ID="${CF_ZONE_ID:-}"

# You can also set these as environment variables before running:
#   export CF_API_TOKEN=your_token
#   export CF_ACCOUNT_ID=your_account_id
#   export CF_ZONE_ID=your_zone_id
#   ./setup-storefront.sh

if [ -z "$CF_API_TOKEN" ] || [ -z "$CF_ACCOUNT_ID" ] || [ -z "$CF_ZONE_ID" ]; then
  echo "❌ ERROR: Cloudflare credentials not set!"
  echo ""
  echo "Edit this script and set these 3 values at the top:"
  echo "  CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID"
  echo ""
  echo "Or set them as environment variables before running:"
  echo "  export CF_API_TOKEN=your_token"
  echo "  export CF_ACCOUNT_ID=your_account_id"
  echo "  export CF_ZONE_ID=your_zone_id"
  echo ""
  exit 1
fi

echo "✓ Cloudflare credentials found"
echo ""

# ══ STEP 1: Install root dependencies ════════════════════════════════════════
echo "📦 Step 1/5: Installing root dependencies..."
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
echo "✓ Root dependencies installed"
echo ""

# ══ STEP 2: Build the storefront SPA ═════════════════════════════════════════
echo "🔨 Step 2/5: Building storefront SPA..."
npm run build 2>&1 | tail -10

if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
  echo "❌ Build failed — dist/index.html not found"
  exit 1
fi
echo "✓ SPA built successfully → dist/"
echo ""

# ══ STEP 3: Install server dependencies ══════════════════════════════════════
echo "📦 Step 3/5: Installing server dependencies..."
cd server
npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
echo "✓ Server dependencies installed"
echo ""

# ══ STEP 4: Configure environment ════════════════════════════════════════════
echo "⚙️  Step 4/5: Configuring environment..."

# Create .env from example if it doesn't exist
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example"
fi

# Helper: add or update env var in .env
set_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^$key=" .env; then
    # Update existing
    sed -i "s|^$key=.*|$key=$value|" .env
  else
    # Add new
    echo "$key=$value" >> .env
  fi
}

# Set Cloudflare credentials
set_env_var "CF_API_TOKEN" "$CF_API_TOKEN"
set_env_var "CF_ACCOUNT_ID" "$CF_ACCOUNT_ID"
set_env_var "CF_ZONE_ID" "$CF_ZONE_ID"

# Production settings
set_env_var "NODE_ENV" "production"
set_env_var "PORT" "3000"
set_env_var "DB_SYNCHRONIZE" "false"
set_env_var "DB_MIGRATIONS_RUN" "true"

echo "✓ Environment configured in .env"
echo ""

# ══ STEP 5: Build server & run migration ═════════════════════════════════════
echo "🔨 Step 5/5: Building server & running migration..."
npm run build 2>&1 | tail -5

# Run the template migration
npx typeorm-ts-node-commonjs migration:run -d dist/config/data-source.js 2>&1 || true

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ SETUP COMPLETE!                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the server:"
echo "       cd server && npm run start:prod"
echo ""
echo "  2. Open KobeOS, go to Store Editor, click 'Publish'"
echo ""
echo "  3. Your store will be live at:"
echo "       https://<your-store-name>.kobeapptz.com"
echo ""
echo "  4. (First time only) As admin, bootstrap the wildcard tunnel:"
echo "       POST /api/store-settings/admin/bootstrap-wildcard"
echo "     Or in the Store Editor, there's a 'Bootstrap Tunnel' button"
echo "     in System Settings → Store Publishing"
echo ""
echo "  The bootstrap creates:"
echo "    • Shared Cloudflare Tunnel: kobeos-storefronts"
echo "    • Wildcard DNS: *.kobeapptz.com → your server"
echo "    • This is ONE-TIME — after this, every 'Publish' click works instantly"
echo ""
