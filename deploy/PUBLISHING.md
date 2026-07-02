# Publishing tenant webapps on `{slug}.kobeapptz.com`

**TL;DR — you already have the right architecture. Don't build per-store
Cloudflare Pages projects.** A tenant's webapp (online shop today, more
surfaces later) publishes on its own subdomain via a *one-time* wildcard
setup plus a per-store database flag. This is the same path the online
shop uses, and it's the recommended model for a host-operated platform.

---

## The recommendation, and why

There are two ways to put every `{slug}.kobeapptz.com` online:

| | **Wildcard SPA (recommended, already built)** | **Cloudflare Pages per store** |
|---|---|---|
| Origin | ONE bundle serves every subdomain; routes by `window.location.hostname` | A separate Pages project per store |
| Publish action | `isPublished = true` (a DB write) | CF API: create project + deployment + custom-domain validation |
| Publish latency | Instant | Seconds–minutes, rate-limited |
| New store cost | Zero infra | One project + one custom hostname each |
| TLS | One wildcard cert | Per-hostname cert issuance |
| Failure surface | One origin to watch | N projects, N domains, N certs |
| Patch/rollback | Deploy one bundle | Redeploy N projects |

For a platform where **the host runs everything and end users create
stores dynamically**, the per-store Pages model multiplies operational
cost and failure modes for no benefit — the bundle is identical across
tenants; only the data differs, and the data comes from the API at
runtime. Use the wildcard SPA.

(Per-store **Cloudflare Tunnels** — `store-registry/cloudflare.service.ts`
— are a different thing, only for the *self-hosted* edition where each
merchant's KobeOS + data live on their own machine. Not relevant to the
hosted platform.)

---

## How it already works in this repo

```
Customer browser
      │  https://kelvinfashion.kobeapptz.com
      ▼
Cloudflare  (wildcard DNS *.kobeapptz.com, wildcard cert)
      │
      ▼
Origin  (nginx `web` container  OR  one Cloudflare Pages project)
      │  serves ONE Vite bundle
      ▼
SPA  main.tsx → detectTenantSubdomain() → "kelvinfashion"
      │  renders <ErpShop slug="kelvinfashion" />
      ▼
/api/*  → api.kobeapptz.com  (NestJS)  → tenant data
```

Key code already in place:

- **`src/main.tsx`** — reads the hostname, extracts the tenant slug,
  mounts `ErpShop` for `{slug}.kobeapptz.com` (and apex `/shop/{slug}`).
- **`server/src/store-settings/publish.service.ts`**
  - `publish()` in **hosted** mode → `publishHosted()` → pure DB flip,
    sets `publishedUrl = https://{slug}.kobeapptz.com`. No CF calls.
  - `bootstrapWildcardTunnel()` → one-time shared tunnel + `*` DNS.
- **`server/nginx/nginx.conf`** — default TLS server for
  `*.kobeapptz.com` proxies to the `web` bundle; exact `api.` host wins
  for the API.
- **`deploy/wrangler.toml` + `deploy/_redirects`** — if you'd rather host
  the bundle on Cloudflare Pages than the nginx `web` container: ONE
  project, `/api/*` rewritten to the backend, `/*` → `index.html`.

---

## Go-live — three steps, done once

### 1. DNS (once, in your registrar / Cloudflare DNS)

```
*.kobeapptz.com   A   <origin-IP>       # or CNAME → your Pages project
kobeapptz.com     A   <origin-IP>
```

See `server/DNS-INSTRUCTIONS.md` for provider-by-provider clicks. Keep
records **DNS-only (grey cloud)** unless you complete the proxied-mode
checklist in `DNS-INSTRUCTIONS.md`.

### 2. Wildcard TLS + shared tunnel (once, on the server)

Wildcard cert via Let's Encrypt DNS-01 — see `server/SUBDOMAIN-SETUP.md`.

Then bootstrap the shared tunnel **once** (admin):

```sh
curl -X POST https://api.kobeapptz.com/api/store-settings/admin/bootstrap-wildcard \
  -H "Authorization: Bearer <admin-jwt>"
```

This returns a `cloudflared` run token. Persist it as `CLOUDFLARED_TOKEN`
and run cloudflared as a system service (systemd unit or the compose
`web`/tunnel container). After this, publishing is instant forever.

### 3. Merchant clicks **Publish** (per store, anytime)

Store Editor → **Publish to kobeapptz.com**. Backend flips
`isPublished=true`; the store is live at `https://{slug}.kobeapptz.com`
immediately. No deploy, no CF call, no wait.

---

## If you prefer Cloudflare Pages as the origin (instead of nginx `web`)

Still **one** project, still wildcard — not one per store.

```sh
cd deploy
wrangler login
# ONE project named kobeos-app:
wrangler pages project create kobeos-app --production-branch main
# Build + deploy the single bundle:
( cd .. && npm run build )
cp _redirects ../dist/_redirects
wrangler pages deploy ../dist --project-name kobeos-app
```

Then in the Cloudflare dashboard → Pages → kobeos-app → **Custom
domains**, add **`*.kobeapptz.com`** (one wildcard custom domain, covers
every store). `_redirects` already rewrites `/api/*` →
`api.kobeapptz.com` and falls back `/*` → `index.html`, so client-side
routing renders each tenant.

> The Cloudflare account actions above (token, project, custom domain,
> DNS) are yours to run — they need your `CF_API_TOKEN` and are
> irreversible production changes. The code + config here is everything
> the app side needs; nothing in this repo touches your live CF account
> automatically.

---

## Choosing what a subdomain serves (optional, not yet built)

Today `{slug}.kobeapptz.com` always renders the ecommerce `ErpShop`. If
you want merchants to pick a **published surface** — online shop, the
mobile PWA (`/m/{slug}`), or a simple landing webapp — that's a small
addition, not new infrastructure:

1. A `publishedSurface` column on `StoreSettings` (`'shop' | 'pwa' |
   'landing'`, default `'shop'`).
2. One branch in `src/main.tsx`'s tenant-subdomain block that mounts the
   chosen component.
3. A selector in the Store Editor next to the Publish button.

Say the word and I'll wire it — but it's deliberately left out here so
the base "publish like the online shop" flow stays simple.
