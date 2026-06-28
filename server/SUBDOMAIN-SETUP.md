# Subdomain hosting for KobeOS public apps

Every public app is reachable two ways:

| App              | Path form                 | Subdomain form                              |
| ---------------- | ------------------------- | ------------------------------------------- |
| Tuma             | `/tuma`                   | `tuma.kobeapptz.com`                        |
| Mzigo            | `/mzigo`                  | `mzigo.kobeapptz.com` (alias: `cargo.`)     |
| Mzigo tracker    | `/mzigo/track/{waybill}`  | `mzigo.kobeapptz.com/track/{waybill}`       |
| Customer portal  | `/me`                     | `me.kobeapptz.com`                          |
| Cargo tracking   | `/track/{ref}`            | `track.kobeapptz.com/{ref}`                 |
| POSys            | `/posys`                  | `posys.kobeapptz.com`                       |
| Tenant store     | n/a                       | `{tenant-slug}.kobeapptz.com` (storefront)  |

The SPA routes by hostname + pathname (`src/main.tsx`, `src/public/api.ts`),
so the only infra requirements are:

1. **Wildcard DNS** so every subdomain resolves to the server.
2. **Wildcard TLS cert** so HTTPS works for arbitrary subdomains.
3. **A web container** that actually serves the bundle for non-API hosts.

The repo ships all three pieces; you have to point DNS at your server,
issue the cert, and (one-time) clone the repo onto the deploy host.

---

## 1 · DNS (5 min, at your registrar)

Add one wildcard A record (or AAAA):

```
*.kobeapptz.com   A   <your-server-IPv4>
kobeapptz.com     A   <your-server-IPv4>
```

That single wildcard covers `tuma.`, `mzigo.`, `me.`, `track.`, `posys.`,
`api.`, plus every future tenant slug.

If your DNS provider doesn't support wildcards, add one record per
public-app subdomain (see the table above) plus the apex.

---

## 2 · Wildcard TLS cert (one-time, ~20 min)

Let's Encrypt **DNS-01** challenge is the only way to issue a wildcard
cert. Pick the path that matches your DNS provider.

### Cloudflare (recommended — has a maintained ACME plugin)

```sh
# 1. Generate an API token at https://dash.cloudflare.com/profile/api-tokens
#    Permissions: Zone → DNS → Edit on the kobeapptz.com zone.
echo "dns_cloudflare_api_token = YOUR_TOKEN_HERE" \
  > /etc/letsencrypt/cloudflare.ini
chmod 600 /etc/letsencrypt/cloudflare.ini

# 2. Issue the wildcard cert.
docker run --rm -it \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /etc/letsencrypt/cloudflare.ini:/cloudflare.ini:ro \
  certbot/dns-cloudflare \
  certonly --dns-cloudflare \
  --dns-cloudflare-credentials /cloudflare.ini \
  -d 'kobeapptz.com' -d '*.kobeapptz.com' \
  --agree-tos --email YOUR_EMAIL

# 3. Copy the issued cert into the nginx volume.
cp /etc/letsencrypt/live/kobeapptz.com/fullchain.pem \
   /opt/kobe-studio/server/nginx/certs/wildcard-fullchain.pem
cp /etc/letsencrypt/live/kobeapptz.com/privkey.pem \
   /opt/kobe-studio/server/nginx/certs/wildcard-privkey.pem

# 4. Reload nginx.
cd /opt/kobe-studio/server
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Route53 / Google / generic DNS

certbot has plugins for Route53 (`certbot-dns-route53`), Google Cloud
DNS (`certbot-dns-google`), and a manual DNS-01 mode (`--manual`) where
you set a `_acme-challenge` TXT record by hand. Pattern is identical
to the Cloudflare flow above — only the `--dns-*` flag changes.

### Renewal

Wildcard certs renew every 90 days. Add a cron:

```sh
# /etc/cron.d/certbot-renew
0 3 * * * root docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /etc/letsencrypt/cloudflare.ini:/cloudflare.ini:ro \
  certbot/dns-cloudflare renew --quiet \
  && cp /etc/letsencrypt/live/kobeapptz.com/fullchain.pem \
        /opt/kobe-studio/server/nginx/certs/wildcard-fullchain.pem \
  && cp /etc/letsencrypt/live/kobeapptz.com/privkey.pem \
        /opt/kobe-studio/server/nginx/certs/wildcard-privkey.pem \
  && docker compose -f /opt/kobe-studio/server/docker-compose.prod.yml \
       exec -T nginx nginx -s reload
```

### API host cert (separate from the wildcard)

`api.kobeapptz.com` is also covered by the wildcard, so you can point
both server blocks at the same cert. If you'd rather keep them
separate (single-host cert for the API, wildcard for the rest), issue
a second cert without DNS-01 (HTTP-01 works fine for single hosts):

```sh
docker run --rm -it -p 80:80 certbot/certbot \
  certonly --standalone -d api.kobeapptz.com
```

…then copy to `server/nginx/certs/fullchain.pem` + `privkey.pem`.

---

## 3 · Web container (one-time provision)

The prod compose stack now includes a `web` service built from
`Dockerfile.web` at the repo root. It builds the vite SPA bundle and
serves it via an internal nginx. The reverse-proxy nginx in front of
it (the existing `nginx` service) terminates TLS and proxies every
non-API host to `web:80`.

**First-time setup on the server:**

```sh
# 1. Provision the deploy directory as a git checkout.
git clone https://github.com/kobepaytech/kobeos /opt/kobe-studio
cd /opt/kobe-studio/server
cp .env.example .env && nano .env   # fill in JWT_SECRET, DB_PASSWORD…

# 2. Build + start the full stack (api + postgres + redis + web + nginx).
docker compose -f docker-compose.prod.yml up -d --build

# 3. Verify.
curl -sI https://kobeapptz.com         # 200, SPA
curl -sI https://tuma.kobeapptz.com    # 200, SPA (same bundle)
curl -sI https://api.kobeapptz.com/health  # 200, API JSON
```

The CI `deploy.yml` workflow then handles each subsequent deploy:
`git pull --ff-only`, rebuild the `web` image with the new bundle,
rolling-restart `api` + `web`, reload `nginx`.

### Build-time env vars

`Dockerfile.web` bakes two values into the bundle at build time:

```
VITE_API_BASE              default: https://api.kobeapptz.com/api
VITE_TENANT_BASE_DOMAIN    default: kobeapptz.com
```

Override in the deploy host's `.env` (read by docker compose) for
white-label installs:

```
VITE_API_BASE=https://api.tenantco.com/api
VITE_TENANT_BASE_DOMAIN=tenantco.com
```

…then `docker compose build web && docker compose up -d web` picks
them up on the next build.

---

## Adding a new public-app subdomain

1. Append the slug to `APP_SUBDOMAINS` in `src/public/api.ts`.
2. Add the matching `import('./public/...')` branch in `src/main.tsx`.
3. Ship the code. DNS + cert already cover it (wildcard).

That's the whole flow — no infra changes needed for new app names
once the wildcard is in place.
