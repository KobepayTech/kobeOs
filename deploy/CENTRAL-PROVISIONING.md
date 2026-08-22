# Central tunnel provisioning — keep CF_API_TOKEN out of installers

This is the "install → sign in → live" backend, done the safe way: the
Cloudflare API token lives **only on your central host**, never inside the
KobeOS installer each shop downloads.

```
Shop PC (KobeOS.exe)                         Your central host
────────────────────                         ─────────────────
sign in, save store name                     holds CF_API_TOKEN
        │  POST /api/store-registry/provision-tunnel
        │  header: x-provisioning-secret            │
        │  body: {ownerId, storeName, localPort}    ▼
        │                                   create tunnel + DNS + ingress
        │  ◄── {subdomain, tunnelToken} ─────  (Cloudflare API)
        ▼
persist token → start cloudflared
        │
        ▼
live at https://{slug}.kobeapptz.com  →  Cloudflare  →  tunnel  →  localhost:3000
```

Each shop keeps its **own local database and server**. Only the tunnel token
is minted centrally. Shops are isolated (each gets its own tunnel).

---

## 1. Deploy the central host (always-on)

Run one KobeOS backend on a small always-on box (VPS / container) with:

```bash
# Cloudflare — the ONLY place the API token lives:
CF_API_TOKEN=***              # scopes: Account→Tunnel→Edit, Zone→DNS→Edit, Zone→Read
CF_ACCOUNT_ID=***             # optional (auto-resolved)
CF_ZONE_ID=***               # optional (auto-resolved from CF_DOMAIN)
CF_DOMAIN=kobeapptz.com

# The shared secret installers present to provision (rotate anytime):
KOBEOS_PROVISIONING_SECRET=<long-random-string>

# Normal server config (NODE_ENV=production, DB_*, JWT_SECRET, …)
```

The endpoint `POST /api/store-registry/provision-tunnel` is **disabled unless
`KOBEOS_PROVISIONING_SECRET` is set**, so no other deployment exposes it.

## 2. Point the installers at it

Ship these two values in the desktop build (the secret is low-risk — it can
only call the provisioning endpoint, is rate-limitable, and is revocable;
unlike `CF_API_TOKEN` it can't touch your Cloudflare account):

```bash
KOBEOS_PROVISIONING_URL=https://api.kobeapptz.com
KOBEOS_PROVISIONING_SECRET=<same-secret-as-the-host>
# and DO NOT ship CF_API_TOKEN in the installer anymore
```

When a shop publishes, the local `provisionShop()` sees no local
`CF_API_TOKEN` + a configured `KOBEOS_PROVISIONING_URL`, so it **delegates**:
POSTs to the central host, receives `{subdomain, tunnelToken}`, persists the
token, and Electron starts `cloudflared` automatically.

## 3. Behaviour / fallbacks

| Situation | Result |
| --- | --- |
| Central URL + secret set, no local CF token | Delegates to central host (recommended) |
| Local `CF_API_TOKEN` set (no central) | Creates the tunnel locally (token is in the installer) |
| Neither configured | Falls back to a DB-only publish (subdomain recorded, tunnel started later) |

## API

```
POST /api/store-registry/provision-tunnel
  headers: x-provisioning-secret: <secret>
  body:    { ownerId, storeName?, slug?, localPort? }
  200:     { subdomain, publishedUrl, tunnelToken, ingressPort }
  401:     invalid/missing secret
  403:     provisioning disabled (secret not set on host)
  400:     CF_API_TOKEN not set on host / reserved or taken slug
```

Verified: secret gating (401), disabled-when-unset (403), and the
CF-not-configured guard (400) all behave; the full mint runs once a real
`CF_API_TOKEN` is present on the host.

## Security notes

- The run token is returned to the shop and **not stored** in the central DB
  (only the slug↔owner allocation + DNS record id are recorded, for teardown).
- Rotate `KOBEOS_PROVISIONING_SECRET` by updating the host env and the next
  installer build; old installers simply fail provisioning and can be updated.
- Serve the central host over HTTPS so the secret and token aren't sent in clear.
