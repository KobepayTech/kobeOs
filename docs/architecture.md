# KobeOS Architecture

## Repository Layout

```
kobeOs/
├── runtime/          # Core OS runtime (JS, runs in Electron main process)
│   ├── core/         # HAL, ServiceManager, DriverManager, boot entry
│   ├── services/     # Audio, AI, File, Cloud, DeviceManager services
│   ├── security/     # Sandbox, core integrity, update verification
│   ├── networking/   # LAN server, sync engine, conflict resolver
│   └── updates/      # Auto-updater, OS update service
│
├── desktop/          # Electron desktop shell
│   ├── main.js       # Electron main process entry point
│   ├── preload.js    # contextBridge — exposes runtime API to renderer
│   ├── ui/           # Splash screen, window chrome
│   └── assets/       # App icons
│
├── src/              # React/TypeScript frontend (Vite)
│   ├── apps/         # 70+ modular apps
│   ├── os/           # Desktop shell, WindowManager, Taskbar, store
│   ├── hooks/        # useRuntime, useSystemMode, etc.
│   └── types/        # Shared TypeScript types
│
├── server/           # NestJS backend (PostgreSQL, REST API)
│   └── src/          # 25+ domain modules
│
├── ai/               # AI runtime integration
│   ├── llama-runtime/ # Ollama bridge, local inference
│   ├── model-manager/ # Model lifecycle management
│   ├── speech/       # Speech-to-text (planned)
│   ├── vision/       # Computer vision (planned)
│   └── embeddings/   # Vector embeddings
│
├── drivers/          # User-space hardware drivers
│   ├── payments/     # POS terminals, payment gateways
│   ├── cameras/      # Webcam, IP camera
│   ├── devices/      # Audio, Bluetooth, HID
│   └── vending/      # Vending machine controllers
│
├── sdk/              # Developer SDKs
│   ├── typescript/   # TypeScript/React SDK
│   ├── python/       # Python SDK for AI/automation
│   └── rust/         # Rust SDK (planned)
│
├── cloud/            # Cloud infrastructure docs
│   ├── auth/         # JWT auth layer
│   ├── sync/         # Offline-first sync
│   ├── api/          # REST API surface
│   └── analytics/    # Audit trail, metrics
│
├── models/           # AI model manifests and downloader
│   ├── manifests/    # Model registry JSON
│   └── downloader/   # CLI model downloader
│
├── electron/         # Electron build artifacts (original location, kept for build compat)
├── scripts/          # Build scripts (ISO, manifest, bundle)
├── build/            # Electron-builder resources
└── docs/             # Architecture and developer docs
```

## Data Flow

```
User Action (React app)
    ↓
window.kobeOS.runtime.*   (preload.js contextBridge)
    ↓
ipcMain.handle(...)       (desktop/main.js IPC handlers)
    ↓
runtime/core/             (HAL + ServiceManager)
    ↓
runtime/services/         (Audio, AI, File, Cloud, Devices)
    ↓
drivers/                  (Camera, Audio, POS, Payment, Bluetooth)
    ↓
Hardware / OS
```

## Offline-First

All writes go through `src/lib/api.ts` which:
1. Attempts the backend HTTP call
2. On failure, writes to SQLite via `electron/localdb.js`
3. Queues the operation in `runtime/networking/sync-engine.js`
4. Drains the queue when `runtime/services/cloud-service.js` detects connectivity
