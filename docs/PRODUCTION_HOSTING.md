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

## Backup and restore verification

`.github/workflows/verify-database-restore.yml` runs nightly and on demand. It
dumps the live primary database, restores it into a throwaway service container
of the same major version, and compares the restored copy against the source on:

- table count,
- `kobeos_migrations` count — the schema's version, and a restore that lost it
  would look healthy until the next deploy tried to re-apply everything,
- row counts for the tables a business cannot lose (`users`, `hotel_bookings`,
  `pos_orders`, `commerce_product_snippets`, `cloud_outbox`,
  `cloud_room_allotments`, `commerce_product_media`),
- total `bytea` length of replicated images, since a truncated column still
  counts as a row.

The source is live, so a table that grew mid-dump is reported as a warning. A
restored copy holding *more* rows than the source fails the run, as does any
`pg_restore` error, a missing migration row, or a dump small enough to suggest
the credentials pointed at the wrong database.

**The dump is discarded with the runner and never uploaded.** It contains real
customer and guest data, and a copy of production in an artifact store is
simply a new place for that data to leak from. Retention belongs on a storage
target with its own access control and lifecycle.

This workflow proves *restorability*. It is not itself the retention policy:
Neon's point-in-time recovery window is the current retention, and at six hours
it is thin for a system of record. Lengthening it, or adding an off-platform
target, is a hosting decision rather than a code one.

Set `PRIMARY_API_DATABASE_URL_UNPOOLED` for the dump. Dumping through a
transaction pooler can drop a long-running snapshot; the workflow warns when it
detects a pooled host and carries on.

`PG_MAJOR` in the workflow must match or exceed the source server's major
version — Neon currently reports **18.6**. `pg_dump` refuses outright on a
mismatch, so a Neon major upgrade will fail this job until `PG_MAJOR` and the
service container image are raised together. The job checks client against
server before dumping so the failure says exactly that, rather than looking
like a connection problem.

## Creating the cloud administrator

The cloud instance starts with no administrator, so the admin-only endpoints
(including `DELETE /api/users/:id`) cannot be used at all. Run the
**Bootstrap Cloud Admin** workflow once to create one.

It needs a single secret in the `production` environment:

| Secret | Notes |
|---|---|
| `CLOUD_ADMIN_PASSWORD` | At least 12 characters, matching `UsersService` |

Then dispatch the workflow with the administrator's email. It creates the
account directly in the primary database with a cost-12 bcrypt hash — the same
hash the application would have written — then **signs in through the public
API and asserts the role is `admin`**, so a hash the application cannot verify
cannot be mistaken for success. An optional `delete_user_id` input removes a
user through the admin endpoint in the same run.

Why not `KOBEOS_BOOTSTRAP_ADMIN_EMAIL` / `_PASSWORD`: those live in the Worker's
runtime secrets, so the password would sit in the serving environment
indefinitely and be re-read on every container start. Here it is a CI secret,
used once.

The password is never printed, never passed on a command line (where it would
appear in the process list) and never committed; it reaches bcrypt through the
environment only. Rotate it from the account after first sign-in, then remove
the secret.

An existing account is never promoted — the same rule as
`UsersService.onModuleInit`. Granting admin to an account whose password someone
else chose would be privilege escalation dressed up as convenience, so the run
fails instead.
