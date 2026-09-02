# KobeOS production architecture

KobeOS MVP uses Cloudflare as the primary public edge while preserving the
existing API origin underneath the Worker Route as an immediate rollback path.

## Primary path

- Public Lala app: `https://lala.kobeapptz.com`
- Public API: `https://api.kobeapptz.com/api`
- Edge/runtime: Cloudflare Worker + Cloudflare Container
- Deployment source: `deploy/cloudflare-primary-api/`
- Application: existing NestJS image from `server/Dockerfile`
- Database: the existing production PostgreSQL source of truth

The production Worker Route overlays the existing proxied
`api.kobeapptz.com` DNS record. The DNS record is intentionally left in place.
Removing the Worker Route immediately restores traffic to the previous origin.

There is no Supabase dependency in the production request path.

## Database rule

The Cloudflare Container and the legacy origin must point to the **same**
production PostgreSQL database.

Do not create a separate empty database for the Cloudflare Container and do not
migrate production data during the first cutover. Sharing one source of truth
makes rollback an origin switch rather than a data migration.

The required runtime values are:

- `PRIMARY_API_DB_HOST`
- `PRIMARY_API_DB_USERNAME`
- `PRIMARY_API_DB_PASSWORD`
- `PRIMARY_API_JWT_SECRET`
- `PRIMARY_API_PROVIDER_ENCRYPTION_KEY`

These belong in the GitHub `production` environment and must never be
committed.

## Cloudflare configuration

Workflow:

`.github/workflows/deploy-cloudflare-primary-api.yml`

Required Cloudflare account credentials:

- `CLOUDFLARE_API_TOKEN` (or `CF_API_TOKEN`)
- `CLOUDFLARE_ACCOUNT_ID` (or `CF_ACCOUNT_ID`)
- `CLOUDFLARE_ZONE_ID` (or `CF_ZONE_ID`) for production route
  attachment/rollback

Deployment sequence:

1. Deploy the `workers.dev` preview.
2. Verify `/api/health`.
3. Verify one authenticated read.
4. Verify one low-risk write against the same PostgreSQL database.
5. Confirm `X-Kobe-Production-Path: cloudflare-container`.
6. Run the workflow with `cutover=true`.
7. Verify `api.kobeapptz.com` publicly.

If verification fails after route deployment, the workflow removes the KobeOS
Worker Route. The unchanged legacy DNS origin resumes receiving traffic.

## Fallback semantics

Inside the production Worker:

- GET/HEAD/OPTIONS may fall through to the legacy origin when the Container
  throws or returns a 5xx.
- Mutating requests are never blindly replayed to another origin.
- Fallback responses are marked
  `X-Kobe-Production-Path: legacy-origin-fallback`.

The public client still supports `VITE_API_FALLBACK_BASE` for a future
independent backup API, but no fallback is configured by default.

## Optional future independent backup

The repository still contains the separate VPS backup stack:

- `server/docker-compose.backup.yml`
- `server/.env.backup.example`
- `.github/workflows/deploy-backup-origin.yml`

It is **optional** and is not required for the MVP. If enabled later, it must
use the same managed PostgreSQL database and hostnames outside the
`kobeapptz.com` Cloudflare zone.

## Verification

`.github/workflows/dual-path-production-smoke.yml` always verifies the primary
API and Lala web app. It verifies a direct backup only when
`BACKUP_API_HOST` and `BACKUP_WEB_HOST` are explicitly configured.
