# KobeOS primary API on Cloudflare Containers

This is the Cloudflare-first production path for `api.kobeapptz.com`.
It runs the existing NestJS image from `server/Dockerfile` inside Cloudflare
Containers, with a Worker in front for routing, keep-warm health checks,
observability and immediate rollback to the existing origin.

The VPS deployment remains in the repository for a later secondary/backup path.
It is not required by this Cloudflare deployment.

## Architecture

```text
api.kobeapptz.com
        |
        v
Cloudflare Worker Route
        |
        +---- primary ----> KobeApiContainer (server/Dockerfile, port 3000)
        |                         |
        |                         v
        |                 production PostgreSQL
        |
        +---- fallback ---> existing DNS-configured API origin
```

The production route deliberately sits on top of the existing proxied
`api.kobeapptz.com` DNS record. The DNS record is not deleted or repointed for
this migration. Removing the Worker route therefore restores the old origin
immediately.

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

## Required Cloudflare deployment credentials

Configure these in the GitHub `production` environment:

- `CLOUDFLARE_API_TOKEN` (alias `CF_API_TOKEN`)
- `CLOUDFLARE_ACCOUNT_ID` (alias `CF_ACCOUNT_ID`)
- `CLOUDFLARE_ZONE_ID` (alias `CF_ZONE_ID`) for production route
  attachment/rollback.

The token needs Worker script deployment and Worker route write permissions.
Cloudflare Containers also require a Workers Paid account.

## Required production environment secrets

GitHub Actions builds a temporary mode-0600 JSON file and passes it to Wrangler
with `--secrets-file`, so the runtime secrets are uploaded alongside the Worker
code and are never committed.

Configure these in the GitHub `production` environment:

- `PRIMARY_API_DB_HOST` (aliases `DB_HOST` / `KOBE_SHARED_DB_HOST` are accepted)
- `PRIMARY_API_DB_USERNAME` (alias `DB_USERNAME`)
- `PRIMARY_API_DB_PASSWORD` (alias `DB_PASSWORD`)
- `PRIMARY_API_JWT_SECRET` (alias `JWT_SECRET`)
- `PRIMARY_API_PROVIDER_ENCRYPTION_KEY` (alias `PROVIDER_ENCRYPTION_KEY`)

Optional:

- `PRIMARY_API_EXTRA_SECRETS_JSON` — a JSON object containing additional
  provider secrets required by production integrations, for example PalmPesa,
  Meta/TikTok, Beem, SMTP or other keys accepted by `src/index.js`.

The checked-in config supplies non-secret defaults for `DB_PORT`, `DB_DATABASE`,
SSL, CORS, the tenant domain and the public API URL. Override them as Worker
secrets/vars if production differs.

Copy the production provider credentials that the API actually uses (Meta,
TikTok, PalmPesa, Beem, email, etc.) as Worker secrets too. `src/index.js`
forwards the supported names into the NestJS container without committing them.

For a `workers.dev` preview, `LEGACY_ORIGIN_URL` can optionally name a direct
legacy origin. In production, `ROUTE_ORIGIN_FALLBACK=true` lets the Worker fall through to
the existing DNS-configured API origin for safe/idempotent requests when the
Container throws or returns a 5xx response. Automatic fallback is limited to
GET/HEAD/OPTIONS. Mutating requests are never blindly replayed to the legacy
origin because an ambiguous failure could otherwise duplicate a booking,
payment or order.

Fallback responses are marked:

`X-Kobe-Production-Path: legacy-origin-fallback`

## Deployment sequence

1. Ensure the current production PostgreSQL host is reachable from Cloudflare
   Containers. Do not cut over to an empty/new database.
2. Set the Cloudflare account credentials used by GitHub Actions.
3. Set the required `PRIMARY_API_*` runtime secrets in the GitHub
   `production` environment.
4. Deploy `wrangler.jsonc`; the workflow uploads those runtime secrets in the
   same Wrangler deployment. This keeps `workers.dev` enabled and does **not**
   attach `api.kobeapptz.com`.
5. Test `/api/health`, an authenticated read, and one low-risk write on the
   generated `workers.dev` URL. Successful container responses include
   `X-Kobe-Production-Path: cloudflare-container`.
6. Only after those checks pass, deploy `wrangler.production.jsonc`. It adds a
   Worker Route for `api.kobeapptz.com/*` while preserving the existing DNS
   record and origin as the rollback/fallback path.
7. Verify the production marker. If verification fails after the route deploy,
   GitHub Actions removes only the KobeOS Worker Route through Cloudflare's
   Routes API. The unchanged DNS origin immediately resumes receiving traffic;
   no DNS restoration or data migration is required.

The Worker runs a five-minute scheduled health request so the NestJS process
stays warm enough for its in-process scheduled jobs while still allowing the
container platform to recover/restart it.

## Database note

The current `KobeOS Backup` Supabase project is an independent outage path. It
contains backup tables/snapshots, not the complete production KobeOS schema and
data, so it must not be substituted for the production database without a
separate schema + data migration and verification.
