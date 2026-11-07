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

## Verified on 28 October 2026

The supplied account credential unblocked deployment after the initial browser
sign-in timed out. The credential is not stored in this repository.

- `neon deploy`: succeeded; production matched the PostgreSQL policy and three
  managed variables were pulled into the ignored `.env.local`.
- Production: project `kobeos-online`, PostgreSQL 18, region `aws-us-east-2`.
- All 97 migrations passed first on an isolated verification branch and then
  on production. Production has 345 public tables and zero users; no desktop
  data was imported and no test fixtures were written to production.
- Root `npm run build`: passed, including typechecking, Vite and PWA generation
  (`built in 13.43s`). Backend `npm run build`: exit 0.
- Database configuration unit tests: seven passed in the prior setup round.
- Three selected E2E suites against the verification branch: 23 passed in
  102.031 seconds (`auth`, `notes`, `online-continuity`). This was not a rerun of
  the entire repository test suite.
- Started the compiled NestJS API against the verification branch, checked
  `/api/health` (HTTP 200, `db=connected`), registered a test user (HTTP 201),
  and created an authenticated record (HTTP 201). Restarted the API and read
  the same record (HTTP 200), then deleted it (HTTP 200).

This workspace cannot use direct PostgreSQL TCP egress. Verification therefore
used a temporary Neon WebSocket transport with TLS and the workspace HTTPS
proxy, injected outside the repository. Jest required the same adapter in its
isolated module registry. These were environment-related failed attempts,
resolved before the successful tests above. The deployed application retains
TypeORM and native `pg`; test native TCP connectivity again from its hosting
runtime. The temporary transport is not a production dependency.

The current Neon recovery history window is six hours (21,600 seconds).
This setup did not extend retention, validate a point-in-time restore, deploy
an always-on API host, configure its application secrets, or activate live
KobeOS-to-cloud synchronization. PostgreSQL provisioning alone does not make
the public continuity service live.

The global CLI install failed with `EACCES`; `npx neon@latest` worked. Backend
`npm ci --ignore-scripts` encountered the existing NestJS 10 / Swagger 11 peer
dependency conflict. `npm ci --ignore-scripts --legacy-peer-deps` installed the
locked dependencies for verification; dependency versions were not changed.
