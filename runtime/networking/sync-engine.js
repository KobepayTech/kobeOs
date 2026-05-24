/**
 * sync-engine.js — Offline sync queue drain + conflict resolution
 *
 * Strategy: Last-Write-Wins (LWW) based on updated_at timestamp.
 * Queue drains in FIFO order when connectivity is restored.
 */

const { net } = require('electron');
const localdb = require('./localdb');
const conflictResolver = require('./conflict-resolver');

let syncTimer = null;
let isSyncing = false;
let mainWindow = null;

const SYNC_INTERVAL_MS = 30_000;   // check every 30s
const MAX_ATTEMPTS = 5;            // drop after 5 failures
const RETRY_BACKOFF_MS = 5_000;    // base backoff

function init(win) {
  mainWindow = win;
  scheduleDrain();
}

function scheduleDrain() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(drain, SYNC_INTERVAL_MS);
}

function isOnline() {
  return net.isOnline();
}

async function drain() {
  if (isSyncing || !isOnline()) return;
  const depth = localdb.getQueueDepth();
  if (depth === 0) return;

  isSyncing = true;
  notifyRenderer('sync:start', { depth });

  const items = localdb.getPendingQueue(50);
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.attempts >= MAX_ATTEMPTS) {
      localdb.markSynced(item.id); // drop permanently after max attempts
      continue;
    }
    try {
      const headers = item.headers ? JSON.parse(item.headers) : {};
      const body = item.body ? item.body : undefined;

      const res = await fetchWithTimeout(`${getApiBase()}${item.path}`, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
      }, 10_000);

      if (res.ok) {
        localdb.markSynced(item.id);
        conflictResolver.markLocalSynced(item);
        synced++;
      } else if (res.status === 409) {
        // Conflict — apply LWW resolution
        let serverData = null;
        try { serverData = await res.json(); } catch { /* ignore */ }
        const resolution = conflictResolver.resolve(item, serverData);

        if (resolution === 'server-wins') {
          conflictResolver.applyServerWins(item, serverData);
          localdb.markSynced(item.id); // drop local write
        } else {
          // local-wins: retry with force header
          const forceRes = await fetchWithTimeout(`${getApiBase()}${item.path}`, {
            method: item.method,
            headers: { 'Content-Type': 'application/json', 'X-Force-Write': 'true', ...headers },
            body,
          }, 10_000).catch(() => null);
          if (forceRes?.ok) {
            localdb.markSynced(item.id);
            conflictResolver.markLocalSynced(item);
            synced++;
          } else {
            localdb.markFailed(item.id, `Conflict force-write failed: HTTP ${forceRes?.status ?? 'err'}`);
            failed++;
          }
        }
      } else if (res.status === 422) {
        // Unprocessable — server validation rejected it, drop permanently
        localdb.markSynced(item.id);
      } else if (res.status >= 400 && res.status < 500) {
        // Other client error — drop, won't succeed on retry
        localdb.markSynced(item.id);
      } else {
        localdb.markFailed(item.id, `HTTP ${res.status}`);
        failed++;
      }
    } catch (err) {
      localdb.markFailed(item.id, err.message);
      failed++;
    }
  }

  isSyncing = false;
  notifyRenderer('sync:complete', { synced, failed, remaining: localdb.getQueueDepth() });
}

function fetchWithTimeout(url, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(url, options)
      .then(res => { clearTimeout(timer); resolve(res); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

function getApiBase() {
  return process.env.VITE_API_BASE || 'http://localhost:3000/api';
}

function notifyRenderer(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data);
  }
}

// Force immediate drain (called when connectivity restored)
function forceDrain() {
  setTimeout(drain, 500);
}

function stop() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

function getStatus() {
  return {
    online: isOnline(),
    syncing: isSyncing,
    queueDepth: localdb.getQueueDepth(),
    stats: localdb.getStats(),
  };
}

module.exports = { init, drain, forceDrain, stop, getStatus, isOnline };
