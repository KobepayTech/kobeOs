# cloud/sync

Offline-first sync engine. Source: `runtime/networking/sync-engine.js`.

Queues writes locally in SQLite when offline, drains to the backend when connectivity is restored.
Conflict resolution is handled by `runtime/networking/conflict-resolver.js` using last-write-wins with server authority.
