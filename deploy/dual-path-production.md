# KobeOS MVP production architecture

The MVP production path deliberately keeps the existing KobeOS source of truth
and origin intact. No database migration is required for launch.

## Active MVP path

```text
Lala / Jumla web
    |
    +--> Cloudflare Pages

KobeOS API
    |
    v
api.kobeapptz.com
    |
    v
Cloudflare Tunnel
    |
    v
Windows KobeOS origin: C:\KobeOS\app
    |
    +--> NestJS API :3000
    |
    +--> embedded PostgreSQL 127.0.0.1:5433
```

The existing local PostgreSQL database remains the source of truth. The MVP
does not move data to another provider.

## Automatic origin recovery and deploy

Workflow:

`.github/workflows/lala-origin-selfheal.yml`

It runs on the registered Windows self-hosted GitHub runner and:

1. Locates `C:\KobeOS\app`.
2. Repairs the persistent KobeOS origin supervisor.
3. Builds the current tested backend when the stable origin is behind master.
4. Runs TypeORM migrations against the existing embedded PostgreSQL database.
5. Atomically replaces the stable backend bundle.
6. Restarts/verifies the existing Cloudflare connector if public API health is
   failing.
7. Verifies the API from an off-box GitHub runner.
8. If valid Cloudflare account credentials already exist on the origin, refreshes
   the Lala and Jumla Pages deployments without copying those credentials into
   GitHub.

The recovery job stays queued when the Windows machine or its GitHub Actions
runner service is offline. Once that runner reconnects, the queued job can
complete without SSH deployment credentials.

## Public frontend deployments

Dedicated Pages workflows remain available:

- `.github/workflows/deploy-lala-pages.yml`
- `.github/workflows/deploy-jumla-pages.yml`

Their automatic runs are opt-in. They can still be dispatched manually when
GitHub's production environment has Cloudflare credentials.

## Deferred Cloudflare Container migration

`deploy/cloudflare-primary-api/` and
`.github/workflows/deploy-cloudflare-primary-api.yml` remain in the repository
for a later always-on migration.

That path is **not the MVP origin**. It is opt-in through
`CLOUDFLARE_CONTAINER_PRIMARY_ENABLED=true` or manual workflow dispatch.

A Cloudflare Container must never be pointed at `localhost`, `127.0.0.1`,
`postgres`, or another host-local database name. A future Container migration
requires a PostgreSQL endpoint reachable from Cloudflare and a verified data
migration/cutover plan.

## Deferred SSH / backup paths

The following deployments are also opt-in and are not required for MVP:

- Legacy SSH production deploy: `LEGACY_SSH_DEPLOY_ENABLED=true`
- Independent backup VPS deploy: `BACKUP_DEPLOY_ENABLED=true`

The backup stack may be introduced later, but it must not create a second
source of truth.

## MVP rollback

The active MVP does not replace the production database. If a new backend bundle
fails, the stable origin keeps `server\dist.previous` during atomic deployment.
Cloudflare Tunnel configuration remains unchanged.

This keeps rollback local and avoids data migration during the MVP launch.
