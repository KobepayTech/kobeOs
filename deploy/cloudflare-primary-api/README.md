# KobeOS primary API on Cloudflare Containers

This is the Cloudflare-first production path for `api.kobeapptz.com`.
It runs the existing NestJS image from `server/Dockerfile` inside Cloudflare
Containers, with a Worker in front for routing, keep-warm health checks,
observability and optional rollback to the legacy origin.

The VPS deployment remains in the repository for a later secondary/backup path.
It is not required by this Cloudflare deployment.

## Architecture

```text
api.kobeapptz.com
        |
        v
Cloudflare Worker
        |
        v
KobeApiContainer (server/Dockerfile, port 3000)
        |
        v
existing production PostgreSQL
```

Redis is intentionally not part of this stack. KobeOS already falls back to its
in-memory cache when `REDIS_URL` is absent. Caddy is also unnecessary because
Cloudflare terminates HTTPS.

### Why Hyperdrive is not in the first container cutover

Hyperdrive credentials are exposed to Workers, not directly to arbitrary
processes inside a Container. The current NestJS app uses TypeORM and opens a
normal PostgreSQL TCP connection itself. The safe first migration therefore
keeps the existing PostgreSQL connection unchanged. Hyperdrive can be added
later when database access is moved into Worker-compatible code or a dedicated
Cloudflare database gateway.

## Required Cloudflare Worker secrets

Set these on `kobeos-primary-api` before the first preview deployment:

- `DB_HOST`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `PROVIDER_ENCRYPTION_KEY`

The checked-in config supplies non-secret defaults for `DB_PORT`, `DB_DATABASE`,
SSL, CORS, the tenant domain and the public API URL. Override them as Worker
secrets/vars if production differs.

Copy the production provider credentials that the API actually uses (Meta,
TikTok, PalmPesa, Beem, email, etc.) as Worker secrets too. `src/index.js`
forwards the supported names into the NestJS container without committing them.

Optional rollback secret:

- `LEGACY_ORIGIN_URL` — a hostname/URL that reaches the old API without routing
  back through `api.kobeapptz.com`. If the container cannot serve a request, the
  Worker will try this origin and marks the response
  `X-Kobe-Production-Path: legacy-origin-fallback`.

## Deployment sequence

1. Ensure the PostgreSQL host is reachable from Cloudflare Containers. Do not
   cut over to an empty/new database.
2. Install dependencies in this directory with `npm install`.
3. Set the required Worker secrets.
4. Deploy `wrangler.jsonc`. This keeps `workers.dev` enabled and does **not**
   claim `api.kobeapptz.com`.
5. Test `/api/health`, an authenticated read, and one low-risk write on the
   generated `workers.dev` URL. Successful container responses include:
   `X-Kobe-Production-Path: cloudflare-container`.
6. Only after those checks pass, deploy `wrangler.production.jsonc`. It attaches
   `api.kobeapptz.com` as a Worker Custom Domain, so Cloudflare becomes the
   origin and manages DNS/TLS for that hostname.
7. Keep the old origin reachable at `LEGACY_ORIGIN_URL` during the migration.

The Worker runs a five-minute scheduled health request so the NestJS process
stays warm enough for its in-process scheduled jobs while still allowing the
container platform to recover/restart it.

## Database note

The current `KobeOS Backup` Supabase project is an independent outage path. It
contains backup tables/snapshots, not the complete production KobeOS schema and
data, so it must not be substituted for the production database without a
separate schema + data migration and verification.
