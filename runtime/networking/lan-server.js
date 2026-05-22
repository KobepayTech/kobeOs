/**
 * lan-server.js — LAN sync server mode
 *
 * When enabled, this machine acts as a local sync hub for other KobeOS
 * instances on the same network. Uses:
 *   - mDNS (via dns-sd / avahi) to advertise the service
 *   - A lightweight HTTP relay that proxies sync queue items to/from peers
 *   - The existing NestJS backend as the authoritative data store
 *
 * Other instances discover the LAN server and point their sync engine at it
 * instead of (or in addition to) the cloud backend.
 */

const { ipcMain } = require('electron');
const http = require('http');
const { exec } = require('child_process');
const os = require('os');

const LAN_SERVER_PORT = 3737;
const SERVICE_NAME    = 'KobeOS-LAN';
const SERVICE_TYPE    = '_kobeos._tcp';

let lanServer = null;
let mdnsProcess = null;
let isRunning = false;

// ── Discover local IP ─────────────────────────────────────────────────────────

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// ── mDNS advertisement ────────────────────────────────────────────────────────

function startMdns() {
  // Try avahi-publish (Linux) first, fall back to dns-sd (macOS)
  const cmd = process.platform === 'darwin'
    ? `dns-sd -R "${SERVICE_NAME}" ${SERVICE_TYPE} local ${LAN_SERVER_PORT}`
    : `avahi-publish -s "${SERVICE_NAME}" ${SERVICE_TYPE} ${LAN_SERVER_PORT} 2>/dev/null`;

  mdnsProcess = exec(cmd, (err) => {
    if (err && !err.killed) console.warn('[lan-server] mDNS advertisement failed:', err.message);
  });
  console.log('[lan-server] mDNS advertising on', SERVICE_TYPE, 'port', LAN_SERVER_PORT);
}

function stopMdns() {
  if (mdnsProcess) { mdnsProcess.kill(); mdnsProcess = null; }
}

// ── Peer discovery via mDNS browse ───────────────────────────────────────────

function discoverPeers() {
  return new Promise((resolve) => {
    const peers = [];
    const cmd = process.platform === 'darwin'
      ? `dns-sd -B ${SERVICE_TYPE} local`
      : `avahi-browse -t -r -p ${SERVICE_TYPE} 2>/dev/null`;

    const proc = exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err && !err.killed) { resolve([]); return; }
      // Parse avahi output: lines like =;eth0;IPv4;KobeOS-LAN;_kobeos._tcp;local;hostname.local;192.168.1.5;3737;
      const lines = stdout.split('\n').filter(l => l.startsWith('='));
      for (const line of lines) {
        const parts = line.split(';');
        if (parts.length >= 9) {
          const ip   = parts[7];
          const port = parseInt(parts[8], 10);
          if (ip && port && ip !== getLocalIP()) {
            peers.push({ ip, port, name: parts[3] });
          }
        }
      }
      resolve(peers);
    });
    setTimeout(() => { try { proc.kill(); } catch {} }, 4500);
  });
}

// ── HTTP relay server ─────────────────────────────────────────────────────────
// Proxies sync requests from peer KobeOS instances to the local NestJS backend.

function startHttpRelay() {
  lanServer = http.createServer((req, res) => {
    // Health check
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode: 'lan-server', host: getLocalIP() }));
      return;
    }

    // Proxy all other requests to the local NestJS backend on :3000
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:3000' },
    };

    const proxy = http.request(options, (backendRes) => {
      res.writeHead(backendRes.statusCode, backendRes.headers);
      backendRes.pipe(res);
    });

    proxy.on('error', (err) => {
      console.error('[lan-server] proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Backend unavailable' }));
    });

    req.pipe(proxy);
  });

  lanServer.listen(LAN_SERVER_PORT, '0.0.0.0', () => {
    console.log(`[lan-server] HTTP relay listening on :${LAN_SERVER_PORT}`);
  });

  lanServer.on('error', (err) => {
    console.error('[lan-server] server error:', err.message);
    isRunning = false;
  });
}

// ── Start / stop ──────────────────────────────────────────────────────────────

function start() {
  if (isRunning) return { success: false, error: 'Already running' };
  startHttpRelay();
  startMdns();
  isRunning = true;
  console.log('[lan-server] Started — IP:', getLocalIP());
  return { success: true, ip: getLocalIP(), port: LAN_SERVER_PORT };
}

function stop() {
  if (!isRunning) return;
  stopMdns();
  if (lanServer) { lanServer.close(); lanServer = null; }
  isRunning = false;
  console.log('[lan-server] Stopped');
}

function getStatus() {
  return {
    running: isRunning,
    ip: getLocalIP(),
    port: LAN_SERVER_PORT,
    serviceType: SERVICE_TYPE,
  };
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('lan:start',    () => start());
ipcMain.handle('lan:stop',     () => { stop(); return { success: true }; });
ipcMain.handle('lan:status',   () => getStatus());
ipcMain.handle('lan:discover', () => discoverPeers());

module.exports = { start, stop, getStatus, discoverPeers };
