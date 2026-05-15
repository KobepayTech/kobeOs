# AGENTS-IMPROVEMENT-SPEC.md

Concrete improvements identified from a full audit of the codebase, backend, and build pipeline.

---

## Audit Summary

### What's Good

- **Backend architecture is solid.** NestJS modules are well-separated by domain. Auth uses short-lived JWTs (15m) + refresh tokens. Rate limiting, global validation pipe, and a global exception filter are all in place.
- **Env validation at startup.** `env.validation.ts` uses class-validator to fail fast on missing/invalid config.
- **Audit trail exists.** `AuditModule` + `AuditService` are wired in. Migration creates the `audit_logs` table with proper indexes.
- **Redis cache is optional.** Falls back to in-memory gracefully when `REDIS_URL` is absent.
- **OS shell is well-structured.** Zustand store, manifest-based app registry, and window manager are clean patterns.
- **PWA support.** `vite-plugin-pwa` is configured with a service worker and runtime caching.
- **ISO build pipeline exists.** `scripts/build-iso.js` + GRUB config covers live/install/recovery boot modes.
- **Docker Compose** covers PostgreSQL for local dev.

### What's Missing

1. **No AGENTS.md** — created by this session.
2. **No frontend tests** — zero test files in `src/`.
3. **No unit tests in backend** — only e2e specs; no `*.spec.ts` unit tests.
4. **ISO build tools absent from devcontainer** — `grub-mkrescue`, `xorriso`, `mtools` are not installed; `npm run iso:build` will always fail in this environment.
5. **No CI pipeline** — no `.github/workflows/` files; no automated lint, test, or build checks.
6. **No Swagger/OpenAPI docs** — 20+ backend modules with no API documentation.
7. **`dist2/` committed to git** — build artifacts in version control bloat the repo and cause merge conflicts.
8. **No migration for most entities** — only one migration file exists; most tables rely on `DB_SYNCHRONIZE=true` which is unsafe for production.
9. **No health-check endpoint** — no `/api/health` route for load balancers or uptime monitors.
10. **`App.tsx` is a dead shell** — the real OS is in `src/os/`; `App.tsx` has a duplicate simplified Desktop that diverges from the real one.
11. **Electron security flags** — `contextIsolation: false` + `nodeIntegration: true` + `webSecurity: false` are all set simultaneously; this is acceptable for a locked-down kiosk but must be documented as intentional.
12. **No `.env` in devcontainer automation** — developers must manually copy `.env.example`; no automation task does this.
13. **Shell scripts (`improve-kobeos.sh`, `push-kobeos-complete.sh`) are dangerous** — they overwrite source files and push to git without review gates.

### What's Wrong

1. **`electron/main.js` has `contextIsolation: false`** but `preload.js` uses `contextBridge` — these are contradictory. `contextBridge` only works when `contextIsolation: true`. The preload's `window.kobeOS` exposure is silently broken in the current config.
2. **`install-to-disk` IPC runs unsanitized shell interpolation** — `diskPath` from the renderer is interpolated directly into a shell script string. This is a command injection vector.
3. **`DB_SYNCHRONIZE` defaults to `true` in `.env.example`** — if a developer copies this to production, TypeORM will auto-alter the schema on startup.
4. **`App.tsx` `WindowManager` falls through to a stub** for all real apps — the 70+ apps in `src/apps/` are registered in `src/os/registry.ts` but `App.tsx`'s `WindowManager` never renders them. The two shells are disconnected.
5. **`useSystemMode` hook reads `file:///proc/mounts`** via `fetch()` — this will always fail in a browser context (CORS/protocol block) and silently falls back to `'installed'`, making live-USB detection unreliable.
6. **No `@nestjs/swagger`** — the `PaymentsController`, `CargoController`, etc. have no decorators; API shape is undiscoverable without reading source.
7. **`server/src/app.module.ts` has a syntax artifact** — line contains `VideoGenerationModule,\n    AiModule,` with a literal `\n` embedded in the source (not a real newline), indicating a copy-paste error.

---

## Improvement Spec

### P0 — Correctness Fixes (break things if left unfixed)

#### 1. Fix Electron `contextIsolation` / `contextBridge` contradiction

**File:** `electron/main.js`

Change:
```js
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,   // ← contradicts contextBridge usage
  enableRemoteModule: true,
  webSecurity: false
}
```
To:
```js
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,    // required for contextBridge to work
  webSecurity: false         // keep false only if loading local file:// resources
}
```
`preload.js` already uses `contextBridge.exposeInMainWorld` correctly — it just needs `contextIsolation: true` to activate.

#### 2. Sanitize `install-to-disk` IPC input

**File:** `electron/main.js`

The `diskPath` parameter must be validated before shell interpolation:
```js
ipcMain.handle('install-to-disk', async (event, diskPath) => {
  // Validate: must match /dev/sd[a-z] or /dev/nvme[0-9]n[0-9]
  if (!/^\/dev\/(sd[a-z]|nvme\d+n\d+)$/.test(diskPath)) {
    return { success: false, error: 'Invalid disk path' };
  }
  // ... rest of handler
});
```

#### 3. Fix `app.module.ts` syntax artifact

**File:** `server/src/app.module.ts`

The literal `\n` between `VideoGenerationModule,` and `AiModule,` must be replaced with an actual newline. Verify the file compiles cleanly with `cd server && npm run build`.

