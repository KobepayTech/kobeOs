# KobeOS

KobeOS is an offline-first business platform that ships as both a hosted web
app and a self-contained desktop OS. It bundles a React + TypeScript shell,
a NestJS API, an embedded PostgreSQL instance, and a runtime layer for
device, AI, and sync services. A single binary boots the whole stack — no
manual server, no cloud account, no internet required.

The platform hosts module apps (cargo, hotel/POS, property, ERP, creator
marketplace, payments, sports, productivity) inside a desktop-style shell
with windowing, app launcher, notifications, and per-tenant subdomain
guest portals.

## Architecture

```
src/              React + TypeScript shell (apps/, os/, components/, lib/)
electron/         Desktop wrapper, IPC, embedded Postgres bootstrap, installer
server/           NestJS API + TypeORM entities + migrations
runtime/          OS-like services: file store, devices, AI, sync engine
sdk/              Shared SDK consumed by apps
ai/, models/      Local model inference + bundled model assets
scripts/          Build / packaging / ISO / model tooling
.github/workflows CI for desktop, Windows installer, USB image
live-build/       Debian live-build chroot for the USB image (not source)
release/          Packaged Electron output (not source)
```

## Quick start (web dev)

Requirements: Node 22+, Postgres 14+ running locally (or use the embedded
desktop edition for a zero-install dev loop).

```bash
npm install
cd server && npm install && cd ..

# In one shell:
cd server && npm run start:dev      # API on http://localhost:3000/api

# In another shell:
npm run dev                          # Shell on http://localhost:5173
```

Default dev credentials are auto-provisioned (`demo@kobeos.local`); the
shell calls `ensureSession()` on first load and registers the account.

Environment variables (server, `.env` in `server/`):

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=kobe
DB_PASSWORD=kobe
DB_DATABASE=kobeos
JWT_SECRET=replace-me
NODE_ENV=development        # gates synchronize + dev-only routes
DB_SYNCHRONIZE=true         # honored only when NODE_ENV=development
```

In production, `synchronize` is forced off and migrations run automatically
on boot (`migrationsRun = true when !isDev`). Setting both
`NODE_ENV=production` and `DB_SYNCHRONIZE=true` is rejected by the
bootstrap to prevent accidental schema rewrites.

Health probe: `GET http://localhost:3000/api/health` returns
`{ status, db, timestamp }`. Swagger UI is at `/api/docs`.

## Desktop edition

```bash
npm run build               # build the shell
npm run electron:dev        # run Electron against the dev shell
npm run electron:build      # package an Electron installer for the host platform
npm run electron:build:linux   # cross-build the Linux .deb / AppImage
npm run electron:build:win     # cross-build the Windows installer
```

The Electron main process boots an embedded Postgres, starts the NestJS
bundle, waits for `/api/health` to respond 2xx, then loads the shell.
Destructive IPC operations (system shutdown, system reboot, install to
disk) require explicit confirmation in a native dialog before executing.

## USB / ISO image

```bash
npm run iso:build           # builds the Linux installer + boots a live USB ISO
npm run iso:package         # repackages an already-built tree
```

The live image launches the Electron shell in kiosk mode. Inside the OS,
the user can run "Install to Disk" — the installer formats the chosen
device, copies KobeOS to the target root, writes systemd units to the
TARGET's `/etc/systemd/system/`, registers them with
`systemctl --root=/mnt/kobeos enable …`, creates the `kobeos` user inside
a chroot, and writes GRUB. The live USB is never modified.

## Models

```bash
npm run models:bundle       # fetch + bundle local model artifacts (kobemodel.zip)
npm run models:checksums    # refresh checksum manifests
npm run models:upload       # publish to the model registry
```

## Tests

```bash
npm test                    # frontend (vitest)
cd server && npm test       # backend
npm run lint                # eslint
```

## Repository layout notes

- `live-build/chroot/` contains a Debian chroot used to assemble the USB
  image. It includes self-referential X11 symlinks; `vite.config.ts`
  excludes it from the dev watcher and dep scanner.
- `release/` is packaged Electron output; also excluded from the watcher.
- Migrations live in `server/src/migrations/` and run automatically on
  the desktop edition's first boot.
