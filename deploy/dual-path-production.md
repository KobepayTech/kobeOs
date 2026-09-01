# KobeOS dual-path production

KobeOS public services use two independent production paths.

## Primary path

- Public app: `https://lala.kobeapptz.com`
- API: `https://api.kobeapptz.com/api`
- Preferred API origin: the always-on VPS stack in `server/docker-compose.primary-api.yml`.
- TLS/reverse proxy: Caddy on the VPS. Cloudflare may remain the public edge/proxy, but API uptime no longer depends on a Windows `cloudflared` connector after DNS cutover.
- Migration/rollback instructions: `deploy/always-on-api.md`.
- The existing tunnel origin can remain available during migration as the fast DNS rollback target.

## Independent backup path

- API host: GitHub variable `BACKUP_API_HOST`
- Web host: GitHub variable `BACKUP_WEB_HOST`
- Hosts MUST be outside the `kobeapptz.com` Cloudflare DNS zone.
- Stack: `server/docker-compose.backup.yml`
- TLS/reverse proxy: Caddy, directly on the backup VPS.
- Emergency Lala frontend and API: `https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup/app`

The primary and backup API must use the same PostgreSQL source of truth.
The always-on primary VPS uses `DB_HOST` in `server/.env.primary-api`;
the independent backup VPS uses `DB_HOST` in `server/.env.backup`.
The legacy tunnel origin can use `KOBE_SHARED_DB_HOST` while it remains
available as a migration/rollback target.

## Required GitHub configuration

Environment `production-backup` secrets:

- `BACKUP_DEPLOY_HOST`
- `BACKUP_DEPLOY_USER`
- `BACKUP_DEPLOY_SSH_KEY`

Repository or environment variables:

- `BACKUP_API_HOST`
- `BACKUP_WEB_HOST`
- optional `BACKUP_DEPLOY_PATH`

The backup VPS must contain `server/.env.backup`, created from
`server/.env.backup.example`, with the managed PostgreSQL credentials and
normal KobeOS server secrets.

Primary `server/.env` must contain:

- `KOBE_SHARED_DB_HOST=<same managed PostgreSQL host>`
- `KOBE_SHARED_DB_PORT=<port>`
- `DB_SSL=true` when required by the database provider.

## Failover semantics

Public reads can retry another healthy API origin for network errors, 408, 429,
or 5xx responses.

Mutating requests such as bookings and orders are different: the browser first
health-checks the available API origins, chooses one healthy origin, and sends
the mutation exactly once. It never blindly replays a write to another origin,
avoiding duplicate transactions when a response is lost during an outage.

## Verification

`.github/workflows/dual-path-production-smoke.yml` independently checks:

1. Cloudflare Lala + API.
2. Direct backup Lala + API and the `X-Kobe-Production-Path: backup-direct`
   response header.
3. The Supabase emergency Lala frontend.

The optional direct-VPS deployment workflow remains available as a third path.
The active emergency path is Supabase and is verified from GitHub-hosted runners.


## Active no-Cloudflare emergency layer

The immediate independent fallback is live on Supabase project `KobeOS Backup`
(project ref `erimnjgpawuxesonkeoz`) in `eu-central-1`.

Public backup API base:

`https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup`

It mirrors Lala public hotel/room/menu data every five minutes while primary is
reachable. During a Cloudflare outage it serves the last successful snapshot
and accepts new Lala Passports, booking requests, reverse requests and food
orders into a private RLS-protected queue. Maintenance automatically replays
queued writes to primary KobeOS after it recovers.

Because the snapshot can become stale during a prolonged outage, backup
bookings are explicitly marked `BACKUP_PENDING`; the UI never presents them
as final room confirmations until primary KobeOS accepts them.


## Emergency URL

If Cloudflare or `kobeapptz.com` is unavailable, Lala can be opened directly at:

`https://erimnjgpawuxesonkeoz.supabase.co/functions/v1/kobeos-backup/app`

This URL does not traverse Cloudflare. The same Supabase project serves the
emergency API and stores the synchronized public snapshot plus queued outage-time
writes. The snapshot sync first uses `/lala-public/backup-snapshot`; for older
primary deployments it automatically falls back to the already-public Lala
search and hotel-menu endpoints.
