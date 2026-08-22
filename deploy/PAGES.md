# Publishing with Cloudflare Pages (Option 2)

This is how KobeOS serves the app **and every tenant storefront** —
`kobeapptz.com` plus every `{slug}.kobeapptz.com` — straight from
Cloudflare's edge. One Pages project, a wildcard custom domain, and **no
tunnel for the frontend**. The only origin server you run is the API.

```
                 ┌──────────────────────────────┐
  browser ─────► │  Cloudflare Pages: kobeos-app │  (SPA, global edge)
  *.kobeapptz.com│  served from *.kobeapptz.com  │
                 └──────────────┬───────────────┘
                                │ XHR to https://api.kobeapptz.com/api
                                ▼
                 ┌──────────────────────────────┐
                 │  NestJS backend (your server) │  CORS allows *.kobeapptz.com
                 │  api.kobeapptz.com            │
                 └──────────────────────────────┘
```

The SPA figures out which tenant it is from `window.location.hostname`
(see `src/main.tsx`), so all subdomains load the same build.

---

## One-time setup

### 1. Install & authenticate Wrangler

```bash
npm install -g wrangler        # or use npx (the deploy script does)
wrangler login                 # interactive — opens a browser
# …or, for CI, an API token instead of login:
#   export CLOUDFLARE_API_TOKEN=***   # scopes: Account → Cloudflare Pages: Edit
#   export CLOUDFLARE_ACCOUNT_ID=***  # optional
```

Never paste the token into a command's arguments or commit it — env only.

### 2. Create the Pages project (once)

```bash
wrangler pages project create kobeos-app --production-branch main
```

### 3. First deploy

```bash
./deploy/pages-deploy.sh
```

This builds the SPA with `VITE_API_BASE=https://api.kobeapptz.com/api`,
copies `deploy/_redirects` into `dist/`, and uploads `dist/` to the
`kobeos-app` project.

### 4. Attach the custom domains

Dashboard → **Workers & Pages → kobeos-app → Custom domains → Set up a
domain**, add all three:

| Domain                | Purpose                              |
| --------------------- | ------------------------------------ |
| `kobeapptz.com`       | apex — app entry                     |
| `www.kobeapptz.com`   | www alias                            |
| `*.kobeapptz.com`     | **wildcard — every tenant store**    |

Cloudflare provisions the certificates automatically (Universal SSL covers
the apex and a one-level wildcard). The wildcard is what makes
`anyshop.kobeapptz.com` resolve to this project with zero per-store DNS work.

> If the zone `kobeapptz.com` is on Cloudflare, adding these as custom
> domains creates the CNAME records for you. If any subdomain is "parked"
> at another host, remove that record first.

### 5. Point the API at your backend

`api.kobeapptz.com` is a **separate origin** — Pages does not serve it.
Give it a proxied DNS record to your server, or run a small api-only tunnel:

```
api.kobeapptz.com  →  your backend :3000 (behind nginx/TLS)
```

The backend CORS already allows the apex and every `*.kobeapptz.com`
subdomain (`server/src/common/cors.ts`), so the cross-origin XHR from the
storefronts just works — no proxy hop needed.

---

## Day-to-day: shipping updates

```bash
./deploy/pages-deploy.sh          # build + deploy production
BRANCH=preview ./deploy/pages-deploy.sh   # a preview deployment
```

Publishing a store from the Store Editor flips a DB flag and sets
`publishedUrl = https://{slug}.kobeapptz.com`. Because the wildcard domain
already resolves to this project, **the store is live the instant it's
published** — no redeploy, no DNS change per store.

---

## Why this over the tunnel (Option 1)?

| | Cloudflare Pages (this) | Shared tunnel |
| --- | --- | --- |
| Frontend origin server | none — CF edge | your server + `cloudflared` |
| New store goes live | instant (wildcard) | instant (wildcard) |
| Fails if server/QUIC down | no (edge-cached) | yes (530/1033) |
| Global latency | edge (fast) | one origin |
| Moving parts | Pages + api origin | tunnel + nginx + api |

The tunnel is still fine for the **API** (a single host). It's the
per-storefront SPA hosting that Pages removes the headache from.

---

## Troubleshooting

- **Store loads but data calls fail (CORS/blocked)** — confirm
  `api.kobeapptz.com/api/health` returns 200 and that the request Origin
  (`https://{slug}.kobeapptz.com`) matches the CORS regex in
  `server/src/common/cors.ts`.
- **Deep link 404s (e.g. `/shop/foo` reloads to a 404)** — `dist/_redirects`
  didn't ship; re-run the deploy (the script copies it in).
- **Subdomain shows a different site** — a stale/parked DNS record for that
  host outranks the wildcard; delete it in the DNS tab.
- **`wrangler pages deploy` auth error** — run `wrangler login` or export
  `CLOUDFLARE_API_TOKEN` (Pages:Edit).
