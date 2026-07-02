# Cloudflare setup checklist — hosted storefront publishing

This is the authoritative "what do I set up in Cloudflare" list. It uses
the **Tunnel model**, which is what the app's publish flow actually
drives (`CloudflareService.bootstrapWildcardTunnel()`, the
`POST /api/store-settings/admin/bootstrap-wildcard` endpoint, and
`deploy/cf-setup.sh`). Do these once; after that every store's Publish
click is instant.

> **Which model am I on?** The repo supports two topologies. Pick ONE:
>
> | | **Tunnel (recommended, what the app drives)** | **Direct nginx** |
> |---|---|---|
> | Wildcard DNS | `*.kobeapptz.com` CNAME → `<tunnelId>.cfargotunnel.com` | `*.kobeapptz.com` A → origin IP |
> | Cloud color | **Orange (proxied)** — required | Grey or orange |
> | TLS | Cloudflare Universal SSL, automatic | Let's Encrypt wildcard (DNS-01) you manage |
> | Inbound ports | **None** (tunnel is outbound-only) | 80 + 443 open |
> | Origin cert | Not needed | Required |
> | Setup doc | **this file** | `SUBDOMAIN-SETUP.md` + `DNS-INSTRUCTIONS.md` |
>
> `DNS-INSTRUCTIONS.md` recommends **grey cloud** — that guidance is for
> the *direct-nginx* model. The Tunnel model below **requires orange
> (proxied)** because `cfargotunnel.com` only routes through Cloudflare's
> edge. Don't mix the two.

---

## 1. Domain on Cloudflare (once)

- Add `kobeapptz.com` as a zone in your Cloudflare account.
- At your registrar, replace the nameservers with the two Cloudflare
  gives you.
- Wait until the zone shows **Active** (minutes to a few hours).

Nothing else works until the zone is Active.

## 2. API token (once)

Dashboard → My Profile → **API Tokens** → Create Token → Custom token.
Grant exactly:

- **Account → Cloudflare Tunnel → Edit**
- **Zone → DNS → Edit** (scoped to `kobeapptz.com`)
- **Zone → Zone → Read**

Copy the token. It's used only by `cf-setup.sh` / the bootstrap endpoint
— never pasted into chat, never committed.

## 3. Create the tunnel + wildcard DNS (once)

Either the script:

```sh
export CF_API_TOKEN=***          # the token from step 2
# export CF_ACCOUNT_ID=***       # optional — auto-resolved
./deploy/cf-setup.sh             # dry run — preview
./deploy/cf-setup.sh --apply     # execute
```

…or, if the backend is already running with `CF_API_TOKEN` in
`server/.env`, the app endpoint (admin JWT):

```sh
curl -X POST https://api.kobeapptz.com/api/store-settings/admin/bootstrap-wildcard \
  -H "Authorization: Bearer <admin-jwt>"
```

Both create:
- Tunnel `kobeos-storefronts`
- `*.kobeapptz.com` CNAME → `<tunnelId>.cfargotunnel.com` (proxied)
- A catch-all ingress rule → `http://localhost:3000`

Both print a **cloudflared run token** — used in step 4.

## 4. Run cloudflared on the origin (once)

Install cloudflared on the server that runs the KobeOS backend, then:

```sh
# systemd service — survives reboots, outbound-only, no ports to open
sudo cloudflared service install <RUN_TOKEN>
sudo systemctl enable --now cloudflared
```

Also persist the token so the app knows the wildcard is live:

```sh
echo "CLOUDFLARED_TOKEN=<RUN_TOKEN>" >> server/.env
```

The tunnel forwards **all** `*.kobeapptz.com` (including `api.` and every
tenant slug) to `localhost:3000`. NestJS serves `/api/*` for the API and
the storefront SPA (index.html fallback) for everything else — one
process handles both.

## 5. Cloud color: orange (proxied) — automatic

The script sets `proxied: true` on the wildcard CNAME. Leave it orange.
The Tunnel model needs it; a grey-cloud CNAME to `cfargotunnel.com` will
not route.

## 6. TLS: nothing to do

Cloudflare **Universal SSL** (free, on by default) covers `kobeapptz.com`
and `*.kobeapptz.com` at the edge. The tunnel carries encrypted traffic
to `localhost`. You do **not** need a Let's Encrypt wildcard cert for the
Tunnel model.

> Universal SSL's free wildcard covers ONE level (`*.kobeapptz.com` ✓;
> `*.shop.kobeapptz.com` ✗). That's fine for `{slug}.kobeapptz.com`.

---

## Verify it worked

```sh
# DNS resolves through Cloudflare (expect Cloudflare IPs, not your origin):
dig +short kelvinfashion.kobeapptz.com

# The API health check via the tunnel:
curl -sSf https://api.kobeapptz.com/api/../health   # or your health path

# Publish-readiness (in the app): Store Editor → the checklist under the
# Publish button should be all-green.
```

Then in the Store Editor, click **Publish**. The store is live at
`https://{slug}.kobeapptz.com` immediately — no per-store Cloudflare
call, because the wildcard already routes everything.

---

## What the Cloudflare MCP connector can and can't do here

The connected **Cloudflare Developer Platform** MCP exposes Workers
(read-only), D1, KV, R2, Hyperdrive, and doc search. It has **no** tools
for DNS records, zones, Pages projects/custom-domains, or Tunnels — so
the steps above can't be automated through it. They go through the
Cloudflare REST API (what `cf-setup.sh` uses) with your token, which you
run. The connector is for app data/compute, not hosting config.
