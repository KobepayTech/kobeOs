# KobeOS cloud PostgreSQL on Neon

This checkout is configured for organization `org-morning-smoke-34270789`,
project `dawn-unit-55970642`, branch `production`. `.neon` is local and ignored.
Only PostgreSQL is requested. Existing authentication, file storage and the
NestJS/TypeORM `pg` driver remain in place. `neon deploy` configures the database
services; it does not deploy the NestJS API or frontend.

## Finish provisioning

Run from the repository root in an authenticated workspace:

```sh
npx neon@latest login
npx neon@latest init -y --org-id org-morning-smoke-34270789 --project-id dawn-unit-55970642 --branch production --services postgres
npx neon@latest config plan
npx neon@latest deploy
```

Deploy pulls `DATABASE_URL` and `DATABASE_URL_UNPOOLED` into `.env.local`, or
`.env` if it exists. Do not commit or print these credentials. Preserve the
provider's TLS parameters. Database URLs must stay server-side, without a
`VITE_` prefix.

The backend and migration CLI load the current working directory's `.env.local`
and `.env`, then the repository root equivalents when launched from `server/`.
Process environment takes precedence. A configured URL takes precedence over
the legacy `DB_*` connection fields. Test mode skips dotenv files: destructive
E2E suites must use an explicitly isolated test database, never production.

## Schema and runtime

Supply the existing application's secrets separately in `server/.env` or the
hosting environment, including `JWT_SECRET` (at least 32 characters), `PORT`,
and `NODE_ENV`. Keep the established JWT signing key when existing sessions
must remain valid. Leave `KOBEOS_DESKTOP` unset for this cloud service and set
`DB_SYNCHRONIZE=false`.

Test migrations on an isolated Neon branch first. Migration commands select
`DATABASE_URL_UNPOOLED` and reject pooled endpoints. Once validated, apply the
same migrations to the intended production branch:

```sh
cd server
npm run migration:run
npm run build
```

Set `DB_MIGRATIONS_RUN=false` after the explicit migration step to use the pooled
`DATABASE_URL` for application traffic. When startup migrations are enabled,
the runtime uses the direct connection so migrations have a stable session.

```sh
npm run start:prod
```

Verify `/api/health` returns `status: "ok"` and `db: "connected"`, then exercise
a reservation/order through the API against an isolated branch, restart the
API, and verify the record persists. Configuration unit tests and a frontend
build do not establish database connectivity or end-to-end readiness.

## Verification from this setup attempt

- Root `npm run build`: passed (Vite and PWA outputs generated).
- Backend `npm run build`: passed.
- Database configuration tests: passed after adding the test metadata import.
- `neon deploy`: blocked; browser authentication timed out after 60 seconds.
- Backend startup: blocked by missing database URLs and application settings.
- Neon migrations, database connectivity and reservation/order E2E: not run.

The global CLI install failed with `EACCES`; `npx neon@latest` worked. Backend
`npm ci --ignore-scripts` encountered the existing NestJS 10 / Swagger 11 peer
dependency conflict. `npm ci --ignore-scripts --legacy-peer-deps` installed the
locked dependencies for verification; dependency versions were not changed.
