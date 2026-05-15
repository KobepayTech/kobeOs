# AGENTS.md — KobeOS

Agent guidance for working in this repository.

---

## Project Overview

KobeOS is a web-based operating system shell built with React + TypeScript + Vite, packaged as an Electron desktop app and distributable as a bootable Linux ISO. It hosts 70+ modular apps covering ERP, cargo logistics, hotel, payments, POS, and productivity tools.

**Stack:**
- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS v3, shadcn/ui, Zustand, Framer Motion
- **Backend:** NestJS 10, TypeORM, PostgreSQL 16, Socket.io, Redis (optional)
- **Desktop:** Electron 35 (kiosk mode, IPC for shutdown/reboot/disk install)
- **Distribution:** AppImage, .deb, NSIS installer, bootable ISO via `grub-mkrescue`

---

## Repository Layout

```
kobeOs/
├── src/                    # Frontend (React)
│   ├── apps/               # 70+ app modules — each has manifest.ts + index.tsx
│   ├── os/                 # OS shell: Desktop, Taskbar, WindowManager, store, registry
│   ├── components/         # Shared UI components (LoginScreen, FileManager, etc.)
│   ├── hooks/              # Custom hooks (useSystemMode, etc.)
│   ├── types/              # Shared TypeScript types
│   └── lib/                # Utilities
├── server/                 # Backend (NestJS)
│   └── src/
│       ├── auth/           # JWT + refresh tokens + password reset
│       ├── cargo/          # Cargo/shipment domain
│       ├── payments/       # Wallets, transactions, credit loans
│       ├── users/          # User management
│       ├── common/         # Guards, filters, middleware, decorators
│       ├── config/         # DB config, env validation
│       ├── migrations/     # TypeORM migrations
│       └── ...             # 20+ other domain modules
├── electron/
│   ├── main.js             # Electron main process (IPC handlers, kiosk window)
│   └── preload.js          # contextBridge — exposes kobeOS.system to renderer
├── scripts/
│   └── build-iso.js        # Builds bootable ISO from linux-unpacked release
├── public/                 # Static assets, PWA manifest, service worker
├── build/                  # Electron builder resources (icons, installer scripts)
└── dist2/                  # Pre-built frontend output (committed)
```

---

## Development Setup

### Frontend
```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # TypeScript compile + Vite build → dist/
npm run lint         # ESLint
```

### Backend
```bash
cd server
cp .env.example .env   # fill in secrets
docker-compose up -d   # PostgreSQL on :5432
npm install
npm run start:dev      # NestJS watch mode on :3000
```

### Electron
```bash
npm run electron:dev   # Vite dev + Electron (waits for :5173)
npm run electron:build:linux   # Build AppImage + .deb → release/
npm run iso:build      # Build bootable ISO (requires grub-mkrescue, xorriso)
```

---

## Architecture Patterns

### Adding a New App
1. Create `src/apps/<app-name>/manifest.ts` — defines `id`, `name`, `icon`, `category`, `component`.
2. Create `src/apps/<app-name>/index.tsx` — the app's root component.
3. Register in `src/os/registry.ts` — import manifest and add to the registry array.
4. Optionally pin to desktop in `src/os/store.ts` initial state.

### Backend Module Pattern
Each domain follows NestJS module structure:
```
server/src/<domain>/
  <domain>.module.ts
  <domain>.entity.ts
  <domain>.service.ts
  <domain>.controller.ts
  dto/
```
- All controllers require `JwtAuthGuard` unless explicitly public.
- Use `@Roles(...)` decorator + `RolesGuard` for role-based access.
- Inject `AuditService` for any write operations that need an audit trail.

### OS Store (Zustand)
`src/os/store.ts` is the single source of truth for window state, app registry, notifications, and OS settings. Use `useOSStore()` hook to read/write. Do not manage window state locally in app components.

### Electron IPC
- Renderer → Main: use `window.kobeOS.system.*` (exposed via preload contextBridge).
- Adding new IPC: add `ipcMain.handle(...)` in `electron/main.js` AND expose via `contextBridge` in `electron/preload.js`.

---

## Environment Variables

Backend `.env` (see `server/.env.example`):

| Variable | Required | Notes |
|---|---|---|
| `JWT_SECRET` | Yes | Min 32 chars |
| `PORT` | Yes | Default 3000 |
| `NODE_ENV` | Yes | development / production / test |
| `DB_HOST/PORT/USERNAME/PASSWORD/DATABASE` | Yes | PostgreSQL |
| `DB_SYNCHRONIZE` | Dev only | Set false in prod; use migrations |
| `REDIS_URL` | No | Falls back to in-memory cache |
| `SENDGRID_API_KEY` / `SMTP_*` | No | Email delivery |
| `WEBHOOK_SECRET` | No | Outbound webhook signing |
| `OLLAMA_URL` / `OLLAMA_MODEL` | No | Local AI (DeepSeek via Ollama) |

---

## ISO / Distribution

The ISO build pipeline:
1. `npm run electron:build:linux` → produces `release/linux-unpacked/`
2. `npm run iso:build` → runs `scripts/build-iso.js` which:
   - Copies linux-unpacked into an ISO staging dir
   - Writes GRUB config (live/install/recovery menu entries)
   - Calls `grub-mkrescue` to produce `KobeOS-Installer.iso`

**ISO build dependencies** (must be installed on the build host):
```bash
sudo apt-get install grub-pc-bin grub-efi-amd64-bin xorriso mtools
```

These tools are **not** present in the default devcontainer. The ISO build will fail without them.

---

## Key Constraints

- **No `DB_SYNCHRONIZE=true` in production.** Use `migration:run` instead.
- **Electron security:** `contextIsolation: false` and `nodeIntegration: true` are set in main.js — this is intentional for the kiosk use case but means renderer code has full Node access. Do not load untrusted URLs.
- **`install-to-disk` IPC handler** runs raw shell commands (`parted`, `mkfs`, `grub-install`) as root. Only expose this in the installer UI, never in general app code.
- **App.tsx vs Desktop.tsx:** `src/App.tsx` is a legacy simplified shell. The real OS shell is `src/os/Desktop.tsx` + `src/os/WindowManager.tsx`. New work goes in `src/os/`.
- **`dist2/`** is a committed build artifact — do not delete it; it may be used for deployment without a build step.

---

## Testing

Backend only (no frontend tests currently):
```bash
cd server
npm run test:e2e   # requires running PostgreSQL
```

E2E specs: `server/test/auth.e2e-spec.ts`, `notes.e2e-spec.ts`, `uploads.e2e-spec.ts`

---

## Scripts to Avoid Running Blindly

| Script | Risk |
|---|---|
| `improve-kobeos.sh` | Overwrites source files — review before running |
| `push-kobeos-complete.sh` | Commits and pushes to git — review before running |
| `setup-all.sh` / `setup-kobeos-installer.sh` | System-level setup — review first |
| `scripts/build-iso.js` | Requires root-level tools; will exit if linux-unpacked missing |
