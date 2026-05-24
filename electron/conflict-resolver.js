/**
 * conflict-resolver.js — Last-Write-Wins (LWW) conflict resolution
 *
 * Strategy:
 *   - Every local record has an `updated_at` Unix timestamp (set on write).
 *   - When the sync engine receives a 409 Conflict from the server, it fetches
 *     the server's version and compares timestamps.
 *   - The record with the higher `updated_at` wins and is written to both sides.
 *   - For the sync queue specifically: if the local write is older than the
 *     server's version, the queue item is dropped (server wins). If local is
 *     newer, the item is retried with an `X-Force-Write: true` header.
 *
 * Special cases:
 *   - Deletes always win over updates (tombstone propagation).
 *   - POS orders are never overwritten — they are append-only.
 */

const localdb = require('./localdb');

// Tables where deletes always win (tombstone propagation)
const TOMBSTONE_TABLES = ['notes', 'contacts', 'todo_items', 'todo_lists', 'calendar_events'];

// Tables that are append-only — never overwrite, only insert
const APPEND_ONLY_TABLES = ['pos_orders', 'cargo_shipments', 'hotel_bookings'];

/**
 * Resolve a 409 conflict for a queued sync operation.
 *
 * @param {object} queueItem  - Row from sync_queue
 * @param {object} serverData - Parsed JSON body from the 409 response
 * @returns {'local-wins'|'server-wins'|'skip'} resolution
 */
function resolve(queueItem, serverData) {
  const path = queueItem.path || '';

  // Determine which table this operation targets
  const table = inferTable(path);

  // Append-only tables: never overwrite existing server records
  if (APPEND_ONLY_TABLES.includes(table)) {
    // If server already has this record, drop the queue item
    if (serverData && serverData.id) return 'server-wins';
    return 'local-wins';
  }

  // DELETE operations: tombstone always wins
  if (queueItem.method === 'DELETE') return 'local-wins';

  // If server record is a delete tombstone, server wins
  if (serverData && serverData.deleted) return 'server-wins';

  // LWW: compare updated_at timestamps
  let localBody = {};
  try { localBody = JSON.parse(queueItem.body || '{}'); } catch { /* ignore */ }

  const localTs  = localBody.updated_at  || localBody.updatedAt  || 0;
  const serverTs = serverData?.updated_at || serverData?.updatedAt || 0;

  if (localTs >= serverTs) return 'local-wins';
  return 'server-wins';
}

/**
 * Apply a server-wins resolution: update the local record to match server state.
 */
function applyServerWins(queueItem, serverData) {
  const table = inferTable(queueItem.path);
  if (!table || !serverData?.id) return;

  try {
    if (serverData.deleted && TOMBSTONE_TABLES.includes(table)) {
      localdb.update(table, serverData.id, { deleted: 1, synced: 1 });
    } else {
      // Merge server data into local record
      const changes = { ...serverData, synced: 1 };
      localdb.update(table, serverData.id, changes);
    }
  } catch (err) {
    console.warn('[conflict] applyServerWins failed:', err.message);
  }
}

/**
 * Infer the local table name from an API path.
 * e.g. /api/notes/123 → 'notes'
 */
function inferTable(apiPath) {
  if (!apiPath) return null;
  const segments = apiPath.replace(/^\/api\//, '').split('/');
  const resource = segments[0];
  const TABLE_MAP = {
    'notes':          'notes',
    'contacts':       'contacts',
    'todo':           'todo_items',
    'todo-lists':     'todo_lists',
    'pos':            'pos_orders',
    'pos-orders':     'pos_orders',
    'cargo':          'cargo_shipments',
    'shipments':      'cargo_shipments',
    'hotel':          'hotel_bookings',
    'bookings':       'hotel_bookings',
    'calendar':       'calendar_events',
    'events':         'calendar_events',
  };
  return TABLE_MAP[resource] || null;
}

/**
 * Mark a queue item as synced and update the local record's synced flag.
 */
function markLocalSynced(queueItem) {
  const table = inferTable(queueItem.path);
  if (!table) return;
  try {
    let body = {};
    try { body = JSON.parse(queueItem.body || '{}'); } catch { /* ignore */ }
    if (body.id) localdb.update(table, body.id, { synced: 1 });
  } catch { /* ignore */ }
}

module.exports = { resolve, applyServerWins, markLocalSynced, inferTable };
