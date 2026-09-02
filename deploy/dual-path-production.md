# KobeOS dual-path production

KobeOS public services use two independent production paths. The primary API is
being moved to Cloudflare Containers; the existing Windows/tunnel origin stays
available during validation and as an immediate rollback target.

## Primary path

- Public app: `https://lala.kobeapptz.com`
- API: `https://api.kobeapptz.com/api`
- Preferred API origin: Cloudflare Worker + Cloudflare Container using the
  existing `server/Dockerfile`.
- Deployment source: `deploy/cloudflare-primary-api/`.
- Preview: deploy to `workers.dev` first. The preview configuration does not
  claim `api.kobeapptz.com`.
- Production: `wrangler.production.jsonc` adds a Worker Route for
  `api.kobeapptz.com/*` after health/read/write checks while leaving the
  existing proxied DNS/origin untouched.
- TLS and the public hostname are managed by Cloudflare; Caddy is not required
  on this path.
- The current PostgreSQL source of truth stays unchanged for the first cutover.
  Do not substitute the `KobeOS Backup` Supabase database: it currently holds
  only outage snapshots/queues rather than the full KobeOS production schema.
- The old tunnel/origin remains reachable during migration for rollback.

The prior VPS implementation remains in `server/docker-compose.primary-api.yml`,
`.github/workflows/deploy-primary-api-vps.yml`, and `deploy/always-on-api.md`.
It is deferred for a later independent origin and is not the current primary
deployment plan.

## Independent backup path

- Emergency Lala frontend and API:
  `https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup/app`
- Supabase project: `KobeOS Backup` (ref `erimnjgpawuxesonkeoz`)
- Region: `eu-central-1`
- The backup stores synchronized public snapshots and outage-time queued writes.
- It must remain independent of the Cloudflare primary path.

A future direct backup VPS can still use:

- API host: GitHub variable `BACKUP_API_HOST`
- Web host: GitHub variable `BACKUP_WEB_HOST`
- Stack: `server/docker-compose.backup.yml`
- TLS/reverse proxy: Caddy directly on that backup VPS.

## Cloudflare primary configuration

The Cloudflare deployment workflow is:

`.github/workflows/deploy-cloudflare-primary-api.yml`

It reuses the repository's `production` GitHub environment for Cloudflare
account credentials and keeps production hostname attachment behind an explicit
`cutover=true` workflow-dispatch input.

Required Cloudflare account credentials:

- `CLOUDFLARE_API_TOKEN` (or `CF_API_TOKEN`)
- `CLOUDFLARE_ACCOUNT_ID` (or `CF_ACCOUNT_ID`)

The token must be able to deploy Workers/Containers and manage the Worker route
used by the custom domain.

The Worker itself also needs the production application secrets documented in
`deploy/cloudflare-primary-api/README.md`, including the existing PostgreSQL
credentials, JWT secret and provider encryption key. These are runtime secrets,
not values to commit to Git.

## Data source rule

The Cloudflare Container and the legacy origin must point to the same production
PostgreSQL source of truth during the migration. This makes rollback an origin
switch rather than a data migration.

Hyperdrive is not required for the first cutover. The existing NestJS/TypeORM
process opens a normal PostgreSQL connection from inside the Container.
Hyperdrive can be introduced later if database access is moved into a
Worker-compatible layer.

## Failover semantics

Public reads can retry another healthy API origin for network errors, 408, 429,
or 5xx responses.

Mutating requests such as bookings and orders are different: the browser first
health-checks the available API origins, chooses one healthy origin, and sends
the mutation exactly once. It never blindly replays a write to another origin,
avoiding duplicate transactions when a response is lost during an outage.

The Cloudflare Worker supports `LEGACY_ORIGIN_URL` for preview/direct fallback.
In production, the Worker Route can fall through to the existing DNS-configured
origin when the Container path throws, and marks the response:

`X-Kobe-Production-Path: legacy-origin-fallback`

## Verification

Before attaching `api.kobeapptz.com`, require all of the following against the
`workers.dev` preview:

1. `/api/health` succeeds.
2. One authenticated read succeeds.
3. One low-risk authenticated write succeeds and is visible from the legacy
   origin against the same database.
4. The response includes
   `X-Kobe-Production-Path: cloudflare-container`.
5. Provider integrations required for MVP have their secrets available.

After cutover, the workflow verifies the same production marker publicly.
Rollback is removal of the Worker Route; no DNS restoration is required.

## Active no-Cloudflare emergency layer

The immediate independent fallback remains the Supabase project
`KobeOS Backup`.

Public backup API base:

`https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup`

It mirrors Lala public hotel/room/menu data while primary is reachable. During a
Cloudflare outage it serves the last successful snapshot and accepts supported
Lala writes into a private RLS-protected queue. Queued writes can be replayed to
primary KobeOS after it recovers.

Because the snapshot can become stale during a prolonged outage, backup
bookings are explicitly marked `BACKUP_PENDING`; the UI does not present them
as final room confirmations until primary KobeOS accepts them.

## Emergency URL

If Cloudflare or `kobeapptz.com` is unavailable, Lala can be opened directly at:

`https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup/app`

This URL does not traverse Cloudflare.