#### 4. Fix `useSystemMode` live-USB detection

**File:** `src/hooks/useSystemMode.ts`

`fetch('file:///proc/mounts')` will never work in a browser. Replace with an Electron IPC call:

- Add `ipcMain.handle('get-system-mode', ...)` in `electron/main.js` that reads `/proc/mounts`.
- Expose via `contextBridge` in `preload.js`.
- In the hook, check `window.kobeOS?.system?.getMode?.()` and fall back to `'development'` when not in Electron.

---

### P1 — Safety / Production Readiness

#### 5. Remove `DB_SYNCHRONIZE=true` from `.env.example`

**File:** `server/.env.example`

Change `DB_SYNCHRONIZE=true` to `DB_SYNCHRONIZE=false` and add a comment:
```
# Dev only: auto-sync schema from entities. NEVER true in production.
# Use migration:run instead.
DB_SYNCHRONIZE=false
```

#### 6. Generate migrations for all entities

Run `migration:generate` for each domain that has no migration coverage:
```bash
cd server
npm run migration:generate -- src/migrations/InitialSchema
npm run migration:run
```
Set `DB_SYNCHRONIZE=false` and `DB_MIGRATIONS_RUN=true` as the default for production.

#### 7. Add `/api/health` endpoint

**File:** `server/src/app.controller.ts`

Add a simple health check:
```ts
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

#### 8. Remove `dist2/` from git tracking

```bash
echo "dist2/" >> .gitignore
git rm -r --cached dist2/
git commit -m "stop tracking dist2 build artifact"
```

---

### P2 — Developer Experience

#### 9. Add CI pipeline

Create `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run build

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - working-directory: server
        run: npm ci && npm run build && npm run lint
```

#### 10. Add ISO build tools to devcontainer

**File:** `.devcontainer/devcontainer.json`

Switch from the universal image to a Node image with ISO tools:
```json
{
  "name": "KobeOS Dev",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "features": {},
  "postCreateCommand": "sudo apt-get update && sudo apt-get install -y grub-pc-bin grub-efi-amd64-bin xorriso mtools && npm install && cd server && npm install"
}
```

#### 11. Automate `.env` setup

Add an Ona automation task in `.gitpod.yml` or `devcontainer.json` `postCreateCommand`:
```bash
[ -f server/.env ] || cp server/.env.example server/.env
```

#### 12. Add Swagger to backend

```bash
cd server && npm install @nestjs/swagger
```

In `server/src/main.ts`:
```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const swaggerConfig = new DocumentBuilder()
  .setTitle('KobeOS API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api/docs', app, document);
```

#### 13. Delete or consolidate `App.tsx`

`src/App.tsx` contains a duplicate simplified Desktop/WindowManager that is disconnected from the real OS shell in `src/os/`. Options:
- **Option A (recommended):** Replace `src/App.tsx` with a thin wrapper that just renders `src/os/Desktop.tsx` and handles auth.
- **Option B:** Delete `App.tsx` and update `src/main.tsx` to import directly from `src/os/`.

The stub `WindowManager` in `App.tsx` that renders `🚧` for all real apps must be removed.

#### 14. Add shell script safety gates

`improve-kobeos.sh` and `push-kobeos-complete.sh` overwrite source files and push to git. Add a confirmation prompt at the top of each:
```bash
read -p "This will overwrite source files. Continue? [y/N] " confirm
[[ "$confirm" == "y" ]] || exit 1
```
Or move them to `scripts/` and document them in AGENTS.md as maintenance-only tools.

---

### P3 — Testing

#### 15. Add backend unit tests

Each service should have a `*.spec.ts` alongside it. Start with the most critical:
- `server/src/auth/auth.service.spec.ts` — token issuance, refresh, revocation
- `server/src/payments/payments.service.spec.ts` — wallet credit/debit logic
- `server/src/cargo/cargo.service.spec.ts` — shipment state transitions

Use `@nestjs/testing` `Test.createTestingModule` with mocked TypeORM repositories.

#### 16. Add frontend smoke tests

Install Vitest:
```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom
```

Start with:
- `src/os/store.test.ts` — window open/close/focus state transitions
- `src/os/registry.test.ts` — all manifests have required fields

---

## Priority Order

| # | Item | Priority | Effort |
|---|---|---|---|
| 1 | Fix contextIsolation contradiction | P0 | 5 min |
| 2 | Sanitize install-to-disk input | P0 | 15 min |
| 3 | Fix app.module.ts syntax artifact | P0 | 2 min |
| 4 | Fix useSystemMode detection | P0 | 30 min |
| 5 | Remove DB_SYNCHRONIZE=true from example | P1 | 2 min |
| 6 | Generate + run migrations | P1 | 1 hr |
| 7 | Add /api/health endpoint | P1 | 10 min |
| 8 | Remove dist2 from git | P1 | 5 min |
| 9 | Add CI pipeline | P2 | 30 min |
| 10 | ISO tools in devcontainer | P2 | 15 min |
| 11 | Automate .env setup | P2 | 5 min |
| 12 | Add Swagger | P2 | 30 min |
| 13 | Consolidate App.tsx | P2 | 1 hr |
| 14 | Shell script safety gates | P2 | 15 min |
| 15 | Backend unit tests | P3 | 2–4 hrs |
| 16 | Frontend smoke tests | P3 | 2 hrs |
