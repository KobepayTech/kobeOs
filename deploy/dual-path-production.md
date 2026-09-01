# KobeOS dual-path production

KobeOS public services use two independent production paths.

## Primary path

- Public app: `https://lala.kobeapptz.com`
- API: `https://api.kobeapptz.com/api`
- Edge: Cloudflare
- Tunnel: two `cloudflared` connectors are started by the primary production stack.

## Independent backup path

- API host: GitHub variable `BACKUP_API_HOST`
- Web host: GitHub variable `BACKUP_WEB_HOST`
- Hosts MUST be outside the `kobeapptz.com` Cloudflare DNS zone.
- Stack: `server/docker-compose.backup.yml`
- TLS/reverse proxy: Caddy, directly on the backup VPS.
- Emergency Lala frontend: `https://kobepaytech.github.io/kobeOs/lala/`

The primary and backup API must use the same PostgreSQL source of truth.
Primary production enables this with `KOBE_SHARED_DB_HOST`; the backup VPS
uses `DB_HOST` in `server/.env.backup`.

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
3. The GitHub Pages emergency frontend.

The backup deployment workflow also verifies the API and Lala from a
GitHub-hosted runner after each deploy.


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
