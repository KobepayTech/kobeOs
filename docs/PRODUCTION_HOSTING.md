# Production hosting: Cloudflare primary, VPS fallback

Both deploy paths already exist and both are switched off. Neither needs new
code. What they need is a database that is not on a desktop, and a set of
credentials only the account owner can create.

Written after the origin PC was found switched off with the site returning
Cloudflare 1033 (tunnel not connected), four days after it had last served
traffic, with nothing alerting anyone.

## Do the database first

This is the part that looks optional and is not.

`deploy-cloudflare-primary-api.yml` refuses to deploy when `PRIMARY_API_DB_HOST`
is `localhost`, `127.0.0.1`, `::1`, `postgres` or `kobe-postgres`, because a
Worker on Cloudflare's edge cannot reach a database on your machine. Today the
production Postgres is an embedded cluster the supervisor starts on
`127.0.0.1:5433` on the Windows box. Moving the API to Cloudflare without
moving the database just relocates the outage.

So the order is: database, then primary API, then fallback. Doing it the other
way round wastes a deploy cycle.

The container config already expects a managed instance:

```jsonc
"DB_PORT": "5432",  "DB_DATABASE": "kobeos",
"DB_SSL": "true",   "DB_SSL_REJECT_UNAUTHORIZED": "true"
```

Port 5432, TLS required, certificate verified. Any managed Postgres meets that;
the embedded one does not.

**One VPS covers both needs.** A single small instance can host the Postgres
that Cloudflare connects to *and* run the fallback API. That is why the two
chosen paths fit together rather than competing: buy one machine, use it twice.
A managed Postgres (Neon, Supabase, Railway) also works and removes the
database from your operational surface entirely, at the cost of one more
provider.

## Primary: Cloudflare Worker + Container

`deploy-cloudflare-primary-api.yml`, gated on `vars.CLOUDFLARE_CONTAINER_PRIMARY_ENABLED`.
Its config validates today — both `wrangler deploy --dry-run` steps pass. It
stops at the credential check.

Set these in the GitHub **`production` environment**, not in the repository and
not in any file here:

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Needs Account → Cloudflare Tunnel → Edit and Zone → DNS → Edit |
| `CLOUDFLARE_ACCOUNT_ID` | From the Cloudflare dashboard |
| `CLOUDFLARE_ZONE_ID` | The zone for `kobeapptz.com` |
| `PRIMARY_API_DB_HOST` | The hosted Postgres hostname — **not** localhost |
| `PRIMARY_API_DB_USERNAME` | Database user |
| `PRIMARY_API_DB_PASSWORD` | Database password |
| `PRIMARY_API_JWT_SECRET` | 32 characters minimum |
| `PRIMARY_API_PROVIDER_ENCRYPTION_KEY` | Provider credential encryption key |

Then `vars.CLOUDFLARE_CONTAINER_PRIMARY_ENABLED = true` so it runs on every
green CI build of master.

Deploying is two steps on purpose. A `workflow_dispatch` with `cutover: false`
publishes a workers.dev preview and touches nothing public; `cutover: true`
binds the `api.kobeapptz.com` route. Verify the preview before the cutover.

The container migrates on boot (`max_instances: 1`, so no concurrent
migration), and the migration path is proven from empty: 96 migrations, 343
tables.

## Fallback: VPS

`deploy-primary-api-vps.yml`, gated on `vars.PRIMARY_API_ENABLED`.

| Name | Kind | What it is |
|---|---|---|
| `PRIMARY_API_DEPLOY_HOST` | secret | VPS hostname or IP |
| `PRIMARY_API_DEPLOY_USER` | secret | SSH user |
| `PRIMARY_API_DEPLOY_SSH_KEY` | secret | Private key for that user |
| `PRIMARY_API_DEPLOY_PATH` | var | Install directory on the VPS |
| `PRIMARY_API_HOST` | var | Defaults to `api.kobeapptz.com` |
| `PRIMARY_API_PUBLIC_VERIFY` | var | `true` to verify publicly after deploy |

`deploy-backup-origin.yml` is a third path with the same shape
(`BACKUP_DEPLOY_HOST` / `_USER` / `_SSH_KEY`, `BACKUP_API_HOST`,
`BACKUP_DEPLOY_PATH`, `BACKUP_WEB_HOST`, gated on `BACKUP_DEPLOY_ENABLED`) if
the fallback should live somewhere separate from the primary.

**Failover is not automatic yet.** Deploying to both gives you two origins; it
does not give you health-based switching between them. That needs a Cloudflare
Load Balancer with a health check on `/api/health`, or a Worker that tries the
container and falls back on failure. Worth doing, and worth not assuming it is
already there.

## Retire the desktop origin deliberately

`release-windows-origin-mvp.yml` keeps working and should be left alone until
the Cloudflare path has served real traffic. Once it has, stop deploying to the
desktop rather than leaving two origins fighting over the same hostname — and
note that the desktop's supervisor rebuilds an incompatible database on boot,
which is correct for a dev box and wrong for anything holding customer data.

## Monitoring, before any of this is called done

The site was down for days and nothing said so. `deploy/uptime-watchdog.sh`,
`deploy/kobeos-watchdog.service` and `deploy/kobeos-watchdog.timer` have been
in this repository the whole time, unused.

Whatever hosts the API, something has to check `/api/health` from outside it
and tell a human when it stops answering. An uptime check is cheaper than the
hosting and catches the failure that actually happened.

## What is still unproven

No account has ever been created on a live deployment. Every verification so
far is infrastructure: health endpoints, migrations, schema. Nobody has booked
a room, taken a payment and checked a guest out against production. That walk
is the real readiness test and it has not happened.
