# cloud/

KobeOS cloud infrastructure layer. Maps to the NestJS backend modules in `server/src/`.

| Directory | Backend module | Purpose |
|---|---|---|
| `auth/` | `server/src/auth/` | JWT auth, refresh tokens, password reset |
| `sync/` | `electron/sync-engine.js` | Offline-first sync queue, conflict resolution |
| `api/` | `server/src/` (all controllers) | REST API surface |
| `analytics/` | `server/src/audit/` | Audit trail, usage metrics |

## Architecture

```
KobeOS App
    ↓
window.kobeOS.runtime.cloud   ← cloud-service.js (online/offline detection)
    ↓
src/lib/api.ts                ← HTTP client with offline fallback
    ↓
server/ (NestJS)              ← REST API on :3000
    ↓
PostgreSQL                    ← Persistent storage
```

Offline writes are queued in SQLite via `electron/localdb.js` and drained when connectivity is restored.
