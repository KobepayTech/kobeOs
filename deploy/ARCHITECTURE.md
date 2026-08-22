# KobeOS Hosting Architecture

## Overview

KobeOS is a multi-tenant SaaS platform. Each customer gets:
- **KobeOS Desktop App** — the full ERP (POS, cargo, hotel, etc.)
- **Online Store** — public storefront on `their-store.kobeapptz.com`
- **Mobile PWA** — POS + warehouse dispatch on their phone

## Architecture Options

### Option A: Everything on Your Server (Simplest)

```
                    Internet
                       │
              Cloudflare Tunnel
                  (wildcard)
                       │
               *.kobeapptz.com
                       │
              ┌─────────────────┐
              │   Your Server   │
              │                 │
              │  ┌───────────┐  │
              │  │  NestJS   │  │
              │  │  Backend  │  │
              │  │  :3000    │  │
              │  └───────────┘  │
              │        │        │
              │  ┌───────────┐  │
              │  │  dist/    │  │
              │  │  (SPA)    │  │
              │  └───────────┘  │
              └─────────────────┘
```

- Backend serves the SPA (already configured)
- One server, one process
- Good for: getting started quickly, single-store deployments

### Option B: Frontend on Cloudflare Pages (Recommended)

```
                         Internet
                            │
            ┌───────────────┼───────────────┐
            │               │               │
      ┌──────────┐   ┌──────────┐   ┌──────────────┐
      │  Cloud-  │   │  Cloud-  │   │    Your      │
      │  flare   │   │  flare   │   │    Server    │
      │  Pages   │   │  Tunnel  │   │              │
      │          │   │          │   │  ┌────────┐  │
      │ KobeOS   │   │ *.kobe   │   │  │ NestJS │  │
      │ Desktop  │   │ apptz    │   │  │Backend │  │
      │   SPA    │   │ .com     │   │  │ :3000  │  │
      └──────────┘   └────┬─────┘   │  └────────┘  │
           │              │          └──────────────┘
           │         ┌────┴────┐
           │         │         │
      app.kobe    api.kobe  store-slug.kobe
      apptz.com   apptz.com  apptz.com
```

- **app.kobeapptz.com** → Cloudflare Pages (fast global CDN, free)
- **api.kobeapptz.com** → Your server (NestJS backend via tunnel)
- ***.kobeapptz.com** → Your server (customer storefronts via tunnel)

**Why this is better:**
- Frontend loads instantly from 300+ Cloudflare edge locations
- Your server only runs the API (less load, lower cost)
- Automatic HTTPS, DDoS protection, caching
- Customer stores still work on subdomains via the tunnel

## DNS Setup (Option B)

In your Cloudflare dashboard for `kobeapptz.com`:

| Type | Name | Target | Purpose |
|------|------|--------|---------|
| CNAME | `app` | `<pages-domain>.pages.dev` | KobeOS Desktop UI |
| CNAME | `api` | `<tunnel-id>.cfargotunnel.com` | Backend API |
| CNAME | `*` | `<tunnel-id>.cfargotunnel.com` | Customer stores |

## What Gets Hosted Where

| Asset | Host | URL |
|-------|------|-----|
| KobeOS Desktop UI | Cloudflare Pages | `app.kobeapptz.com` |
| Backend API | Your server (via tunnel) | `api.kobeapptz.com/api` |
| Customer Storefront | Your server (via tunnel) | `store-name.kobeapptz.com` |
| Mobile PWA | Cloudflare Pages | `app.kobeapptz.com/m/:slug` |

## Deploying to Cloudflare Pages

### Step 1: Build the frontend

```bash
cd /path/to/kobeOs

# Set the API to point to your backend
export VITE_API_BASE=https://api.kobeapptz.com/api

npm install --legacy-peer-deps
npm run build
```

### Step 2: Deploy to Cloudflare Pages

```bash
# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy the dist/ folder
wrangler pages deploy dist --project-name=kobeos-app
```

Or use the deploy script (see `deploy.sh` in this folder):

```bash
cd deploy
./deploy.sh
```

### Step 3: Update your backend CORS

In `server/.env`, allow the Cloudflare Pages domain:

```env
CORS_ORIGIN=https://app.kobeapptz.com,http://localhost:5173,http://127.0.0.1:5173
```

### Step 4: Set API base in the frontend

The `VITE_API_BASE` environment variable tells the frontend where the backend lives.

When building for Cloudflare Pages:
```bash
VITE_API_BASE=https://api.kobeapptz.com/api npm run build
```

When developing locally:
```bash
# Already defaults to localhost:3000/api
npm run dev
```

## How Users Sign Up

1. User visits `app.kobeapptz.com`
2. Creates account (POST /api/auth/register)
3. Gets instant access to full KobeOS desktop app
4. Sets up their store name → gets slug `their-store`
5. Publishes → store goes live at `their-store.kobeapptz.com`
6. Mobile PWA available at `app.kobeapptz.com/m/their-store`

## File Structure

```
kobeOs/
├── deploy/
│   ├── ARCHITECTURE.md      # This file
│   ├── wrangler.toml        # Cloudflare Pages config
│   ├── _redirects           # SPA routing rules
│   ├── _headers             # Security headers
│   └── deploy.sh            # One-command deploy script
├── dist/                    # Build output (deployed to Pages)
├── server/                  # NestJS backend (deployed to your server)
└── src/                     # React frontend source
```
