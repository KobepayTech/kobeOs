/**
 * localdb.js — SQLite local database for KobeOS
 *
 * Provides offline-first storage for all app data.
 * All writes go here first; the sync engine drains to the cloud.
 */

const path = require('path');
const { app } = require('electron');

let db = null;

function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'kobeos-local.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    -- Auth tokens (replaces localStorage)
    CREATE TABLE IF NOT EXISTS kv_store (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- Offline sync queue
    CREATE TABLE IF NOT EXISTS sync_queue (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      method     TEXT NOT NULL,
      path       TEXT NOT NULL,
      body       TEXT,
      headers    TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      attempts   INTEGER DEFAULT 0,
      last_error TEXT
    );

    -- Notes (offline cache)
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      content    TEXT,
      updated_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0,
      deleted    INTEGER DEFAULT 0
    );

    -- Contacts
    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY,
      name       TEXT,
      email      TEXT,
      phone      TEXT,
      data       TEXT,
      updated_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0,
      deleted    INTEGER DEFAULT 0
    );

    -- Todo lists
    CREATE TABLE IF NOT EXISTS todo_lists (
      id         INTEGER PRIMARY KEY,
      name       TEXT,
      updated_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0,
      deleted    INTEGER DEFAULT 0
    );

    -- Todo items
    CREATE TABLE IF NOT EXISTS todo_items (
      id         INTEGER PRIMARY KEY,
      list_id    INTEGER,
      title      TEXT,
      completed  INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0,
      deleted    INTEGER DEFAULT 0
    );

    -- POS products
    CREATE TABLE IF NOT EXISTS pos_products (
      id         INTEGER PRIMARY KEY,
      name       TEXT,
      price      REAL,
      stock      INTEGER,
      category   TEXT,
      data       TEXT,
      updated_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0
    );

    -- POS orders (critical offline data)
    CREATE TABLE IF NOT EXISTS pos_orders (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      total      REAL,
      created_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0
    );

    -- Cargo shipments
    CREATE TABLE IF NOT EXISTS cargo_shipments (
      id              TEXT PRIMARY KEY,
      tracking_number TEXT,
      origin          TEXT,
      destination     TEXT,
      weight          REAL,
      status          TEXT DEFAULT 'pending',
      data            TEXT,
      updated_at      INTEGER DEFAULT (unixepoch()),
      synced          INTEGER DEFAULT 0
    );

    -- Hotel rooms
    CREATE TABLE IF NOT EXISTS hotel_rooms (
      id              INTEGER PRIMARY KEY,
      room_number     TEXT,
      type            TEXT,
      price_per_night REAL,
      status          TEXT DEFAULT 'available',
      data            TEXT,
      updated_at      INTEGER DEFAULT (unixepoch()),
      synced          INTEGER DEFAULT 0
    );

    -- Hotel bookings
    CREATE TABLE IF NOT EXISTS hotel_bookings (
      id         TEXT PRIMARY KEY,
      room_id    INTEGER,
      data       TEXT NOT NULL,
      check_in   TEXT,
      check_out  TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0
    );

    -- Calendar events
    CREATE TABLE IF NOT EXISTS calendar_events (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      start_date TEXT,
      end_date   TEXT,
      data       TEXT,
      updated_at INTEGER DEFAULT (unixepoch()),
      synced     INTEGER DEFAULT 0,
      deleted    INTEGER DEFAULT 0
    );

    -- Generic app cache (for any other app data)
    CREATE TABLE IF NOT EXISTS app_cache (
      app        TEXT NOT NULL,
      key        TEXT NOT NULL,
      value      TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (app, key)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
    CREATE INDEX IF NOT EXISTS idx_notes_synced ON notes(synced);
    CREATE INDEX IF NOT EXISTS idx_pos_orders_synced ON pos_orders(synced);
    CREATE INDEX IF NOT EXISTS idx_cargo_synced ON cargo_shipments(synced);
  `);
}

// ── KV store (replaces localStorage for tokens/settings) ──────────────────

function kvGet(key) {
  const row = getDb().prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  return row ? row.value : null;
}

function kvSet(key, value) {
  getDb().prepare(`
    INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `).run(key, value);
}

function kvDelete(key) {
  getDb().prepare('DELETE FROM kv_store WHERE key = ?').run(key);
}

// ── Sync queue ─────────────────────────────────────────────────────────────

function enqueue(method, path, body, headers) {
  getDb().prepare(`
    INSERT INTO sync_queue (method, path, body, headers) VALUES (?, ?, ?, ?)
  `).run(method, path, body ? JSON.stringify(body) : null, headers ? JSON.stringify(headers) : null);
}

function getPendingQueue(limit = 50) {
  return getDb().prepare(`
    SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT ?
  `).all(limit);
}

function markSynced(id) {
  getDb().prepare('DELETE FROM sync_queue WHERE id = ?').run(id);
}

function markFailed(id, error) {
  getDb().prepare(`
    UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?
  `).run(error, id);
}

function getQueueDepth() {
  return getDb().prepare('SELECT COUNT(*) as count FROM sync_queue').get().count;
}

// ── Generic table operations ───────────────────────────────────────────────

function upsertRecord(table, record) {
  const keys = Object.keys(record);
  const placeholders = keys.map(() => '?').join(', ');
  const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');
  getDb().prepare(`
    INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}
  `).run(...Object.values(record));
}

function getRecords(table, where = '', params = []) {
  return getDb().prepare(`SELECT * FROM ${table} ${where}`).all(...params);
}

function deleteRecord(table, id) {
  getDb().prepare(`UPDATE ${table} SET deleted = 1, synced = 0 WHERE id = ?`).run(id);
}

function cacheSet(app, key, value) {
  getDb().prepare(`
    INSERT INTO app_cache (app, key, value, updated_at) VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(app, key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `).run(app, key, typeof value === 'string' ? value : JSON.stringify(value));
}

function cacheGet(app, key) {
  const row = getDb().prepare('SELECT value FROM app_cache WHERE app = ? AND key = ?').get(app, key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function getStats() {
  const d = getDb();
  return {
    queueDepth: d.prepare('SELECT COUNT(*) as c FROM sync_queue').get().c,
    unsyncedNotes: d.prepare('SELECT COUNT(*) as c FROM notes WHERE synced = 0').get().c,
    unsyncedOrders: d.prepare('SELECT COUNT(*) as c FROM pos_orders WHERE synced = 0').get().c,
    unsyncedShipments: d.prepare('SELECT COUNT(*) as c FROM cargo_shipments WHERE synced = 0').get().c,
  };
}

function close() {
  if (db) { db.close(); db = null; }
}

// ── Higher-level CRUD used by IPC handlers ─────────────────────────────────

// kvDel is an alias for kvDelete (used by IPC)
function kvDel(key) { return kvDelete(key); }

// query: returns rows from a table, optionally filtered by column equality
function query(table, filters = {}) {
  const ALLOWED_TABLES = [
    'notes', 'contacts', 'todo_lists', 'todo_items',
    'pos_products', 'pos_orders', 'cargo_shipments',
    'hotel_rooms', 'hotel_bookings', 'calendar_events', 'app_cache',
  ];
  if (!ALLOWED_TABLES.includes(table)) throw new Error(`Unknown table: ${table}`);
  const keys = Object.keys(filters);
  if (keys.length === 0) return getDb().prepare(`SELECT * FROM ${table} WHERE deleted = 0 OR deleted IS NULL`).all();
  const where = keys.map(k => `${k} = ?`).join(' AND ');
  return getDb().prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...Object.values(filters));
}

// insert: upsert a record into a table
function insert(table, record) {
  return upsertRecord(table, record);
}

// update: patch specific columns on a row by id
function update(table, id, changes) {
  const ALLOWED_TABLES = [
    'notes', 'contacts', 'todo_lists', 'todo_items',
    'pos_products', 'pos_orders', 'cargo_shipments',
    'hotel_rooms', 'hotel_bookings', 'calendar_events',
  ];
  if (!ALLOWED_TABLES.includes(table)) throw new Error(`Unknown table: ${table}`);
  const keys = Object.keys(changes);
  if (keys.length === 0) return;
  const set = keys.map(k => `${k} = ?`).join(', ');
  getDb().prepare(`UPDATE ${table} SET ${set}, updated_at = unixepoch() WHERE id = ?`)
    .run(...Object.values(changes), id);
}

// delete: soft-delete by id (sets deleted = 1)
function softDelete(table, id) { return deleteRecord(table, id); }

// enqueue overload: accepts either (method, path, body, headers) or a single operation object
function enqueueOp(operation) {
  if (typeof operation === 'object' && operation.method) {
    return enqueue(operation.method, operation.path, operation.body, operation.headers);
  }
  throw new Error('enqueue expects { method, path, body?, headers? }');
}

module.exports = {
  getDb, kvGet, kvSet, kvDelete, kvDel,
  enqueue, enqueueOp, getPendingQueue, markSynced, markFailed, getQueueDepth,
  upsertRecord, getRecords, deleteRecord,
  query, insert, update, delete: softDelete,
  cacheSet, cacheGet, getStats, close,
};
